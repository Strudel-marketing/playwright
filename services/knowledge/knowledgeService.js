const express = require('express');
const router = express.Router();
const { 
    analyzeWithKnowledgeGraph, 
    extractKeywordsFromSeoResults, 
    extractKeywordsFromText 
} = require('./knowledgeService');
const { performSeoAudit } = require('../seo/seoService');

/**
 * POST /api/knowledge/analyze
 * Comprehensive Knowledge Graph analysis
 */
router.post('/analyze', async (req, res) => {
    try {
        const { url, text, keywords, options = {} } = req.body;
        const startTime = Date.now();
        
        let analysisKeywords = keywords || [];
        let sourceType = 'provided_keywords';
        let seoResults = null;
        
        // אם יש URL ואין keywords - חלץ מSEO analysis
        if (url && !analysisKeywords.length) {
            console.log(`🔍 Extracting keywords from URL: ${url}`);
            sourceType = 'url_seo_analysis';
            
            try {
                seoResults = await performSeoAudit(url, { includeScreenshot: false });
                analysisKeywords = extractKeywordsFromSeoResults(seoResults);
                console.log(`📊 Extracted ${analysisKeywords.length} keywords from SEO analysis`);
            } catch (seoError) {
                console.error('SEO analysis failed:', seoError);
                return res.status(500).json({
                    success: false,
                    error: `Failed to analyze URL: ${seoError.message}`,
                    url
                });
            }
        }
        
        // אם יש טקסט ישירות - חלץ keywords פשוט
        if (text && !analysisKeywords.length) {
            console.log(`📝 Extracting keywords from text (${text.length} chars)`);
            sourceType = 'text_analysis';
            analysisKeywords = extractKeywordsFromText(text);
        }
        
        if (!analysisKeywords.length) {
            return res.status(400).json({
                success: false,
                error: 'No keywords found or provided for analysis',
                details: 'Please provide either keywords directly, a URL to analyze, or text content'
            });
        }
        
        console.log(`🎯 Analyzing keywords: [${analysisKeywords.join(', ')}]`);
        
        // ריץ Knowledge Graph analysis
        try {
            const knowledgeGraphResult = await analyzeWithKnowledgeGraph({
                keywords: analysisKeywords,
                language: options.language || 'en',
                includeWikidata: options.includeWikidata !== false
            });
            
            const executionTime = Date.now() - startTime;
            
            const response = {
                success: true,
                source: {
                    type: sourceType,
                    url: url || null,
                    textPreview: text ? text.substring(0, 100) + '...' : null,
                    providedKeywords: keywords || null
                },
                analysis: {
                    extractedKeywords: analysisKeywords,
                    keywordCount: analysisKeywords.length,
                    language: options.language || 'en',
                    includeWikidata: options.includeWikidata !== false
                },
                knowledgeGraph: knowledgeGraphResult,
                metadata: {
                    executionTime,
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            
            // אם יש SEO results, הוסף גם אותם
            if (seoResults && options.includeSeoData) {
                response.seoAnalysis = {
                    score: seoResults.seoScore?.total || 0,
                    enhancedKeywords: seoResults.contentAnalysis?.enhancedKeywords || null
                };
            }
            
            console.log(`✅ Knowledge Graph analysis completed in ${executionTime}ms`);
            res.json(response);
            
        } catch (kgError) {
            console.error('Knowledge Graph analysis failed:', kgError);
            res.status(500).json({
                success: false,
                error: `Knowledge Graph analysis failed: ${kgError.message}`,
                analysis: {
                    extractedKeywords: analysisKeywords,
                    keywordCount: analysisKeywords.length
                }
            });
        }
        
    } catch (error) {
        console.error('Knowledge Graph endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/knowledge/quick
 * Quick keyword-only analysis
 */
router.post('/quick', async (req, res) => {
    try {
        const { keywords, language = 'en' } = req.body;
        
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Keywords array is required'
            });
        }
        
        const knowledgeGraphResult = await analyzeWithKnowledgeGraph({
            keywords,
            language,
            includeWikidata: false // Quick mode - no Wikidata
        });
        
        res.json({
            success: true,
            keywords,
            language,
            knowledgeGraph: knowledgeGraphResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Quick Knowledge Graph analysis failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/knowledge/health
 * Health check for Knowledge Graph service
 */
router.get('/health', (req, res) => {
    const hasApiKey = !!process.env.GOOGLE_API_KEY;
    
    res.json({
        service: 'Knowledge Graph',
        status: 'healthy',
        features: {
            googleKnowledgeGraph: hasApiKey,
            wikidata: true,
            advertools: true
        },
        environment: {
            hasGoogleApiKey: hasApiKey,
            pythonAvailable: true
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
