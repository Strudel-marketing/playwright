/**
 * Screenshot Routes Module
 * 
 * מגדיר את נקודות הקצה של ה-API עבור שירות צילומי המסך
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const screenshotService = require('./screenshotService');

// הגדרת multer להעלאת קבצים
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route   POST /api/screenshots/capture
 * @desc    לכידת צילום מסך מדף אינטרנט או מ-HTML
 * @access  Public
 */
router.post('/capture', async (req, res) => {
  const { url, html, options = {} } = req.body || {};
  if (!url && !html) {
    return res.status(400).json({ success: false, error: 'Either url or html is required' });
  }
  try {
    const finalOptions = {
      saveToFile: true,
      ...options,
      ...(html ? { html } : {}),
    };
    const results = await screenshotService.captureScreenshot(url || null, finalOptions);
    if (options?.returnBinary === true && results?.screenshot) {
      const isPng = (results.format || '').toLowerCase() === 'png';
      const base64 = results.screenshot.split(',')[1] || results.screenshot;
      const buf = Buffer.from(base64, 'base64');
      res.setHeader('Content-Type', isPng ? 'image/png' : 'image/jpeg');
      return res.send(buf);
    }
    if (results.filePath) {
      const filename = path.basename(results.filePath);
      results.screenshotUrl = `${req.protocol}://${req.get('host')}/screenshots/${filename}`;
    }
    res.json({ success: true, url: url || '[inline-html]', results });
  } catch (error) {
    console.error('❌ Screenshot capture error:', error);
    res.status(500).json({
      success: false,
      url: url || '[inline-html]',
      error: error.message || 'An error occurred during screenshot capture',
    });
  }
});

/**
 * @route   POST /api/screenshots/upload
 * @desc    העלאת צילום מסך מהמחשב
 * @access  Public
 */
router.post('/upload', upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded. Please upload a file with field name "screenshot"' 
      });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { description = 'manual-upload' } = req.body;

    // בדוק שזה תמונה
    if (!mimetype.startsWith('image/')) {
      return res.status(400).json({ 
        success: false, 
        error: 'File must be an image (jpeg, png, webp, etc.)' 
      });
    }

    // קבע פורמט קובץ
    let format = 'jpeg';
    if (mimetype.includes('png')) format = 'png';
    else if (mimetype.includes('webp')) format = 'webp';
    else if (mimetype.includes('gif')) format = 'gif';

    // צור שם קובץ ייחודי
    const urlHash = crypto.createHash('md5').update(description + Date.now()).digest('hex').substring(0, 8);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${urlHash}-${timestamp}.${format}`;

    // שמור את הקובץ
    const outputDir = './screenshots';
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, buffer);

    // צור URL לגישה
    const screenshotUrl = `${req.protocol}://${req.get('host')}/screenshots/${filename}`;

    // מידע על הקובץ
    const fileStats = fs.statSync(filePath);

    console.log(`📤 Screenshot uploaded: ${filename} (${fileStats.size} bytes)`);

    res.json({ 
      success: true,
      message: 'Screenshot uploaded successfully',
      results: {
        originalName: originalname,
        filename: filename,
        filePath: filePath,
        screenshotUrl: screenshotUrl,
        format: format,
        size: fileStats.size,
        description: description,
        timestamp: new Date().toISOString(),
        screenshot: `data:${mimetype};base64,${buffer.toString('base64')}`
      }
    });

  } catch (error) {
    console.error('❌ Screenshot upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during file upload',
    });
  }
});

/**
 * @route   POST /api/screenshots/multiple
 * @desc    לכידת צילומי מסך מרובים מדפים שונים (URL בלבד)
 * @access  Public
 */
router.post('/multiple', async (req, res) => {
  const { urls, options = {} } = req.body || {};
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'URLs array is required and must not be empty',
    });
  }
  try {
    const results = await screenshotService.captureMultipleScreenshots(urls, options);
    res.json({ success: true, results });
  } catch (error) {
    console.error('❌ Multiple screenshots capture error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during multiple screenshots capture',
    });
  }
});

/**
 * @route   POST /api/screenshots/responsive
 * @desc    לכידת צילומי מסך במספר גדלי מסך שונים (תומך גם ב-html)
 * @access  Public
 */
router.post('/responsive', async (req, res) => {
  const { url, html, viewports = [], options = {} } = req.body || {};
  if (!url && !html) {
    return res.status(400).json({ success: false, error: 'Either url or html is required' });
  }
  try {
    // אם זה HTML — נשתמש במזהה URL מדומה
    const results = await screenshotService.captureResponsiveScreenshots(url || '[inline-html]', viewports, {
      ...options,
      ...(html ? { html } : {}),
    });
    res.json({ success: true, url: url || '[inline-html]', results });
  } catch (error) {
    console.error('❌ Responsive screenshots capture error:', error);
    res.status(500).json({
      success: false,
      url: url || '[inline-html]',
      error: error.message || 'An error occurred during responsive screenshots capture',
    });
  }
});

/**
 * @route   GET /api/screenshots/list
 * @desc    רשימת צילומי מסך שמורים
 * @access  Public
 */
router.get('/list', async (req, res) => {
  try {
    const screenshotsDir = './screenshots';
    
    if (!fs.existsSync(screenshotsDir)) {
      return res.json({ 
        success: true, 
        screenshots: [],
        total: 0,
        message: 'Screenshots directory does not exist'
      });
    }

    const files = fs.readdirSync(screenshotsDir)
      .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
      .map(file => {
        const filePath = path.join(screenshotsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          url: `${req.protocol}://${req.get('host')}/screenshots/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({ 
      success: true, 
      screenshots: files,
      total: files.length
    });

  } catch (error) {
    console.error('❌ Error listing screenshots:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while listing screenshots',
    });
  }
});

module.exports = router;
