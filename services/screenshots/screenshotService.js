/**
 * Screenshot Service Module
 * 
 * מספק פונקציונליות ללכידת צילומי מסך מדפי אינטרנט או מ-HTML ישיר
 */

const browserPool = require('../../utils/browserPool');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// רשימת Webshare proxies
const webshareProxies = [
  { server: 'http://23.95.150.145:6114', username: 'sohnypch', password: 'o6ew6jbux75e' },
  { server: 'http://198.23.239.134:6540', username: 'sohnypch', password: 'o6ew6jbux75e' },
  { server: 'http://107.172.163.27:6543', username: 'sohnypch', password: 'o6ew6jbux75e' },
  { server: 'http://64.137.96.74:6641', username: 'sohnypch', password: 'o6ew6jbux75e' },
  { server: 'http://45.43.186.39:6257', username: 'sohnypch', password: 'o6ew6jbux75e' },
  { server: 'http://216.10.27.159:6837', username: 'sohnypch', password: 'o6ew6jbux75e' },
  { server: 'http://136.0.207.84:6661', username: 'sohnypch', password: 'o6ew6jbux75e' },
  { server: 'http://142.147.128.93:6593', username: 'sohnypch', password: 'o6ew6jbux75e' }
];

function getRandomProxy() {
  return webshareProxies[Math.floor(Math.random() * webshareProxies.length)];
}

/**
 * לכידת צילום מסך מדף אינטרנט או מ-HTML
 * @param {string|null} url - כתובת האתר ללכידה (יכול להיות null אם שולחים options.html)
 * @param {Object} options - אפשרויות נוספות
 *    options.html - מחרוזת HTML לטעינה ישירה (page.setContent)
 *    options.waitUntil - 'networkidle' או 'domcontentloaded' (ברירת מחדל: ל-HTML domcontentloaded, ל-URL networkidle)
 *    options.disableJavaScript - ביטול JS בדף (ברירת מחדל: false)
 *    options.blockPopups - חסימת media/fonts וכו' (ברירת מחדל: true)
 *    options.ignoreHTTPSErrors - התעלמות משגיאות HTTPS (ברירת מחדל: true)
 *    options.useProxy - שימוש ב-proxy rotation (ברירת מחדל: false)
 *    options.stealthMode - מצב stealth לעקיפת זיהוי bots (ברירת מחדל: false)
 * @returns {Promise<Object>}
 */
async function captureScreenshot(url, options = {}) {
  console.log(`📸 Capturing screenshot for: ${url || '[inline-html]'}`);

  const {
    fullPage = true,
    format = 'jpeg',
    quality = 80,
    width = 1280,
    height = 800,
    deviceScaleFactor = 1,
    isMobile = false,
    hasTouch = false,
    isLandscape = true,
    waitUntil, // נבחר למטה לפי מקור התוכן
    timeout = 30000,
    saveToFile = false,
    outputDir = './screenshots',
    selector = null,
    clip = null,
    html = null,
    disableJavaScript = false,
    blockPopups = true,
    ignoreHTTPSErrors = true,
    useProxy = false,
    stealthMode = false,
  } = options;

  const proxyConfig = useProxy ? getRandomProxy() : null;
  console.log(`🔄 Using proxy: ${proxyConfig ? proxyConfig.server : 'None'}`);

  const contextOptions = {
    viewport: { width: parseInt(width), height: parseInt(height) },
    deviceScaleFactor,
    isMobile,
    hasTouch,
    ignoreHTTPSErrors,
  };

  if (proxyConfig) {
    contextOptions.proxy = proxyConfig;
  }

  const { browser } = await browserPool.getPage();
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    // הגדרת viewport
    await page.setViewportSize({
      width: parseInt(width),
      height: parseInt(height),
    });

    // Stealth mode
    if (stealthMode || useProxy) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        delete navigator.__proto__.webdriver;
        Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
        Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
      });

      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      });
    }

    // חסימת משאבים "כבדים" (אופציונלי, טוב לאימיילים)
    if (blockPopups) {
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['media', 'font'].includes(type)) return route.abort();
        return route.continue();
      });
    }

    // בחר מצב המתנה לפי מקור התוכן
    const isDataHtml = typeof url === 'string' && /^data:text\/html/i.test(url);
    const chosenWaitUntil = waitUntil || (html || isDataHtml ? 'domcontentloaded' : 'networkidle');
    const navTimeout = parseInt(timeout);

    // טעינת תוכן
    if (html && !url) {
      await page.setContent(html, { waitUntil: chosenWaitUntil, timeout: navTimeout });
    } else if (url) {
      // אם זה data: html — תשאיר chosenWaitUntil (domcontentloaded)
      await page.goto(url, { waitUntil: chosenWaitUntil, timeout: navTimeout });
      await page.waitForLoadState(chosenWaitUntil);
    } else {
      throw new Error('Either url or options.html must be provided');
    }

    // התנהגות אנושית אם זה stealth mode
    if (stealthMode || useProxy) {
      // תנועת עכבר רנדומלית
      await page.mouse.move(Math.random() * 100, Math.random() * 100);
      
      // המתנה רנדומלית
      await page.waitForTimeout(Math.random() * 2000 + 500);
      
      // גלילה קלה
      await page.evaluate(() => {
        window.scrollTo(0, Math.random() * 300);
      });
    }

    // אפשרויות צילום
    const screenshotOptions = {
      fullPage,
      type: format === 'png' ? 'png' : 'jpeg',
      quality: format === 'png' ? undefined : parseInt(quality),
      path: undefined,
    };

    // צילום לפי selector אם התבקש
    if (selector) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        const element = await page.$(selector);
        if (element) {
          const elementShot = await element.screenshot(screenshotOptions);
          let filePath = null;
          if (saveToFile) {
            filePath = await saveScreenshotToFile(
              elementShot,
              url || '[inline-html]',
              screenshotOptions.type,
              outputDir
            );
          }
          const pageTitleSel = await page.title();
          const pageMetricsSel = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            devicePixelRatio: window.devicePixelRatio,
          }));
          return {
            success: true,
            url: url || '[inline-html]',
            timestamp: new Date().toISOString(),
            title: pageTitleSel,
            format: screenshotOptions.type,
            viewport: { width: parseInt(width), height: parseInt(height) },
            pageMetrics: pageMetricsSel,
            fullPage,
            selector,
            screenshot: `data:image/${screenshotOptions.type};base64,${elementShot.toString('base64')}`,
            filePath,
            usedProxy: proxyConfig ? proxyConfig.server : null,
          };
        }
      } catch (e) {
        console.warn(`⚠️ Selector "${selector}" not found, falling back to full page screenshot`);
      }
    }

    // clip ספציפי (אם אין selector)
    if (clip && !selector) {
      screenshotOptions.clip = {
        x: parseInt(clip.x || 0),
        y: parseInt(clip.y || 0),
        width: parseInt(clip.width || width),
        height: parseInt(clip.height || height),
      };
    }

    // צילום מסך מלא/חתוך
    const screenshot = await page.screenshot(screenshotOptions);

    // שמירה לקובץ (אופציונלי)
    let filePath = null;
    if (saveToFile) {
      filePath = await saveScreenshotToFile(
        screenshot,
        url || '[inline-html]',
        screenshotOptions.type,
        outputDir
      );
    }

    // מידע על הדף
    const pageTitle = await page.title();
    const pageMetrics = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      devicePixelRatio: window.devicePixelRatio,
    }));

    return {
      success: true,
      url: url || '[inline-html]',
      timestamp: new Date().toISOString(),
      title: pageTitle,
      format: screenshotOptions.type,
      viewport: { width: parseInt(width), height: parseInt(height) },
      pageMetrics,
      fullPage,
      screenshot: `data:image/${screenshotOptions.type};base64,${screenshot.toString('base64')}`,
      filePath,
      usedProxy: proxyConfig ? proxyConfig.server : null,
    };
  } catch (error) {
    console.error(`❌ Error capturing screenshot for ${url || '[inline-html]'}:`, error);
    throw error;
  } finally {
    await context.close();
  }
}

/**
 * לכידת צילומי מסך מרובים
 */
async function captureMultipleScreenshots(urls, options = {}) {
  console.log(`📸 Capturing multiple screenshots for ${urls.length} URLs`);

  const results = [];
  const errors = [];

  for (const url of urls) {
    try {
      const result = await captureScreenshot(url, options);
      results.push(result);
    } catch (error) {
      console.error(`❌ Error capturing screenshot for ${url}:`, error);
      errors.push({ url, error: error.message || 'Unknown error' });
    }
  }

  return {
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    total: urls.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

/**
 * לכידת צילומי מסך במספר גדלי מסך שונים
 * תומך גם ב-html (יעבור דרך options.html)
 */
async function captureResponsiveScreenshots(url, viewports = [], options = {}) {
  console.log(`📱 Capturing responsive screenshots for: ${url || '[inline-html]'}`);

  if (!viewports || viewports.length === 0) {
    viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
      { name: 'large', width: 1920, height: 1080 },
    ];
  }

  const results = [];
  const errors = [];

  for (const viewport of viewports) {
    try {
      const viewportOptions = {
        ...options,
        width: viewport.width,
        height: viewport.height,
        isMobile: viewport.width < 768,
      };

      const result = await captureScreenshot(url === '[inline-html]' ? null : url, viewportOptions);
      results.push({ ...result, viewportName: viewport.name });
    } catch (error) {
      console.error(`❌ Error capturing screenshot for ${url || '[inline-html]'} at ${viewport.name}:`, error);
      errors.push({ url: url || '[inline-html]', viewport: viewport.name, error: error.message || 'Unknown error' });
    }
  }

  return {
    success: errors.length === 0,
    url: url || '[inline-html]',
    timestamp: new Date().toISOString(),
    total: viewports.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

/**
 * שמירת צילום מסך לקובץ
 */
async function saveScreenshotToFile(screenshot, url, format = 'jpeg', outputDir = './screenshots') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const urlHash = crypto.createHash('md5').update(url || '[inline-html]').digest('hex').substring(0, 8);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${urlHash}-${timestamp}.${format}`;
  const filePath = path.join(outputDir, filename);

  fs.writeFileSync(filePath, screenshot);
  return filePath;
}

module.exports = {
  captureScreenshot,
  captureMultipleScreenshots,
  captureResponsiveScreenshots,
};
