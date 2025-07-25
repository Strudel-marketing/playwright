const { exec } = require('child_process');
const path = require('path');

/**
 * ניתוח Knowledge Graph עם Python script
 */
async function analyzeWithKnowledgeGraph(options) {
    return new Promise((resolve, reject) => {
        const { keywords, language = 'en', includeWikidata = true } = options;
        
        console.log(`🧠 Running Knowledge Graph analysis for: [${keywords.join(', ')}]`);
        
        const pythonScript = path.join(__dirname, '../../scripts/knowledge_graph.py');
        const inputData = JSON.stringify({
            keywords,
            language,
            includeWikidata
        });
        
        // קריאה לPython script
            exec(`python3 ${pythonScript} '${inputData}'`, {
                env: { 
                    ...process.env,
                    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || ''
                },
                timeout: 30000
            }, (error, stdout, stderr) => {
            if (error) {
                console.error('Knowledge Graph analysis failed:', error);
                reject(new Error(`Knowledge Graph analysis failed: ${error.message}`));
                return;
            }
            
            if (stderr) {
                console.warn('Knowledge Graph warnings:', stderr);
            }
            
            try {
                const result = JSON.parse(stdout);
                console.log(`✅ Knowledge Graph analysis completed for ${keywords.length} keywords`);
                resolve(result);
            } catch (parseError) {
                console.error('Failed to parse Knowledge Graph results:', parseError);
                reject(new Error('Failed to parse Knowledge Graph results'));
            }
        });
    });
}

/**
 * חילוץ keywords מתוצאות SEO
 */
function extractKeywordsFromSeoResults(seoResults) {
    const keywords = [];
    
    try {
        // מהכותרת
        if (seoResults.results?.pageInfo?.title) {
            const titleWords = seoResults.results.pageInfo.title
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 2)
                .slice(0, 3); // 3 מילים מהכותרת
            keywords.push(...titleWords);
        }
        
        // מה-meta description
        if (seoResults.results?.metaTags?.description) {
            const descWords = seoResults.results.metaTags.description
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 2)
                .slice(0, 5); // 5 מילים מהתיאור
            keywords.push(...descWords);
        }
        
        // מהmeaningful phrases
        if (seoResults.results?.contentAnalysis?.enhancedKeywords?.meaningful_phrases) {
            const phrases = seoResults.results.contentAnalysis.enhancedKeywords.meaningful_phrases
                .map(p => p.phrase)
                .slice(0, 3); // 3 ביטויים עיקריים
            keywords.push(...phrases);
        }
        
        // מהkeywords המובילים
        if (seoResults.results?.contentAnalysis?.enhancedKeywords?.keywords?.mixed) {
            const topKeywords = seoResults.results.contentAnalysis.enhancedKeywords.keywords.mixed
                .slice(0, 5) // 5 keywords מובילים
                .map(k => k.word);
            keywords.push(...topKeywords);
        }
        
        // נקה ודאדו duplicates
        const uniqueKeywords = [...new Set(keywords)]
            .filter(word => word && word.length > 2)
            .slice(0, 10); // מקסימום 10 keywords
        
        console.log(`📊 Extracted ${uniqueKeywords.length} keywords from SEO results`);
        return uniqueKeywords;
        
    } catch (error) {
        console.error('Error extracting keywords from SEO results:', error);
        return [];
    }
}

/**
 * חילוץ keywords פשוט מטקסט
 */
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
