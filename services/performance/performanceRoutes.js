const express = require('express');
const router = express.Router();
const psiService = require('./pageSpeedInsightsService');
const { runLighthouseAnalysis } = require('./performanceService');
const { runLighthouse } = require('../../utils/lighthouse');
const rateLimiter = require('../../utils/psiRateLimiter');

/**
 * POST /api/performance/pagespeed
 * Run PageSpeed Insights analysis (recommended - uses Google's API with real user data)
 */
router.post('/pagespeed', async (req, res) => {
    try {
        const { url, options = {} } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        console.log(`🚀 Running PageSpeed Insights API for: ${url}`);

        const result = await psiService.runPageSpeedInsights(url, options);

        res.json(result);

    } catch (error) {
        console.error('❌ PageSpeed Insights error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: req.body.url
        });
    }
});

/**
 * POST /api/performance/pagespeed/performance
 * Run PageSpeed Insights - performance only
 */
router.post('/pagespeed/performance', async (req, res) => {
    try {
        const { url, options = {} } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        console.log(`⚡ Running PageSpeed Insights performance analysis for: ${url}`);

        const result = await psiService.runPerformanceOnly(url, options);

        res.json(result);

    } catch (error) {
        console.error('❌ PageSpeed Insights performance error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: req.body.url
        });
    }
});

/**
 * POST /api/performance/pagespeed/full
 * Run PageSpeed Insights - all categories
 */
router.post('/pagespeed/full', async (req, res) => {
    try {
        const { url, options = {} } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        console.log(`🔍 Running full PageSpeed Insights analysis for: ${url}`);

        const result = await psiService.runFullAudit(url, options);

        res.json(result);

    } catch (error) {
        console.error('❌ Full PageSpeed Insights error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: req.body.url
        });
    }
});

/**
 * POST /api/performance/pagespeed/both
 * Run PageSpeed Insights for both mobile and desktop
 */
router.post('/pagespeed/both', async (req, res) => {
    try {
        const { url, options = {} } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        console.log(`📱💻 Running PageSpeed Insights for mobile and desktop: ${url}`);

        const result = await psiService.runBothStrategies(url, options);

        res.json(result);

    } catch (error) {
        console.error('❌ PageSpeed Insights both strategies error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: req.body.url
        });
    }
});

/**
 * POST /api/performance/lighthouse
 * Run Lighthouse analysis (local fallback)
 * NOTE: For accurate results matching Google PageSpeed Insights, use /api/performance/pagespeed instead
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

        console.log(`🔍 Running Lighthouse analysis (local) for: ${url}`);
        console.log(`ℹ️ Note: For results matching Google PageSpeed Insights, use /api/performance/pagespeed`);

        // Try utils/lighthouse first (with try-catch), fallback to performanceService
        let result;
        try {
            result = await runLighthouse(url, options);
        } catch (error) {
            console.log('⚠️ Utils lighthouse failed, trying performance service:', error.message);
            result = await runLighthouseAnalysis(url, options);
        }

        // Add note about using PSI API
        result.note = 'This is a local Lighthouse analysis. For results matching Google PageSpeed Insights with real user data, use /api/performance/pagespeed';

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
 * GET /api/performance/quota
 * Get PageSpeed Insights API quota status
 */
router.get('/quota', (req, res) => {
    try {
        const status = rateLimiter.getStatus();

        res.json({
            success: true,
            quota: status,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting quota status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/performance/health
 * Health check for performance service
 */
router.get('/health', (req, res) => {
    const quotaStatus = rateLimiter.getStatus();
    const hasApiKey = !!process.env.GOOGLE_PAGESPEED_API_KEY;

    res.json({
        success: true,
        service: 'performance',
        status: 'healthy',
        pageSpeedInsights: {
            configured: hasApiKey,
            quota: quotaStatus
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
