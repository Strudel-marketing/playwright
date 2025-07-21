const express = require('express');
const router = express.Router();
const compareService = require('./compareService');

/**
 * @route POST /api/comparison/visual
 * @description Compare two URLs visually by capturing screenshots and generating a diff image
 * @access Public
 */
router.post('/visual', async (req, res) => {
  try {
    const { url1, url2, options } = req.body;
    
    if (!url1 || !url2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both URL parameters (url1 and url2) are required' 
      });
    }

    const result = await compareService.compareVisually(url1, url2, options);
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      comparison: result
    });
  } catch (error) {
    console.error('Visual comparison error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error performing visual comparison' 
    });
  }
});

/**
 * @route POST /api/comparison/content
 * @description Compare the content of two URLs (text, headings, meta tags, etc.)
 * @access Public
 */
router.post('/content', async (req, res) => {
  try {
    const { url1, url2, options } = req.body;
    
    if (!url1 || !url2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both URL parameters (url1 and url2) are required' 
      });
    }

    const result = await compareService.compareContent(url1, url2, options);
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      comparison: result
    });
  } catch (error) {
    console.error('Content comparison error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error performing content comparison' 
    });
  }
});

/**
 * @route POST /api/comparison/structure
 * @description Compare the DOM structure of two URLs
 * @access Public
 */
router.post('/structure', async (req, res) => {
  try {
    const { url1, url2, options } = req.body;
    
    if (!url1 || !url2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both URL parameters (url1 and url2) are required' 
      });
    }

    const result = await compareService.compareStructure(url1, url2, options);
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      comparison: result
    });
  } catch (error) {
    console.error('Structure comparison error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error performing structure comparison' 
    });
  }
});

/**
 * @route POST /api/comparison/full
 * @description Perform a comprehensive comparison of two URLs (visual, content, and structure)
 * @access Public
 */
router.post('/full', async (req, res) => {
  try {
    const { url1, url2, options } = req.body;
    
    if (!url1 || !url2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both URL parameters (url1 and url2) are required' 
      });
    }

    // Run all comparison types in parallel
    const [visualResult, contentResult, structureResult] = await Promise.all([
      compareService.compareVisually(url1, url2, options),
      compareService.compareContent(url1, url2, options),
      compareService.compareStructure(url1, url2, options)
    ]);
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      comparison: {
        visual: visualResult,
        content: contentResult,
        structure: structureResult,
        summary: {
          visualDifference: visualResult.diffPercentage,
          contentDifference: contentResult.overallSimilarity,
          structureDifference: structureResult.overallSimilarity,
          urls: {
            url1,
            url2
          }
        }
      }
    });
  } catch (error) {
    console.error('Full comparison error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error performing full comparison' 
    });
  }
});

module.exports = router;
