const { exec } = require('child_process');
const path = require('path');

/**
 * Analyze content using Google Knowledge Graph and Wikidata
 */
async function analyzeWithKnowledgeGraph(data) {
    const { keywords, language = 'en', includeWikidata = true } = data;
    
    console.log(`🧠 Starting Knowledge Graph analysis for keywords: ${keywords?.join(', ')}`);
    
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, '../../scripts/knowledge_graph.py');
        const inputData = JSON.stringify({ keywords, language, includeWikidata });
        
        // Make sure the input data is properly escaped
        const escapedInput = inputData.replace(/'/g, "'\"'\"'");
        
        exec(`python3 "${pythonScript}" '${escapedInput}'`, {
            timeout: 30000, // 30 second timeout
            maxBuffer: 1024 * 1024 // 1MB buffer
        }, (error, stdout, stderr) => {
            if (error) {
                console.error('Python script execution error:', error);
                reject(new Error(`Knowledge Graph analysis failed: ${error.message}`));
                return;
            }
            
            if (stderr) {
                console.warn('Python script warning:', stderr);
            }
            
            try {
                const result = JSON.parse(stdout);
                console.log(`✅ Knowledge Graph analysis completed. Found ${result.entities?.length || 0} entities`);
                resolve(result);
            } catch (parseError) {
                console.error('Failed to parse Python output:', stdout);
                console.error('Parse error:', parseError);
                reject(new Error(`Failed to parse Knowledge Graph results: ${parseError.message}`));
            }
        });
    });
}

/**
 * Extract keywords from SEO analysis results
 */
function extractKeywordsFromSeoResults(seoResults) {
    const keywords = [];
    
    // Extract from enhanced keywords
    if (seoResults.contentAnalysis?.enhancedKeywords?.keywords?.mixed) {
        const mixedKeywords = seoResults.contentAnalysis.enhancedKeywords.keywords.mixed
            .slice(0, 5)
            .map(kw => kw.word);
        keywords.push(...mixedKeywords);
    }
    
    // Extract from Hebrew keywords if available
    if (seoResults.contentAnalysis?.enhancedKeywords?.keywords?.hebrew) {
        const hebrewKeywords = seoResults.contentAnalysis.enhancedKeywords.keywords.hebrew
            .slice(0, 3)
            .map(kw => kw.word);
        keywords.push(...hebrewKeywords);
    }
    
    // Extract from English keywords if available
    if (seoResults.contentAnalysis?.enhancedKeywords?.keywords?.english) {
        const englishKeywords = seoResults.contentAnalysis.enhancedKeywords.keywords.english
            .slice(0, 3)
            .map(kw => kw.word);
        keywords.push(...englishKeywords);
    }
    
    // Remove duplicates and return
    return [...new Set(keywords)].slice(0, 8);
}

/**
 * Simple keyword extractor from raw text
 */
function extractKeywordsFromText(text, maxKeywords = 5) {
    const stopWords = new Set([
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may',
        'של', 'את', 'עם', 'על', 'אל', 'כל', 'לא', 'אם', 'כי', 'זה', 'היא', 'הוא'
    ]);
    
    const words = text.toLowerCase()
        .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
    
    const frequency = {};
    words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, maxKeywords)
        .map(([word]) => word);
}

module.exports = {
    analyzeWithKnowledgeGraph,
    extractKeywordsFromSeoResults,
    extractKeywordsFromText
};
