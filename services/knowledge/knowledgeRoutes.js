const express = require('express');
const router = express.Router();

const { analyzeWithKnowledgeGraph } = require('./knowledgeService'); // ודא שהנתיב נכון אצלך
const { performSeoAudit } = require('../seo/seoService');            // ודא שהנתיב נכון אצלך

// ===== עזר: חילוץ מילות מפתח מטקסט פשוט =====
function extractKeywordsFromText(text) {
  const stopWords = new Set([
    'the','and','or','but','in','on','at','to','for','of','with','by','a','an','is','are','was','were','be','been','have','has','had',
    'של','את','עם','על','אל','כל','לא','אם','כי','זה','היא','הוא','ב','ל','מ','ה','ו','אני','אתה','הם','אנחנו','יש','או','גם'
  ]);

  const words = String(text || '')
    .toLowerCase()
    .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);

  return Object.entries(freq)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 10)
    .map(([w]) => w);
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

      // פולבק אחרון: קצת טקסט מהדף (כותרות H1 + meta desc)
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
// אופציונלי: POST /api/knowledge/brief  — בריף תוכן בסיסי מה-KG
// ===================================================================
router.post('/brief', async (req, res) => {
  try {
    const { url, text, keywords, options = {} } = req.body;

    let analysisKeywords = Array.isArray(keywords) ? keywords.filter(Boolean) : [];

    if (analysisKeywords.length === 0 && text) {
      analysisKeywords = extractKeywordsFromText(text);
    }

    if (analysisKeywords.length === 0 && url) {
      const seoResults = await performSeoAudit(url, { includeScreenshot: false });
      const dom = seoResults.results?.contentAnalysis?.enhancedKeywords?.dominant_phrases || [];
      if (dom.length) {
        analysisKeywords = dom.slice(0, 5).map(p => p.phrase);
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

    // בריף כתיבה קטן: ישויות מיקוד, H2 מוצעים, FAQ, רפרנסים
    const entities = Array.isArray(kg.entities) ? kg.entities : [];
    const focus_entities = entities.map(e => e.name).filter(Boolean).slice(0, 3);
    const suggested_h2 = (kg.related_terms || []).slice(0, 6);
    const sem = (kg.semantic_keywords || []).slice(0, 10);
    const references = entities.map(e => e.url).filter(Boolean).slice(0, 5);

    const brief = {
      focus_entities,
      suggested_h2,
      faqs: sem.slice(0, 5).map(k => `מה זה ${k}?`),
      references
    };

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
