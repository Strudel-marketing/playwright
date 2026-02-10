/**
 * PDF Routes Module
 *
 * מגדיר את נקודות הקצה של ה-API עבור שירות יצירת PDF
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pdfService = require('./pdfService');

/**
 * @route   POST /api/pdf/generate
 * @desc    המרת HTML ל-PDF עם תמיכה ב-assets, fonts, headers, ו-debug
 * @access  Protected (API Key)
 */
router.post('/generate', async (req, res) => {
  const {
    html,
    options = {},
    assets,
    fonts,
    requestHeaders,
    globalHeaders,
    waitFor,
    debug = false,
    returnType = 'base64',
  } = req.body || {};

  if (!html) {
    return res.status(400).json({
      success: false,
      error: 'html is required',
    });
  }

  try {
    const params = { options, assets, fonts, requestHeaders, globalHeaders, waitFor, debug };
    const result = await pdfService.generatePDF(html, params, returnType);

    // אם returnType הוא buffer, שלח את ה-PDF כ-binary
    if (returnType === 'buffer') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.data);
    }

    // אם returnType הוא file, הוסף URL לגישה
    if (returnType === 'file' && result.data) {
      const filename = path.basename(result.data);
      result.fileUrl = `${req.protocol}://${req.get('host')}/pdfs/${filename}`;
    }

    res.json({
      success: true,
      data: result.data,
      filename: result.filename,
      size: result.size,
      timestamp: result.timestamp,
      ...(result.fileUrl ? { fileUrl: result.fileUrl } : {}),
      ...(result.debug ? { debug: result.debug } : {}),
    });
  } catch (error) {
    console.error('❌ PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during PDF generation',
    });
  }
});

/**
 * @route   POST /api/pdf/from-url
 * @desc    המרת URL ל-PDF עם תמיכה ב-headers ו-debug
 * @access  Protected (API Key)
 */
router.post('/from-url', async (req, res) => {
  const {
    url,
    options = {},
    requestHeaders,
    globalHeaders,
    waitFor,
    debug = false,
    returnType = 'base64',
  } = req.body || {};

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'url is required',
    });
  }

  try {
    const params = { options, requestHeaders, globalHeaders, waitFor, debug };
    const result = await pdfService.generatePDFFromUrl(url, params, returnType);

    // אם returnType הוא buffer, שלח את ה-PDF כ-binary
    if (returnType === 'buffer') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.data);
    }

    // אם returnType הוא file, הוסף URL לגישה
    if (returnType === 'file' && result.data) {
      const filename = path.basename(result.data);
      result.fileUrl = `${req.protocol}://${req.get('host')}/pdfs/${filename}`;
    }

    res.json({
      success: true,
      url,
      data: result.data,
      filename: result.filename,
      size: result.size,
      timestamp: result.timestamp,
      ...(result.fileUrl ? { fileUrl: result.fileUrl } : {}),
      ...(result.debug ? { debug: result.debug } : {}),
    });
  } catch (error) {
    console.error('❌ PDF from URL error:', error);
    res.status(500).json({
      success: false,
      url,
      error: error.message || 'An error occurred during PDF generation from URL',
    });
  }
});

/**
 * @route   GET /api/pdf/list
 * @desc    רשימת PDF שמורים
 * @access  Protected (API Key)
 */
router.get('/list', async (req, res) => {
  try {
    const pdfsDir = './pdfs';

    if (!fs.existsSync(pdfsDir)) {
      return res.json({
        success: true,
        pdfs: [],
        total: 0,
        message: 'PDFs directory does not exist',
      });
    }

    const files = fs.readdirSync(pdfsDir)
      .filter(file => /\.pdf$/i.test(file))
      .map(file => {
        const filePath = path.join(pdfsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          url: `${req.protocol}://${req.get('host')}/pdfs/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({
      success: true,
      pdfs: files,
      total: files.length,
    });
  } catch (error) {
    console.error('❌ Error listing PDFs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while listing PDFs',
    });
  }
});

module.exports = router;
