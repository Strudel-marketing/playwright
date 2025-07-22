const express = require('express');
const router = express.Router();
const { analyzeWithKnowledgeGraph } = require('./knowledgeService');
const { performSeoAudit } = require('../seo/seoService');

// Knowledge Graph Analysis
router.post('/analyze', async (req, res) => {
    try {
        const { url, text, keywords, options = {} } = req.body;
        
        let analysisKeywords = keywords || [];
        
        // אם יש URL ואין keywords - חלץ מSEO analysis
        if (url && !analysisKeywords.length) {
            console.log(`🔍 Extracting keywords from URL: ${url}`);
            const seoResults = await performSeoAudit(url, { includeScreenshot: false });
            
            if (seoResults.contentAnalysis?.enhancedKeywords?.keywords?.mixed) {
                analysisKeywords = seoResults.contentAnalysis.enhancedKeywords.keywords.mixed
                    .slice(0, 5)
                    .map(kw => kw.word);
            }
        }
        
        // אם יש טקסט ישירות - חלץ keywords פשוט
        if (text && !analysisKeywords.length) {
            analysisKeywords = extractKeywordsFromText(text);
        }
        
        if (!analysisKeywords.length) {
            return res.status(400).json({
                success: false,
                error: 'No keywords found or provided for analysis'
            });
        }
        
        // ריץ Knowledge Graph analysis
        const knowledgeGraphResult = await analyzeWithKnowledgeGraph({
            keywords: analysisKeywords,
            language: options.language || 'en',
            includeWikidata: options.includeWikidata !== false
        });
        
        res.json({
            success: true,
            url: url || null,
            text: text ? text.substring(0, 100) + '...' : null,
            analyzedKeywords: analysisKeywords,
            knowledgeGraph: knowledgeGraphResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Knowledge Graph analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Simple keyword extractor
function extractKeywordsFromText(text) {
    const words = text.toLowerCase()
        .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);
    
    const frequency = {};
    words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([word]) => word);
}

module.exports = router;
