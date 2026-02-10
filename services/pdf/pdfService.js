const browserPool = require('../../utils/browserPool');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * PDF Generation Service
 *
 * המרת HTML או URL ל-PDF באיכות גבוהה באמצעות Playwright
 * תומך ב-assets מוטמעים, פונטים מותאמים, headers מותאמים, ו-debug mode
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * מיפוי ערכי waitUntil מ-Puppeteer style ל-Playwright style
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
 * זיהוי MIME type לפי סיומת קובץ
 * @param {string} filename - שם הקובץ
 * @returns {string} MIME type
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.avif': 'image/avif',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * החלפת הפניות ל-assets ב-HTML עם data URIs (inline base64)
 * שיטה זו עובדת עם page.setContent() בניגוד ל-file:// שחסום מטעמי אבטחה
 * @param {string} html - תוכן HTML
 * @param {Object} assets - מפה של שם-קובץ -> base64
 * @returns {string} HTML מעודכן עם data URIs
 */
function processAssets(html, assets) {
  let processed = html;

  for (const [filename, base64Data] of Object.entries(assets)) {
    // הסר data URI prefix אם קיים, ושמור את ה-base64 הנקי
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const mimeType = getMimeType(filename);
    const dataUri = `data:${mimeType};base64,${cleanBase64}`;

    // החלף כל הפניות לקובץ ב-HTML ל-data URI
    const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // מחליף src="filename", src='filename'
    processed = processed.replace(
      new RegExp(`src=["']${escaped}["']`, 'g'),
      `src="${dataUri}"`
    );

    // מחליף url(filename), url('filename'), url("filename") ב-CSS
    processed = processed.replace(
      new RegExp(`url\\(["']?${escaped}["']?\\)`, 'g'),
      `url('${dataUri}')`
    );
  }

  console.log(`📁 Processed ${Object.keys(assets).length} assets as inline data URIs`);
  return processed;
}

/**
 * יצירת CSS להטמעת פונטים
 * @param {Object} fonts - הגדרות פונטים
 * @returns {string} CSS string
 */
function buildFontCSS(fonts) {
  const parts = [];

  for (const [fontName, config] of Object.entries(fonts)) {
    if (config.source === 'google') {
      // Google Fonts via @import
      const weights = (config.weights || [400]).join(';');
      const family = encodeURIComponent(fontName);
      parts.push(`@import url('https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap');`);
    } else if (config.base64) {
      // Base64 embedded font
      const format = config.format || 'woff2';
      const weight = config.weight || 400;
      const style = config.style || 'normal';
      const cleanBase64 = config.base64.replace(/^data:[^;]+;base64,/, '');
      parts.push(`@font-face {
  font-family: '${fontName}';
  src: url(data:font/${format};base64,${cleanBase64}) format('${format}');
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
}`);
    }
  }

  return parts.join('\n');
}

/**
 * הגדרת route interception להוספת headers מותאמים לבקשות
 * @param {Object} page - Playwright page
 * @param {Object} requestHeaders - מפה של URL pattern -> headers
 * @param {Object} globalHeaders - headers גלובליים לכל הבקשות
 */
async function setupRequestHeaders(page, requestHeaders, globalHeaders) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const extraHeaders = {};

    // global headers
    if (globalHeaders) {
      Object.assign(extraHeaders, globalHeaders);
    }

    // pattern-specific headers
    if (requestHeaders) {
      for (const [pattern, headers] of Object.entries(requestHeaders)) {
        // המרת glob pattern פשוט ל-regex
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(url)) {
          Object.assign(extraHeaders, headers);
        }
      }
    }

    if (Object.keys(extraHeaders).length > 0) {
      await route.continue({ headers: { ...route.request().headers(), ...extraHeaders } });
    } else {
      await route.continue();
    }
  });

  console.log('🔒 Request headers interception configured');
}

/**
 * המתנה לטעינה מלאה: תמונות + פונטים
 * @param {Object} page - Playwright page
 * @param {Object} waitFor - אפשרויות המתנה
 */
async function waitForFullLoad(page, waitFor = {}) {
  const {
    networkIdle = true,
    fonts = true,
    images = true,
    timeout = 30000,
  } = waitFor;

  // networkidle
  if (networkIdle) {
    try {
      await page.waitForLoadState('networkidle', { timeout });
      console.log('✅ Network idle reached');
    } catch (err) {
      console.warn('⚠️ Network idle timeout, continuing...');
    }
  }

  // המתנה לכל התמונות
  if (images) {
    try {
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise(resolve => {
              img.onload = img.onerror = resolve;
            }))
        );
      });
      const imgCount = await page.evaluate(() => document.images.length);
      console.log(`✅ All images loaded (${imgCount} images)`);
    } catch (err) {
      console.warn('⚠️ Image loading wait failed:', err.message);
    }
  }

  // המתנה לפונטים
  if (fonts) {
    try {
      await page.evaluate(() => document.fonts.ready);
      const fontCount = await page.evaluate(() => document.fonts.size);
      console.log(`✅ All fonts loaded (${fontCount} fonts)`);
    } catch (err) {
      console.warn('⚠️ Font loading wait failed:', err.message);
    }
  }
}

/**
 * בניית אפשרויות PDF מאוחדות
 */
function buildPdfOptions(options) {
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
    pageRanges,
  } = options;

  const pdfOptions = {
    format,
    landscape,
    printBackground,
    displayHeaderFooter,
    preferCSSPageSize,
    scale: parseFloat(scale),
  };

  if (margin && Object.keys(margin).length > 0) {
    pdfOptions.margin = {
      top: margin.top || '0',
      right: margin.right || '0',
      bottom: margin.bottom || '0',
      left: margin.left || '0',
    };
  }

  if (displayHeaderFooter) {
    pdfOptions.headerTemplate = headerTemplate || '<div></div>';
    pdfOptions.footerTemplate = footerTemplate || '<div></div>';
  }

  if (width) pdfOptions.width = width;
  if (height) pdfOptions.height = height;
  if (pageRanges) pdfOptions.pageRanges = pageRanges;

  return pdfOptions;
}

/**
 * איסוף מידע debug
 */
async function collectDebugInfo(page, startTime) {
  const screenshot = await page.screenshot({ type: 'png', fullPage: true });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    devicePixelRatio: window.devicePixelRatio,
  }));
  const imagesLoaded = await page.evaluate(() =>
    Array.from(document.images).filter(img => img.complete).length
  );
  const fontsLoaded = await page.evaluate(() =>
    Array.from(document.fonts).map(f => `${f.family} ${f.weight}`)
  );

  return {
    screenshot: screenshot.toString('base64'),
    dimensions,
    loadTime: Date.now() - startTime,
    imagesLoaded,
    fontsLoaded,
  };
}

// ─── Main Functions ─────────────────────────────────────────────────────────

/**
 * המרת HTML ל-PDF
 * @param {string} html - תוכן HTML להמרה
 * @param {Object} params - כל הפרמטרים (options, assets, fonts, headers, waitFor, debug)
 * @param {string} returnType - סוג ההחזרה: "base64", "buffer", או "file"
 * @returns {Promise<Object>}
 */
async function generatePDF(html, params = {}, returnType = 'base64') {
  const startTime = Date.now();
  console.log('📄 Generating PDF from HTML content');

  const {
    options = {},
    assets,
    fonts,
    requestHeaders,
    globalHeaders,
    waitFor = {},
    debug = false,
  } = params;

  // backward compatibility: אם params הוא options ישירות (בלי assets/fonts)
  const actualOptions = options.format || options.margin || options.landscape !== undefined
    ? options
    : params;

  const {
    deviceScaleFactor = 1,
    viewportWidth = 1280,
    viewportHeight = 800,
    waitUntil,
    timeout = 30000,
  } = actualOptions;

  const { page, context, id } = await browserPool.getPage();

  try {
    // viewport
    await page.setViewportSize({
      width: parseInt(viewportWidth),
      height: parseInt(viewportHeight),
    });

    // request headers interception
    if (requestHeaders || globalHeaders) {
      await setupRequestHeaders(page, requestHeaders, globalHeaders);
    }

    // assets -> inline data URIs
    let processedHtml = html;
    if (assets && Object.keys(assets).length > 0) {
      processedHtml = processAssets(processedHtml, assets);
    }

    // fonts -> inject CSS
    if (fonts && Object.keys(fonts).length > 0) {
      const fontCSS = buildFontCSS(fonts);
      processedHtml = processedHtml.replace(
        /(<head[^>]*>)/i,
        `$1<style>${fontCSS}</style>`
      );
      // אם אין <head>, הוסף בתחילת ה-HTML
      if (!/<head/i.test(processedHtml)) {
        processedHtml = `<style>${fontCSS}</style>${processedHtml}`;
      }
      console.log(`🔤 Injected ${Object.keys(fonts).length} font definitions`);
    }

    // load content
    const chosenWaitUntil = waitUntil ? normalizeWaitUntil(waitUntil) : 'networkidle';
    const navTimeout = parseInt(timeout);

    console.log('📄 Loading HTML content for PDF generation');
    await page.setContent(processedHtml, {
      waitUntil: chosenWaitUntil,
      timeout: navTimeout,
    });

    // full load waiting
    await waitForFullLoad(page, {
      networkIdle: waitFor.networkIdle !== false,
      fonts: waitFor.fonts !== false,
      images: waitFor.images !== false,
      timeout: navTimeout,
    });

    // debug info (before PDF)
    let debugInfo = null;
    if (debug) {
      debugInfo = await collectDebugInfo(page, startTime);
    }

    // generate PDF
    const pdfOptions = buildPdfOptions(actualOptions);
    const pdfBuffer = await page.pdf(pdfOptions);

    console.log(`✅ PDF generated successfully (${pdfBuffer.length} bytes, ${Date.now() - startTime}ms)`);

    const result = formatResult(pdfBuffer, returnType);
    if (debugInfo) result.debug = debugInfo;
    return result;
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
 * @param {Object} params - כל הפרמטרים
 * @param {string} returnType - סוג ההחזרה
 * @returns {Promise<Object>}
 */
async function generatePDFFromUrl(url, params = {}, returnType = 'base64') {
  const startTime = Date.now();
  console.log(`📄 Generating PDF from URL: ${url}`);

  const {
    options = {},
    requestHeaders,
    globalHeaders,
    waitFor = {},
    debug = false,
  } = params;

  const actualOptions = options.format || options.margin || options.landscape !== undefined
    ? options
    : params;

  const {
    deviceScaleFactor = 1,
    viewportWidth = 1280,
    viewportHeight = 800,
    waitUntil = 'networkidle',
    timeout = 30000,
  } = actualOptions;

  const { page, context, id } = await browserPool.getPage();

  try {
    // viewport
    await page.setViewportSize({
      width: parseInt(viewportWidth),
      height: parseInt(viewportHeight),
    });

    // request headers interception
    if (requestHeaders || globalHeaders) {
      await setupRequestHeaders(page, requestHeaders, globalHeaders);
    }

    // navigate
    const chosenWaitUntil = normalizeWaitUntil(waitUntil);
    const navTimeout = parseInt(timeout);

    console.log(`🌐 Navigating to: ${url}`);
    await browserPool.safeNavigate(page, url, {
      waitUntil: chosenWaitUntil,
      timeout: navTimeout,
    });

    // full load waiting
    await waitForFullLoad(page, {
      networkIdle: waitFor.networkIdle !== false,
      fonts: waitFor.fonts !== false,
      images: waitFor.images !== false,
      timeout: navTimeout,
    });

    // debug info
    let debugInfo = null;
    if (debug) {
      debugInfo = await collectDebugInfo(page, startTime);
    }

    // generate PDF
    const pdfOptions = buildPdfOptions(actualOptions);
    const pdfBuffer = await page.pdf(pdfOptions);

    console.log(`✅ PDF generated from URL successfully (${pdfBuffer.length} bytes, ${Date.now() - startTime}ms)`);

    const result = formatResult(pdfBuffer, returnType, url);
    if (debugInfo) result.debug = debugInfo;
    return result;
  } catch (error) {
    console.error(`❌ Error generating PDF from URL ${url}:`, error);
    throw error;
  } finally {
    await browserPool.releasePage(id);
  }
}

/**
 * עיצוב התוצאה לפי סוג ההחזרה המבוקש
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
