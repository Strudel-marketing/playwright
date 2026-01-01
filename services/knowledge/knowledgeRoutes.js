const express = require('express');
const router = express.Router();

const { analyzeWithKnowledgeGraph } = require('./knowledgeService');
const { extractKeywordsFromMultipleSources } = require('../../utils/seoKeywords');
const { cleanTopics, buildFaqs } = require('../../utils/textAnalyzer');

/**
 * Helper: בניית URL לentity (Google או Wikidata)
 */
function entityUrl(entity) {
  if (entity?.url) return entity.url;
  if (entity?.id && /^Q\d+$/i.test(entity.id)) {
    return `https://www.wikidata.org/wiki/${entity.id}`;
  }
  return null;
}

/**
 * Helper: בדיקה אם entity הוא מאמר אקדמי
 */
function isScholarlyArticle(entity) {
  return (
    Array.isArray(entity?.types) &&
    entity.types.some(t => {
      const type = String(t).toLowerCase();
      return type === 'q13442814'; // Wikidata ID למאמר אקדמי
    })
  );
}

// ===================================================================
// POST /api/knowledge/analyze
// ===================================================================
router.post('/analyze', async (req, res) => {
  try {
    const { url, text, keywords, options = {} } = req.body;

    // חילוץ keywords מכל המקורות האפשריים
    const analysisKeywords = await extractKeywordsFromMultipleSources({
      url,
      text,
      keywords,
      options: {
        topN: 10,
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 60000
      }
    });

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

    // חילוץ keywords (שימוש באותה פונקציה)
    const analysisKeywords = await extractKeywordsFromMultipleSources({
      url,
      text,
      keywords,
      options: {
        topN: 10,
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 60000
      }
    });

    if (analysisKeywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No keywords found or provided for brief'
      });
    }

    // ריצת Knowledge Graph
    const kg = await analyzeWithKnowledgeGraph({
      keywords: analysisKeywords,
      language: options.language || 'he',
      includeWikidata: options.includeWikidata !== false,
      limit: options.limit || 5
    });

    // ===== בניית בריף משופר =====
    const entities = Array.isArray(kg.entities) ? kg.entities : [];

    // 1) focus_entities — מסנן "מאמרים אקדמיים" ומנקה כפולים
    const focus_entities = [];
    const seenFocus = new Set();

    for (const entity of entities) {
      if (!entity?.name) continue;
      if (isScholarlyArticle(entity)) continue;

      const key = entity.name.trim().toLowerCase();
      if (seenFocus.has(key)) continue;

      seenFocus.add(key);
      focus_entities.push(entity.name.trim());

      if (focus_entities.length >= 3) break;
    }

    // פולבק אם לא מצאנו אף entity
    if (focus_entities.length === 0) {
      for (const entity of entities) {
        if (!entity?.name) continue;

        const key = entity.name.trim().toLowerCase();
        if (seenFocus.has(key)) continue;

        seenFocus.add(key);
        focus_entities.push(entity.name.trim());

        if (focus_entities.length >= 3) break;
      }
    }

    // 2) suggested_h2 — n-grams נקיים (2–4 מילים) ממילות מפתח סמנטיות/קשורות
    const suggested_h2 = cleanTopics(kg.semantic_keywords)
      .concat(cleanTopics(kg.related_terms))
      .slice(0, 6);

    // 3) FAQs — "מה זה …?" על ביטויים נקיים
    const faqs = buildFaqs(kg.semantic_keywords, 5, options.language || 'he');

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
