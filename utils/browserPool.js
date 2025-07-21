/**
 * Browser Pool Utility
 * 
 * מנהל מאגר של דפדפנים ודפים לשימוש משותף בין כל השירותים
 * מאפשר שימוש יעיל במשאבי דפדפן וחוסך זמן אתחול
 */

const { chromium } = require('playwright');

class BrowserPool {
    constructor() {
        this.browser = null;
        this.pages = new Map();
        this.isInitialized = false;
    }

    /**
     * אתחול הדפדפן עם הגדרות אופטימליות
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('🌐 Initializing browser pool...');
        
        try {
            this.browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--disable-extensions',
                    '--disable-default-apps',
                ]
            });
            
            this.isInitialized = true;
            console.log('✅ Browser pool initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize browser pool:', error);
            throw error;
        }
    }

    /**
     * קבלת דף חדש או קיים ממאגר הדפים
     * @param {string} id - מזהה ייחודי לדף (אופציונלי)
     * @param {Object} options - אפשרויות נוספות
     * @returns {Promise<Object>} - אובייקט המכיל את הדף והקונטקסט
     */
    async getPage(id = null, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const pageId = id || `page_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // אם הדף כבר קיים, החזר אותו
        if (id && this.pages.has(id)) {
            return this.pages.get(id);
        }

        // הגדרות ברירת מחדל לקונטקסט
        const contextOptions = {
            userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: options.viewport || { width: 1366, height: 768 },
            locale: options.locale || 'en-US',
            timezoneId: options.timezoneId || 'Europe/London',
            ...options
        };

        // יצירת קונטקסט חדש
        const context = await this.browser.newContext(contextOptions);
        
        // הגדרת הדף לעקוף זיהוי אוטומציה
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        // יצירת דף חדש
        const page = await context.newPage();
        
        // הגדרת HTTP headers
        if (options.headers) {
            await page.setExtraHTTPHeaders(options.headers);
        }

        // שמירת הדף והקונטקסט במאגר
        const pageObject = { page, context, id: pageId };
        this.pages.set(pageId, pageObject);
        
        return pageObject;
    }

    /**
     * שחרור דף ממאגר הדפים
     * @param {string} id - מזהה הדף לשחרור
     */
    async releasePage(id) {
        if (this.pages.has(id)) {
            const { page, context } = this.pages.get(id);
            
            try {
                await page.close();
                await context.close();
            } catch (error) {
                console.error(`Error closing page ${id}:`, error);
            }
            
            this.pages.delete(id);
        }
    }

    /**
     * סגירת כל הדפים והדפדפן
     */
    async close() {
        if (!this.browser) return;
        
        // סגירת כל הדפים
        for (const [id, { page, context }] of this.pages.entries()) {
            try {
                await page.close();
                await context.close();
            } catch (error) {
                console.error(`Error closing page ${id}:`, error);
            }
        }
        
        this.pages.clear();
        
        // סגירת הדפדפן
        try {
            await this.browser.close();
            this.browser = null;
            this.isInitialized = false;
            console.log('🔒 Browser pool closed');
        } catch (error) {
            console.error('Error closing browser:', error);
        }
    }
}

// יצירת מופע יחיד של מאגר הדפדפנים
const browserPool = new BrowserPool();

// טיפול בסגירה תקינה של הדפדפן בעת סגירת האפליקציה
process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, closing browser pool...');
    await browserPool.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, closing browser pool...');
    await browserPool.close();
    process.exit(0);
});

module.exports = browserPool;
