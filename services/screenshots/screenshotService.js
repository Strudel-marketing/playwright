/**
 * Screenshot Service Module
 * 
 * מספק פונקציונליות ללכידת צילומי מסך מדפי אינטרנט
 */

const browserPool = require('../../utils/browserPool');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * לכידת צילום מסך מדף אינטרנט
 * @param {string} url - כתובת האתר ללכידה
 * @param {Object} options - אפשרויות נוספות
 * @returns {Promise<Object>} - תוצאות הלכידה
 */
async function captureScreenshot(url, options = {}) {
    console.log(`📸 Capturing screenshot for: ${url}`);
    
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
        waitUntil = 'networkidle',
        timeout = 30000,
        saveToFile = false,
        outputDir = './screenshots',
        selector = null,
        clip = null
    } = options;
    
    const { page, context, id } = await browserPool.getPage();
    
    try {
        // הגדרת גודל המסך
        await page.setViewportSize({
            width: parseInt(width),
            height: parseInt(height)
        });
        
        // ניווט לדף
        await page.goto(url, { 
            waitUntil,
            timeout: parseInt(timeout)
        });
        
        // המתנה לטעינה מלאה של הדף
        await page.waitForLoadState(waitUntil);
        
        // אפשרויות צילום המסך
        const screenshotOptions = {
            fullPage,
            type: format,
            quality: parseInt(quality),
            path: undefined
        };
        
        // אם יש סלקטור ספציפי, לכוד רק את האלמנט הזה
        if (selector) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                const element = await page.$(selector);
                if (element) {
                    const screenshot = await element.screenshot(screenshotOptions);
                    
                    // שמירה לקובץ אם נדרש
                    let filePath = null;
                    if (saveToFile) {
                        filePath = await saveScreenshotToFile(screenshot, url, format, outputDir);
                    }
                    
                    return {
                        success: true,
                        url,
                        timestamp: new Date().toISOString(),
                        format,
                        width,
                        height,
                        fullPage,
                        selector,
                        screenshot: `data:image/${format};base64,${screenshot.toString('base64')}`,
                        filePath
                    };
                }
            } catch (error) {
                console.warn(`⚠️ Selector "${selector}" not found, falling back to full page screenshot`);
            }
        }
        
        // אם יש הגדרות חיתוך ספציפיות
        if (clip && !selector) {
            screenshotOptions.clip = {
                x: parseInt(clip.x || 0),
                y: parseInt(clip.y || 0),
                width: parseInt(clip.width || width),
                height: parseInt(clip.height || height)
            };
        }
        
        // לכידת צילום המסך
        const screenshot = await page.screenshot(screenshotOptions);
        
        // שמירה לקובץ אם נדרש
        let filePath = null;
        if (saveToFile) {
            filePath = await saveScreenshotToFile(screenshot, url, format, outputDir);
        }
        
        // מידע על הדף
        const pageTitle = await page.title();
        const pageMetrics = await page.evaluate(() => {
            return {
                width: document.documentElement.scrollWidth,
                height: document.documentElement.scrollHeight,
                devicePixelRatio: window.devicePixelRatio
            };
        });
        
        return {
            success: true,
            url,
            timestamp: new Date().toISOString(),
            title: pageTitle,
            format,
            viewport: {
                width: parseInt(width),
                height: parseInt(height)
            },
            pageMetrics,
            fullPage,
            screenshot: `data:image/${format};base64,${screenshot.toString('base64')}`,
            filePath
        };
    } catch (error) {
        console.error(`❌ Error capturing screenshot for ${url}:`, error);
        throw error;
    } finally {
        await browserPool.releasePage(id);
    }
}

/**
 * לכידת צילומי מסך מרובים מדפים שונים
 * @param {Array<string>} urls - רשימת כתובות URL ללכידה
 * @param {Object} options - אפשרויות נוספות
 * @returns {Promise<Array<Object>>} - תוצאות הלכידה
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
            errors.push({
                url,
                error: error.message || 'Unknown error'
            });
        }
    }
    
    return {
        success: errors.length === 0,
        timestamp: new Date().toISOString(),
        total: urls.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
    };
}

/**
 * לכידת צילומי מסך במספר גדלי מסך שונים
 * @param {string} url - כתובת האתר ללכידה
 * @param {Array<Object>} viewports - רשימת גדלי מסך
 * @param {Object} options - אפשרויות נוספות
 * @returns {Promise<Object>} - תוצאות הלכידה
 */
async function captureResponsiveScreenshots(url, viewports = [], options = {}) {
    console.log(`📱 Capturing responsive screenshots for: ${url}`);
    
    // גדלי מסך ברירת מחדל אם לא סופקו
    if (!viewports || viewports.length === 0) {
        viewports = [
            { name: 'mobile', width: 375, height: 667 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'desktop', width: 1280, height: 800 },
            { name: 'large', width: 1920, height: 1080 }
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
                isMobile: viewport.width < 768
            };
            
            const result = await captureScreenshot(url, viewportOptions);
            results.push({
                ...result,
                viewportName: viewport.name
            });
        } catch (error) {
            console.error(`❌ Error capturing screenshot for ${url} at viewport ${viewport.name}:`, error);
            errors.push({
                url,
                viewport: viewport.name,
                error: error.message || 'Unknown error'
            });
        }
    }
    
    return {
        success: errors.length === 0,
        url,
        timestamp: new Date().toISOString(),
        total: viewports.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
    };
}

/**
 * שמירת צילום מסך לקובץ
 * @param {Buffer} screenshot - בופר של צילום המסך
 * @param {string} url - כתובת האתר
 * @param {string} format - פורמט הקובץ
 * @param {string} outputDir - תיקיית היעד
 * @returns {Promise<string>} - נתיב הקובץ
 */
async function saveScreenshotToFile(screenshot, url, format = 'jpeg', outputDir = './screenshots') {
    // יצירת תיקיית היעד אם לא קיימת
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // יצירת שם קובץ מבוסס על ה-URL והתאריך
    const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${urlHash}-${timestamp}.${format}`;
    const filePath = path.join(outputDir, filename);
    
    // שמירת הקובץ
    fs.writeFileSync(filePath, screenshot);
    
    return filePath;
}

module.exports = {
    captureScreenshot,
    captureMultipleScreenshots,
    captureResponsiveScreenshots
};
