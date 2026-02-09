const browserPool = require('../../utils/browserPool');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * PDF Generation Service
 *
 * המרת HTML או URL ל-PDF באיכות גבוהה באמצעות Playwright
 */

/**
 * מיפוי ערכי waitUntil מ-Puppeteer style ל-Playwright style
 * @param {string} waitUntil
 * @returns {string}
 */
function normalizeWaitUntil(waitUntil) {
  const mapping = {
    'networkidle0': 'networkidle',
    'networkidle2': 'networkidle',
    'load': 'load',
    'domcontentloaded': 'domcontentloaded',
    'networkidle': 'networkidle',
  };
  return mapping[waitUntil] || 'networkidle';
}

/**
 * המרת HTML ל-PDF
 * @param {string} html - תוכן HTML להמרה
 * @param {Object} options - אפשרויות PDF
 * @param {string} returnType - סוג ההחזרה: "base64", "buffer", או "file"
 * @returns {Promise<Object>}
 */
async function generatePDF(html, options = {}, returnType = 'base64') {
  console.log('📄 Generating PDF from HTML content');

  const {
    format = 'A4',
    landscape = false,
    margin = {},
    printBackground = true,
    displayHeaderFooter = false,
    headerTemplate = '',
    footerTemplate = '',
    preferCSSPageSize = false,
    scale = 1,
    width,
    height,
    waitUntil,
    timeout = 30000,
  } = options;

  const { page, context, id } = await browserPool.getPage();

  try {
    const chosenWaitUntil = waitUntil ? normalizeWaitUntil(waitUntil) : 'domcontentloaded';
    const navTimeout = parseInt(timeout);

    console.log('📄 Loading HTML content for PDF generation');
    await page.setContent(html, {
      waitUntil: chosenWaitUntil,
      timeout: navTimeout,
    });

    await page.waitForLoadState(chosenWaitUntil);

    // הגדרת אפשרויות PDF
    const pdfOptions = {
      format,
      landscape,
      printBackground,
      displayHeaderFooter,
      preferCSSPageSize,
      scale: parseFloat(scale),
    };

    // margin
    if (margin && Object.keys(margin).length > 0) {
      pdfOptions.margin = {
        top: margin.top || '0',
        right: margin.right || '0',
        bottom: margin.bottom || '0',
        left: margin.left || '0',
      };
    }

    // header/footer templates
    if (displayHeaderFooter) {
      pdfOptions.headerTemplate = headerTemplate || '<div></div>';
      pdfOptions.footerTemplate = footerTemplate || '<div></div>';
    }

    // custom width/height (overrides format)
    if (width) pdfOptions.width = width;
    if (height) pdfOptions.height = height;

    const pdfBuffer = await page.pdf(pdfOptions);

    console.log(`✅ PDF generated successfully (${pdfBuffer.length} bytes)`);

    return formatResult(pdfBuffer, returnType);
  } catch (error) {
    console.error('❌ Error generating PDF from HTML:', error);
    throw error;
  } finally {
    await browserPool.releasePage(id);
  }
}

/**
 * המרת URL ל-PDF
 * @param {string} url - כתובת URL להמרה
 * @param {Object} options - אפשרויות PDF
 * @param {string} returnType - סוג ההחזרה: "base64", "buffer", או "file"
 * @returns {Promise<Object>}
 */
async function generatePDFFromUrl(url, options = {}, returnType = 'base64') {
  console.log(`📄 Generating PDF from URL: ${url}`);

  const {
    format = 'A4',
    landscape = false,
    margin = {},
    printBackground = true,
    displayHeaderFooter = false,
    headerTemplate = '',
    footerTemplate = '',
    preferCSSPageSize = false,
    scale = 1,
    width,
    height,
    waitUntil = 'networkidle',
    timeout = 30000,
  } = options;

  const { page, context, id } = await browserPool.getPage();

  try {
    const chosenWaitUntil = normalizeWaitUntil(waitUntil);
    const navTimeout = parseInt(timeout);

    console.log(`🌐 Navigating to: ${url}`);
    await browserPool.safeNavigate(page, url, {
      waitUntil: chosenWaitUntil,
      timeout: navTimeout,
    });

    await page.waitForLoadState(chosenWaitUntil);

    // הגדרת אפשרויות PDF
    const pdfOptions = {
      format,
      landscape,
      printBackground,
      displayHeaderFooter,
      preferCSSPageSize,
      scale: parseFloat(scale),
    };

    // margin
    if (margin && Object.keys(margin).length > 0) {
      pdfOptions.margin = {
        top: margin.top || '0',
        right: margin.right || '0',
        bottom: margin.bottom || '0',
        left: margin.left || '0',
      };
    }

    // header/footer templates
    if (displayHeaderFooter) {
      pdfOptions.headerTemplate = headerTemplate || '<div></div>';
      pdfOptions.footerTemplate = footerTemplate || '<div></div>';
    }

    // custom width/height (overrides format)
    if (width) pdfOptions.width = width;
    if (height) pdfOptions.height = height;

    const pdfBuffer = await page.pdf(pdfOptions);

    console.log(`✅ PDF generated from URL successfully (${pdfBuffer.length} bytes)`);

    return formatResult(pdfBuffer, returnType, url);
  } catch (error) {
    console.error(`❌ Error generating PDF from URL ${url}:`, error);
    throw error;
  } finally {
    await browserPool.releasePage(id);
  }
}

/**
 * עיצוב התוצאה לפי סוג ההחזרה המבוקש
 * @param {Buffer} pdfBuffer - Buffer של ה-PDF
 * @param {string} returnType - סוג ההחזרה
 * @param {string|null} sourceUrl - URL מקור (אופציונלי)
 * @returns {Object}
 */
function formatResult(pdfBuffer, returnType = 'base64', sourceUrl = null) {
  const timestamp = new Date().toISOString();
  const hash = crypto.createHash('md5').update(timestamp + Math.random().toString()).digest('hex').substring(0, 8);
  const filename = `generated-pdf-${hash}.pdf`;

  if (returnType === 'file') {
    const outputDir = './pdfs';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, pdfBuffer);
    console.log(`📁 PDF saved to file: ${filePath}`);

    return {
      data: filePath,
      filename,
      size: pdfBuffer.length,
      timestamp,
      sourceUrl,
    };
  }

  if (returnType === 'buffer') {
    return {
      data: pdfBuffer,
      filename,
      size: pdfBuffer.length,
      timestamp,
      sourceUrl,
    };
  }

  // default: base64
  return {
    data: pdfBuffer.toString('base64'),
    filename,
    size: pdfBuffer.length,
    timestamp,
    sourceUrl,
  };
}

module.exports = {
  generatePDF,
  generatePDFFromUrl,
};
