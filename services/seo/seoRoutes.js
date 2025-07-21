/**
 * SEO Routes Module
 * 
 * מגדיר את נקודות הקצה של ה-API עבור שירות ה-SEO
 */

const express = require('express');
const router = express.Router();
const seoService = require('./seoService');

/**
 * @route   POST /api/seo/audit
 * @desc    ביצוע ניתוח SEO מלא לאתר
 * @access  Public
 */
router.post('/audit', async (req, res) => {
    console.log('🔍 SEO Audit started for:', req.body.url);
    
    const { url, includeScreenshot = true, options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    try {
        const results = await seoService.performSeoAudit(url, { 
            includeScreenshot,
            ...options
        });
        
        res.json({
            success: true,
            url,
            results
        });
    } catch (error) {
        console.error('❌ SEO Audit error:', error);
        
        res.status(500).json({
            success: false,
            url,
            error: error.message || 'An error occurred during the SEO audit'
        });
    }
});

/**
 * @route   POST /api/seo/quick-check
 * @desc    בדיקה מהירה של מטא-תגיות SEO
 * @access  Public
 */
router.post('/quick-check', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    try {
        const results = await seoService.quickCheck(url);
        
        res.json({
            success: true,
            url,
            results
        });
    } catch (error) {
        console.error('❌ Quick SEO check error:', error);
        
        res.status(500).json({
            success: false,
            url,
            error: error.message || 'An error occurred during the quick SEO check'
        });
    }
});

module.exports = router;
