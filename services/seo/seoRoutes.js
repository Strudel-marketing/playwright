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
 * Build the option bag that performSiteAudit() expects from a raw request body.
 * Accepts params from both top-level body and nested `options`.
 */
function buildAuditOptions(body, { forceMode } = {}) {
    const opts = { ...body, ...(body.options || {}) };
    const mode = forceMode || opts.mode; // 'site' | 'single_page' | undefined

    return {
        mode,
        maxPages: opts.maxPages,
        maxDepth: opts.maxDepth,
        validateBrokenLinks: opts.validateBrokenLinks,
        linkValidationConcurrency: opts.linkValidationConcurrency,
        pageConcurrency: opts.pageConcurrency,
        skipLinkDomains: opts.skipLinkDomains,
        includeScreenshots: opts.includeScreenshots ?? opts.includeScreenshot,
        includeMobile: opts.includeMobile,
        timeout: opts.timeout
    };
}

/**
 * @route   POST /api/seo/site-audit
 * @desc    Unified SEO audit — single source of truth.
 *          Supports both a full-site crawl (default) and a single-page audit.
 *
 *          Modes (request body):
 *            { url, mode: "site" }         → crawl whole site (default)
 *            { url, mode: "single_page" }  → audit only this URL
 *            { url, maxPages: 1 }          → implicitly single_page
 *
 *          Response shape (identical for both modes):
 *            { success, audit_url, domain, mode, timestamp, execution_time,
 *              total_pages, failed_pages, failed_urls, summary, pages: [...] }
 *
 *          Every entry in `pages` is a snake_case object produced by
 *          siteAuditService.normalizePage() — there is only one shape.
 * @access  Public
 */
router.post('/site-audit', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    const options = buildAuditOptions(req.body);
    console.log(`🔍 Site Audit started for: ${url} (mode: ${options.mode || (options.maxPages === 1 ? 'single_page' : 'site')})`);

    try {
        const results = await siteAuditService.performSiteAudit(url, options);
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

/**
 * @route   POST /api/seo/audit
 * @desc    DEPRECATED alias for POST /api/seo/site-audit with mode=single_page.
 *          Kept for backward compatibility — always returns the unified
 *          site-audit response shape (never the legacy nested camelCase shape).
 *          New callers should use /api/seo/site-audit directly.
 * @access  Public
 */
router.post('/audit', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    const options = buildAuditOptions(req.body, { forceMode: 'single_page' });
    console.log(`🔍 SEO Audit (single_page alias) started for: ${url}`);

    try {
        const results = await siteAuditService.performSiteAudit(url, options);
        res.json(results);
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
