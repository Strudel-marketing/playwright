const express = require('express');
const router = express.Router();
const { runLighthouseAnalysis } = require('./performanceService');
const { runLighthouse } = require('../../utils/lighthouse');

/**
 * POST /api/performance/lighthouse
 * Run full Lighthouse analysis
 */
router.post('/lighthouse', async (req, res) => {
    try {
        const { url, options = {} } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        console.log(`🔍 Running Lighthouse analysis for: ${url}`);

        // Try utils/lighthouse first (with try-catch), fallback to performanceService
        let result;
        try {
            result = await runLighthouse(url, options);
        } catch (error) {
            console.log('⚠️ Utils lighthouse failed, trying performance service:', error.message);
            result = await runLighthouseAnalysis(url, options);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Lighthouse analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: req.body.url
        });
    }
});

/**
 * POST /api/performance/lighthouse/full
 * Run full Lighthouse analysis with all categories
 */
router.post('/lighthouse/full', async (req, res) => {
    try {
        const { url, options = {} } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        const fullOptions = {
            ...options,
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa']
        };

        console.log(`🔍 Running full Lighthouse analysis for: ${url}`);

        let result;
        try {
            result = await runLighthouse(url, fullOptions);
        } catch (error) {
            console.log('⚠️ Utils lighthouse failed, trying performance service:', error.message);
            result = await runLighthouseAnalysis(url, fullOptions);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Full Lighthouse analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: req.body.url
        });
    }
});

/**
 * POST /api/performance/lighthouse/performance
 * Run Lighthouse performance analysis only
 */
router.post('/lighthouse/performance', async (req, res) => {
    try {
        const { url, options = {} } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        const performanceOptions = {
            ...options,
            onlyCategories: ['performance']
        };

        console.log(`⚡ Running Lighthouse performance analysis for: ${url}`);

        let result;
        try {
            result = await runLighthouse(url, performanceOptions);
        } catch (error) {
            console.log('⚠️ Utils lighthouse failed, trying performance service:', error.message);
            result = await runLighthouseAnalysis(url, performanceOptions);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Performance analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: req.body.url
        });
    }
});

/**
 * GET /api/performance/health
 * Health check for performance service
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'performance',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
