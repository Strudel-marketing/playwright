/**
 * SEO Routes Module
 * 
 * מגדיר את נקודות הקצה של ה-API עבור שירות ה-SEO
 */

const express = require('express');
const router = express.Router();
const seoService = require('./seoService');
const siteAuditService = require('./siteAuditService');

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
          includeScreenshot: includeScreenshot !== false,
          waitUntil: options?.waitUntil || 'networkidle',
          timeout: options?.timeout || 60000,
          blockThirdParties: options?.blockThirdParties !== false,
          includeMobile: options?.includeMobile || false,
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

/**
 * @route   POST /api/seo/site-audit
 * @desc    ביצוע ניתוח SEO site-wide - סריקת כל העמודים באתר
 * @access  Public
 */
router.post('/site-audit', async (req, res) => {
    console.log('🔍 Site Audit started for:', req.body.url);

    const { url, options = {} } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    try {
        // Accept params from both top-level body and nested options
        const opts = { ...req.body, ...options };
        const results = await siteAuditService.performSiteAudit(url, {
            maxPages: opts.maxPages || 500,
            maxDepth: opts.maxDepth || 5,
            validateBrokenLinks: opts.validateBrokenLinks !== false,
            linkValidationConcurrency: opts.linkValidationConcurrency || 10,
            pageConcurrency: opts.pageConcurrency || 3,
            skipLinkDomains: opts.skipLinkDomains || undefined,
            includeScreenshots: opts.includeScreenshots || false,
            includeMobile: opts.includeMobile || false,
            timeout: opts.timeout || 30000
        });

        res.json(results);
    } catch (error) {
        console.error('❌ Site Audit error:', error);

        res.status(500).json({
            success: false,
            url,
            error: error.message || 'An error occurred during the site audit'
        });
    }
});

module.exports = router;
