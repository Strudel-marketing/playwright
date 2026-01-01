/**
 * SEO Keywords Extractor
 * מודול משותף לחילוץ מילות מפתח מתוצאות SEO audit
 *
 * משמש את: knowledgeRoutes, knowledgeService
 */

const { performSeoAudit } = require('../services/seo/seoService');
const { extractKeywordsFromText } = require('./textAnalyzer');

/**
 * חילוץ מילות מפתח מתוצאות SEO audit
 * @param {string} url - כתובת האתר
 * @param {Object} options - אפשרויות לSEO audit
 * @param {number} options.topN - מספר מילות מפתח להחזיר (default: 5)
 * @returns {Promise<Array<string>>} - מערך של מילות מפתח
 */
async function extractKeywordsFromSeo(url, options = {}) {
  const {
    topN = 5,
    waitUntil = 'domcontentloaded',
    timeout = 60000
  } = options;

  try {
    console.log(`📊 Extracting keywords from SEO audit: ${url}`);

    // ביצוע SEO audit
    const seoResults = await performSeoAudit(url, {
      includeScreenshot: false,
      waitUntil,
      timeout
    });

    // אסטרטגיה 1: dominant_phrases (החדש והטוב ביותר)
    const dominantPhrases = seoResults.results?.contentAnalysis?.enhancedKeywords?.dominant_phrases || [];
    if (dominantPhrases.length > 0) {
      console.log(`✓ Found ${dominantPhrases.length} dominant phrases`);
      return dominantPhrases.slice(0, topN).map(p => p.phrase);
    }

    // אסטרטגיה 2: פולבק ל-meaningful_phrases (גרסה ישנה)
    const meaningfulPhrases = seoResults.results?.contentAnalysis?.enhancedKeywords?.meaningful_phrases || [];
    if (meaningfulPhrases.length > 0) {
      console.log(`✓ Found ${meaningfulPhrases.length} meaningful phrases (legacy)`);
      return meaningfulPhrases.slice(0, topN).map(p => p.phrase);
    }

    // אסטרטגיה 3: פולבק אחרון - H1 + meta description
    console.log('⚠️ No enhanced keywords found, falling back to H1 + meta description');
    const h1s = (seoResults.results?.contentAnalysis?.headings?.h1 || []).join(' ');
    const description = seoResults.results?.metaTags?.description || '';
    const combinedText = `${h1s} ${description}`.trim();

    if (combinedText) {
      return extractKeywordsFromText(combinedText, { topN });
    }

    console.warn('⚠️ No keywords could be extracted from SEO results');
    return [];

  } catch (error) {
    console.error('❌ Error extracting keywords from SEO:', error.message);
    return [];
  }
}

/**
 * חילוץ מילות מפתח ממספר sources (SEO + טקסט)
 * @param {Object} params
 * @param {string} params.url - כתובת URL (אופציונלי)
 * @param {string} params.text - טקסט חופשי (אופציונלי)
 * @param {Array} params.keywords - keywords ידניים (אופציונלי)
 * @param {Object} params.options - אפשרויות
 * @returns {Promise<Array<string>>}
 */
async function extractKeywordsFromMultipleSources({ url, text, keywords, options = {} }) {
  let analysisKeywords = Array.isArray(keywords) ? keywords.filter(Boolean) : [];

  // אם כבר יש keywords ידניים - נשתמש בהם
  if (analysisKeywords.length > 0) {
    return analysisKeywords;
  }

  // אם יש URL - נחלץ מSEO
  if (url) {
    analysisKeywords = await extractKeywordsFromSeo(url, options);
    if (analysisKeywords.length > 0) {
      return analysisKeywords;
    }
  }

  // אם יש טקסט - נחלץ מהטקסט
  if (text) {
    analysisKeywords = extractKeywordsFromText(text, options);
    if (analysisKeywords.length > 0) {
      return analysisKeywords;
    }
  }

  return [];
}

/**
 * בדיקה אם יש keywords תקינים
 * @param {Array} keywords
 * @returns {boolean}
 */
function hasValidKeywords(keywords) {
  return Array.isArray(keywords) && keywords.filter(Boolean).length > 0;
}

module.exports = {
  extractKeywordsFromSeo,
  extractKeywordsFromMultipleSources,
  hasValidKeywords
};
