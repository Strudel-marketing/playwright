const express = require('express');
const router = express.Router();

const { analyzeWithKnowledgeGraph } = require('./knowledgeService'); // ודא נתיבים
const { performSeoAudit } = require('../seo/seoService');

// ===== עזר: חילוץ מילות מפתח מטקסט פשוט =====
function extractKeywordsFromText(text) {
  const stopWords = new Set([
    'the','and','or','but','in','on','at','to','for','of','with','by','a','an','is','are','was','were','be','been','have','has','had',
    'this','that','these','those','from','into','over','under','out','up','down','as','if','then','else','than','very','more','most','less','least','same','such','per','via','within','without',
    'של','את','עם','על','אל','כל','לא','אם','כי','זה','היא','הוא','אנו','אנחנו','אתם','אתן','הם','הן','או','גם','רק','כמו','לפי','בין','יש','אין','להיות'
  ]);

  const words = String(text || '')
    .toLowerCase()
    .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  return Object.entries(freq)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 10)
    .map(([w]) => w);
}

// ===== עזר: ניקוי נושאים/ביטויים =====
const STOP_GENERAL = new Set([
  'scientific','article','published','study','paper','report','overview','introduction','conclusion',
  'december','january','february','march','april','may','june','july','august','september','october','november'
]);
const isQid = v => typeof v === 'string' && /^q\d+$/i.test(v);

function cleanTopics(arr, max = 6) {
  const out = [];
  const seen = new Set();
  for (const t of (arr || [])) {
    const s = String(t || '').toLowerCase().trim();
    if (!s || isQid(s) || STOP_GENERAL.has(s)) continue;
    const words = s.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue; // רק 2–4 מילים
    const key = words.join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= max) break;
  }
  return out;
}

function buildFaqs(keyphrases, max = 5) {
  const faqs = [];
  const taken = new Set();
  for (const p of (keyphrases || [])) {
    const s = String(p || '').toLowerCase().trim();
    if (!s || isQid(s) || STOP_GENERAL.has(s)) continue;
    const words = s.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    const q = `מה זה ${s}?`;
    if (taken.has(q)) continue;
    taken.add(q);
    faqs.push(q);
    if (faqs.length >= max) break;
  }
  return faqs;
}

function entityUrl(e) {
  if (e?.url) return e.url;
  if (e?.id && /^Q\d+$/i.test(e.id)) return `https://www.wikidata.org/wiki/${e.id}`;
  return null;
}

// ===================================================================
// POST /api/knowledge/analyze
// ===================================================================
router.post('/analyze', async (req, res) => {
  try {
    const { url, text, keywords, options = {} } = req.body;

    let analysisKeywords = Array.isArray(keywords) ? keywords.filter(Boolean) : [];

    // אם יש URL ואין keywords - נחלץ מה-SEO (פורמט חדש: dominant_phrases)
    if (url && analysisKeywords.length === 0) {
      console.log(`🔍 Extracting keywords from URL: ${url}`);
      const seoResults = await performSeoAudit(url, {
        includeScreenshot: false,
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 60000
      });

      const dom = seoResults.results?.contentAnalysis?.enhancedKeywords?.dominant_phrases || [];
      if (dom.length) {
        analysisKeywords = dom.slice(0, 5).map(p => p.phrase);
      }

      // פולבק לגרסה ישנה meaningful_phrases אם אין חדש
      if (analysisKeywords.length === 0) {
        const oldMeaningful = seoResults.results?.contentAnalysis?.enhancedKeywords?.meaningful_phrases || [];
        analysisKeywords = oldMeaningful.slice(0, 5).map(p => p.phrase);
      }

      // פולבק אחרון: H1 + meta description
      if (analysisKeywords.length === 0) {
        const h1s = (seoResults.results?.contentAnalysis?.headings?.h1 || []).join(' ');
        const desc = seoResults.results?.metaTags?.description || '';
        analysisKeywords = extractKeywordsFromText(`${h1s} ${desc}`);
      }
    }

    // אם יש טקסט ואין keywords — נחלץ מהטקסט
    if (text && analysisKeywords.length === 0) {
      analysisKeywords = extractKeywordsFromText(text);
    }

    if (analysisKeywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No keywords found or provided for analysis'
      });
    }

    // ריצה בפועל של Knowledge Graph (Advertools/HTTP + Wikidata)
    const knowledgeGraphResult = await analyzeWithKnowledgeGraph({
      keywords: analysisKeywords,
      language: options.language || 'en',
      includeWikidata: options.includeWikidata !== false,
      limit: options.limit || 5
    });

    res.json({
      success: true,
      url: url || null,
      text: text ? `${text.substring(0, 100)}...` : null,
      analyzedKeywords: analysisKeywords,
      knowledgeGraph: knowledgeGraphResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Knowledge Graph analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================================================================
// POST /api/knowledge/brief — בריף תוכן בסיסי מה-KG
// ===================================================================
router.post('/brief', async (req, res) => {
  try {
    const { url, text, keywords, options = {} } = req.body;

    let analysisKeywords = Array.isArray(keywords) ? keywords.filter(Boolean) : [];

    if (analysisKeywords.length === 0 && text) {
      analysisKeywords = extractKeywordsFromText(text);
    }

    if (analysisKeywords.length === 0 && url) {
      const seoResults = await performSeoAudit(url, {
        includeScreenshot: false,
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 60000
      });
      const dom = seoResults.results?.contentAnalysis?.enhancedKeywords?.dominant_phrases || [];
      if (dom.length) {
        analysisKeywords = dom.slice(0, 5).map(p => p.phrase);
      }
      if (analysisKeywords.length === 0) {
        const oldMeaningful = seoResults.results?.contentAnalysis?.enhancedKeywords?.meaningful_phrases || [];
        analysisKeywords = oldMeaningful.slice(0, 5).map(p => p.phrase);
      }
      if (analysisKeywords.length === 0) {
        const h1s = (seoResults.results?.contentAnalysis?.headings?.h1 || []).join(' ');
        const desc = seoResults.results?.metaTags?.description || '';
        analysisKeywords = extractKeywordsFromText(`${h1s} ${desc}`);
      }
    }

    if (analysisKeywords.length === 0) {
      return res.status(400).json({ success: false, error: 'No keywords found or provided for brief' });
    }

    const kg = await analyzeWithKnowledgeGraph({
      keywords: analysisKeywords,
      language: options.language || 'he',
      includeWikidata: options.includeWikidata !== false,
      limit: options.limit || 5
    });

    // ===== בניית בריף משופר =====
    const entities = Array.isArray(kg.entities) ? kg.entities : [];

    // 1) focus_entities — מסנן "מאמרים אקדמיים" (Q13442814) ומנקה כפולים
    const isScholarly = (ent) =>
      Array.isArray(ent?.types) && ent.types.some(t => isQid(String(t)) && String(t).toLowerCase() === 'q13442814');

    const focus_entities = [];
    const seenFocus = new Set();
    for (const e of entities) {
      if (!e?.name) continue;
      if (isScholarly(e)) continue;
      const key = e.name.trim().toLowerCase();
      if (seenFocus.has(key)) continue;
      seenFocus.add(key);
      focus_entities.push(e.name.trim());
      if (focus_entities.length >= 3) break;
    }
    // פולבק בסיסי
    if (focus_entities.length === 0) {
      for (const e of entities) {
        if (!e?.name) continue;
        const key = e.name.trim().toLowerCase();
        if (seenFocus.has(key)) continue;
        seenFocus.add(key);
        focus_entities.push(e.name.trim());
        if (focus_entities.length >= 3) break;
      }
    }

    // 2) suggested_h2 — n-grams נקיים (2–4 מילים) ממילות מפתח סמנטיות/קשורות
    const suggested_h2 = cleanTopics(kg.semantic_keywords)
      .concat(cleanTopics(kg.related_terms))
      .slice(0, 6);

    // 3) FAQs — “מה זה …?” על ביטויים נקיים
    const faqs = buildFaqs(kg.semantic_keywords);

    // 4) References — URL אם קיים, אחרת קישור Wikidata
    const references = entities.map(entityUrl).filter(Boolean).slice(0, 5);

    const brief = { focus_entities, suggested_h2, faqs, references };

    res.json({
      success: true,
      analyzedKeywords: analysisKeywords,
      brief,
      knowledgeGraph: kg,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Knowledge Graph brief error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
