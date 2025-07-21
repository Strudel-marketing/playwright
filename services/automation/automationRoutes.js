const express = require('express');
const router = express.Router();
const automationService = require('./automationService');

/**
 * @route POST /api/automation/execute
 * @description Execute a sequence of actions on a web page
 * @access Public
 */
router.post('/execute', async (req, res) => {
  try {
    const { url, actions, options } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL parameter is required' 
      });
    }
    
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Actions array is required and must contain at least one action' 
      });
    }

    const result = await automationService.executeActionSequence(url, actions, options || {});
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      automation: result
    });
  } catch (error) {
    console.error('Action sequence execution error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error executing action sequence' 
    });
  }
});

/**
 * @route POST /api/automation/form
 * @description Fill and submit a form
 * @access Public
 */
router.post('/form', async (req, res) => {
  try {
    const { url, formData, options } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL parameter is required' 
      });
    }
    
    if (!formData || typeof formData !== 'object' || Object.keys(formData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Form data object is required and must contain at least one field' 
      });
    }

    const result = await automationService.fillForm(url, formData, options || {});
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      formSubmission: result
    });
  } catch (error) {
    console.error('Form submission error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error submitting form' 
    });
  }
});

/**
 * @route POST /api/automation/extract
 * @description Extract data from multiple pages by following pagination
 * @access Public
 */
router.post('/extract', async (req, res) => {
  try {
    const { url, extractionConfig, options } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL parameter is required' 
      });
    }
    
    if (!extractionConfig || typeof extractionConfig !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Extraction configuration object is required' 
      });
    }
    
    if (!extractionConfig.itemSelector) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item selector is required in extraction configuration' 
      });
    }

    const result = await automationService.extractDataWithPagination(url, extractionConfig, options || {});
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      extraction: result
    });
  } catch (error) {
    console.error('Data extraction error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error extracting data' 
    });
  }
});

/**
 * @route POST /api/automation/monitor
 * @description Monitor a webpage for changes
 * @access Public
 */
router.post('/monitor', async (req, res) => {
  try {
    const { url, monitorConfig } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL parameter is required' 
      });
    }
    
    if (!monitorConfig || typeof monitorConfig !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Monitor configuration object is required' 
      });
    }

    const result = await automationService.monitorPageChanges(url, monitorConfig);
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      monitoring: result
    });
  } catch (error) {
    console.error('Page monitoring error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error monitoring page' 
    });
  }
});

/**
 * @route POST /api/automation/analyze-forms
 * @description Analyze all forms on a page for automation purposes
 * @access Public
 */
router.post('/analyze-forms', async (req, res) => {
  try {
    const { url, options } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL parameter is required' 
      });
    }

    const result = await automationService.analyzeFormsOnPage(url, options || {});
    
    return res.json(result);
  } catch (error) {
    console.error('Form analysis error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error analyzing forms' 
    });
  }
});

module.exports = router;
