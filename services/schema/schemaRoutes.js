/**
 * Schema Routes Module
 * 
 * מגדיר את נקודות הקצה של ה-API עבור שירות חילוץ הסכמות
 */

const express = require('express');
const router = express.Router();
const schemaService = require('./schemaService');

/**
 * @route   POST /api/schema/extract
 * @desc    חילוץ סכמות מובנות מדף אינטרנט
 * @access  Public
 */
router.post('/schema', async (req, res) => {
    const { url, options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }
    
    try {
        const results = await schemaService.extractSchema(url, options);
        
        res.json({
            success: true,
            url,
            results
        });
    } catch (error) {
        console.error('❌ Schema extraction error:', error);
        
        res.status(500).json({
            success: false,
            url,
            error: error.message || 'An error occurred during schema extraction'
        });
    }
});

/**
 * @route   POST /api/schema/quick-check
 * @desc    בדיקה מהירה של סכמות באתר
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
        const results = await schemaService.quickCheck(url);
        
        res.json({
            success: true,
            url,
            results
        });
    } catch (error) {
        console.error('❌ Quick schema check error:', error);
        
        res.status(500).json({
            success: false,
            url,
            error: error.message || 'An error occurred during the quick schema check'
        });
    }
});

module.exports = router;
