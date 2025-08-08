const { exec } = require('child_process');
const path = require('path');

async function analyzeWithKnowledgeGraph(options) {
  return new Promise((resolve, reject) => {
    const {
      keywords = [],
      language = 'en',
      includeWikidata = true,
      limit = 5
    } = options || {};

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return resolve({ success: true, queries: [], google: [], wikidata: [], entities: [], related_terms: [], semantic_keywords: [] });
    }

    console.log(`🧠 Running Knowledge Graph analysis for: [${keywords.join(', ')}]`);

    const pythonScript = path.join(__dirname, '../../scripts/knowledge_graph.py');
    const inputData = JSON.stringify({ keywords, language, includeWikidata, limit })
      // הגנה בסיסית על גרש בודד ב־shell
      .replace(/'/g, "\\'");

    exec(`python3 "${pythonScript}" '${inputData}'`, {
      env: {
        ...process.env,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || ''
      },
      timeout: 40000,
      maxBuffer: 10 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('Knowledge Graph analysis failed:', error);
        return reject(new Error(`Knowledge Graph analysis failed: ${error.message}`));
      }
      if (stderr) console.warn('Knowledge Graph warnings:', stderr);

      try {
        const result = JSON.parse(stdout);
        console.log(`✅ Knowledge Graph analysis completed for ${keywords.length} keywords (advertools=${result.used_advertools})`);
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse Knowledge Graph results:', parseError);
        reject(new Error('Failed to parse Knowledge Graph results'));
      }
    });
  });
}

function extractKeywordsFromSeoResults(seoResults) {
  try {
    const kw = new Set();

    // כותרת – עד 3 מילים
    const title = seoResults.results?.pageInfo?.title || '';
    title.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 3).forEach(w => kw.add(w));

    // meta description – עד 5 מילים
    const desc = seoResults.results?.metaTags?.description || '';
    desc.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 5).forEach(w => kw.add(w));

    // החדש: dominant_phrases
    const dom = seoResults.results?.contentAnalysis?.enhancedKeywords?.dominant_phrases || [];
    dom.slice(0, 5).forEach(p => kw.add(p.phrase));

    // פולבק לגרסה הישנה meaningful_phrases אם אין חדש
    if (kw.size === 0) {
      const oldMeaningful = seoResults.results?.contentAnalysis?.enhancedKeywords?.meaningful_phrases || [];
      oldMeaningful.slice(0, 3).forEach(p => kw.add(p.phrase));
    }

    const uniqueKeywords = [...kw].filter(Boolean).slice(0, 10);
    console.log(`📊 Extracted ${uniqueKeywords.length} KG queries from SEO results`);
    return uniqueKeywords;
  } catch (error) {
    console.error('Error extracting keywords from SEO results:', error);
    return [];
  }
}

function extractKeywordsFromText(text) {
    try {
        const stopWords = [
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
            'של', 'את', 'עם', 'על', 'אל', 'כל', 'לא', 'אם', 'כי', 'זה', 'היא', 'הוא',
            'ב', 'ל', 'מ', 'ה', 'ו', 'אני', 'אתה', 'הם', 'אנחנו', 'יש', 'או', 'גם'
        ];
        
        const words = text
            .toLowerCase()
            .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
            .split(/\s+/)
            .filter(word => 
                word.length > 2 && 
                !stopWords.includes(word) &&
                !/^\d+$/.test(word) // לא רק מספרים
            );
        
        // ספירת תדירות
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        // החזר 10 המילים הנפוצות ביותר
        const topKeywords = Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
        
        console.log(`📝 Extracted ${topKeywords.length} keywords from text`);
        return topKeywords;
        
    } catch (error) {
        console.error('Error extracting keywords from text:', error);
        return [];
    }
}

module.exports = {
    analyzeWithKnowledgeGraph,
    extractKeywordsFromSeoResults,
    extractKeywordsFromText
};
