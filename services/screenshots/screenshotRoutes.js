/**
 * Screenshot Routes Module
 * 
 * מגדיר את נקודות הקצה של ה-API עבור שירות צילומי המסך
 */

const express = require('express');
const router = express.Router();
const screenshotService = require('./screenshotService');

/**
 * @route   POST /api/screenshots/capture
 * @desc    לכידת צילום מסך מדף אינטרנט
 * @access  Public
 */
router.post('/capture', async (req, res) => {
    const { url, options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    try {
        const results = await screenshotService.captureScreenshot(url, options);
        
        res.json({
            success: true,
            url,
            results
        });
    } catch (error) {
        console.error('❌ Screenshot capture error:', error);
        
        res.status(500).json({
            success: false,
            url,
            error: error.message || 'An error occurred during screenshot capture'
        });
    }
});

/**
 * @route   POST /api/screenshots/multiple
 * @desc    לכידת צילומי מסך מרובים מדפים שונים
 * @access  Public
 */
router.post('/multiple', async (req, res) => {
    const { urls, options = {} } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'URLs array is required and must not be empty'
        });
    }
    
    try {
        const results = await screenshotService.captureMultipleScreenshots(urls, options);
        
        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('❌ Multiple screenshots capture error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'An error occurred during multiple screenshots capture'
        });
    }
});

/**
 * @route   POST /api/screenshots/responsive
 * @desc    לכידת צילומי מסך במספר גדלי מסך שונים
 * @access  Public
 */
router.post('/responsive', async (req, res) => {
    const { url, viewports = [], options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    try {
        const results = await screenshotService.captureResponsiveScreenshots(url, viewports, options);
        
        res.json({
            success: true,
            url,
            results
        });
    } catch (error) {
        console.error('❌ Responsive screenshots capture error:', error);
        
        res.status(500).json({
            success: false,
            url,
            error: error.message || 'An error occurred during responsive screenshots capture'
        });
    }
});

module.exports = router;
