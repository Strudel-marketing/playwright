const express = require('express');
const router = express.Router();
const { extractPAAQuestions, extractBingPAAQuestions, getPAAStatus } = require('./paaService');

/**
 * POST /api/paa
 * Extract People Also Ask questions from Google
 */
router.post('/', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                success: false, 
                error: 'Query parameter is required' 
            });
        }

        const clientIP = req.ip || req.connection.remoteAddress;
        const result = await extractPAAQuestions(query, clientIP);
        
        res.json(result);

    } catch (error) {
        console.error('PAA extraction error:', error);
        
        if (error.message.includes('Rate limit')) {
            return res.status(429).json({
                success: false,
                error: error.message,
                retryAfter: 30
            });
        }
        
        if (error.message.includes('blocked')) {
            return res.status(503).json({
                success: false,
                error: error.message,
                blocked: true,
                retryAfter: 3600
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to extract PAA questions',
            details: error.message
        });
    }
});

/**
 * POST /api/paa/bing
 * Extract PAA questions from Bing
 */
router.post('/bing', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                success: false, 
                error: 'Query parameter is required' 
            });
        }

        const clientIP = req.ip || req.connection.remoteAddress;
        const result = await extractBingPAAQuestions(query, clientIP, false);
        
        res.json(result);

    } catch (error) {
        console.error('Bing PAA extraction error:', error);
        
        if (error.message.includes('Rate limit')) {
            return res.status(429).json({
                success: false,
                error: error.message,
                retryAfter: 30
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to extract Bing PAA questions',
            details: error.message
        });
    }
});

/**
 * POST /api/paa/bing/debug
 * Extract PAA questions from Bing with debug mode (non-headless)
 */
router.post('/bing/debug', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                success: false, 
                error: 'Query parameter is required' 
            });
        }

        const clientIP = req.ip || req.connection.remoteAddress;
        const result = await extractBingPAAQuestions(query, clientIP, true);
        
        res.json(result);

    } catch (error) {
        console.error('Bing PAA debug extraction error:', error);
        
        if (error.message.includes('Rate limit')) {
            return res.status(429).json({
                success: false,
                error: error.message,
                retryAfter: 30
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to extract Bing PAA questions (debug)',
            details: error.message
        });
    }
});

/**
 * POST /api/paa/debug
 * Extract PAA questions from Google with debug mode
 */
router.post('/debug', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                success: false, 
                error: 'Query parameter is required' 
            });
        }

        console.log('🐛 Debug mode: PAA extraction with detailed logging');
        
        const clientIP = req.ip || req.connection.remoteAddress;
        const result = await extractPAAQuestions(query, clientIP);
        
        // Add debug information
        result.debug = {
            mode: 'debug',
            clientIP: clientIP,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        };
        
        res.json(result);

    } catch (error) {
        console.error('PAA debug extraction error:', error);
        
        if (error.message.includes('Rate limit')) {
            return res.status(429).json({
                success: false,
                error: error.message,
                retryAfter: 30,
                debug: {
                    mode: 'debug',
                    clientIP: req.ip || req.connection.remoteAddress,
                    timestamp: new Date().toISOString()
                }
            });
        }
        
        if (error.message.includes('blocked')) {
            return res.status(503).json({
                success: false,
                error: error.message,
                blocked: true,
                retryAfter: 3600,
                debug: {
                    mode: 'debug',
                    clientIP: req.ip || req.connection.remoteAddress,
                    timestamp: new Date().toISOString()
                }
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to extract PAA questions (debug)',
            details: error.message,
            debug: {
                mode: 'debug',
                clientIP: req.ip || req.connection.remoteAddress,
                timestamp: new Date().toISOString()
            }
        });
    }
});

/**
 * GET /api/paa/status
 * Get PAA service status
 */
router.get('/status', async (req, res) => {
    try {
        const status = getPAAStatus();
        res.json(status);
    } catch (error) {
        console.error('PAA status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get PAA service status',
            details: error.message
        });
    }
});

module.exports = router;
