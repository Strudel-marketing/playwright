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
        this.requestCounts = new Map();

        // ✅ NEW: per-domain lock to avoid concurrent navigations to same domain
        this.domainLocks = new Map();

        this.maxRequestsPerMinute = 10;
        this.minDelayBetweenRequests = 500;
        this.maxDelayBetweenRequests = 2000;
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
            
            this.browser.on('disconnected', () => {
                console.warn('⚠️ Browser disconnected — will reinitialize on next request');
                this.isInitialized = false;
                this.browser = null;
                this.pages.clear();
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
        if (!this.isInitialized || !this.browser) {
            this.isInitialized = false;
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

    getRandomViewport() {
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1440, height: 900 },
            { width: 1680, height: 1050 },
            { width: 1920, height: 1200 },
        ];
        return viewports[Math.floor(Math.random() * viewports.length)];
    }

    /**
     * Canonicalize a hostname for rate-limit and lock keys.
     * Strips a leading "www." so that "www.example.com" and "example.com"
     * share the same counter and lock. This matches the crawl-scope
     * canonicalization in siteAuditService.
     */
    canonicalDomainKey(urlStr) {
        try {
            return new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
        } catch {
            return '';
        }
    }

    /**
     * Check if we can make a request to a domain (rate limiting)
     * @param {string} url - URL to check
     * @returns {boolean} - Whether request is allowed
     */
    canMakeRequest(url) {
        try {
            const domain = this.canonicalDomainKey(url);
            const now = Date.now();

            if (!this.requestCounts.has(domain)) {
                this.requestCounts.set(domain, { count: 0, lastReset: now });
                return true;
            }

            const domainData = this.requestCounts.get(domain);

            // Reset counter if a minute has passed
            if (now - domainData.lastReset > 60000) {
                domainData.count = 0;
                domainData.lastReset = now;
            }

            return domainData.count < this.maxRequestsPerMinute;
        } catch (error) {
            console.warn('Rate limiting check failed:', error);
            return true; // Allow request if check fails
        }
    }

    /**
     * Record a request to a domain
     * @param {string} url - URL that was requested
     */
    recordRequest(url) {
        try {
            const domain = this.canonicalDomainKey(url);
            const now = Date.now();

            if (!this.requestCounts.has(domain)) {
                this.requestCounts.set(domain, { count: 1, lastReset: now });
            } else {
                const domainData = this.requestCounts.get(domain);
                domainData.count++;
            }
        } catch (error) {
            console.warn('Request recording failed:', error);
        }
    }

    /**
     * Get random delay between requests
     * @returns {number} - Delay in milliseconds
     */
    getRandomDelay() {
        return Math.floor(Math.random() * (this.maxDelayBetweenRequests - this.minDelayBetweenRequests + 1)) + this.minDelayBetweenRequests;
    }

    // ✅ NEW: lock helper to serialize per-domain navigations
    async withDomainLock(domain, fn) {
        const prev = this.domainLocks.get(domain) || Promise.resolve();

        let release;
        const next = new Promise(resolve => { release = resolve; });
        this.domainLocks.set(domain, prev.then(() => next));

        await prev;
        try {
            return await fn();
        } finally {
            release();
            if (this.domainLocks.get(domain) === next) {
                this.domainLocks.delete(domain);
            }
        }
    }

    /**
     * Safe navigation with rate limiting and delays.
     *
     * @param {Object} page - Playwright page object
     * @param {string} url - URL to navigate to
     * @param {Object} options - Navigation options. In addition to standard
     *   Playwright navigation options (waitUntil, timeout, ...), this accepts:
     *   - `skipRateLimit` {boolean}: bypass the per-domain rate limiter.
     *     Use for legitimate high-volume operations like site crawls where
     *     the external rate limit is not applicable.
     *   - `skipDomainLock` {boolean}: bypass the per-domain mutex. The lock
     *     exists to prevent concurrent navigations to the same domain from
     *     tripping anti-bot detection, but it also serializes site crawls
     *     and defeats `pageConcurrency`. Site crawler manages concurrency
     *     on its own so it opts out.
     * @returns {Promise} - Navigation promise
     */
    async safeNavigate(page, url, options = {}) {
        const { skipRateLimit = false, skipDomainLock = false, ...navOptions } = options;
        const domainKey = this.canonicalDomainKey(url);

        const doNavigate = async () => {
            // Check rate limiting (unless the caller opted out)
            if (!skipRateLimit && !this.canMakeRequest(url)) {
                throw new Error(`Rate limit exceeded for domain: ${domainKey}. Please wait before making more requests.`);
            }

            // Add random delay before navigation
            const delay = this.getRandomDelay();
            console.log(`⏱️ Adding ${delay}ms delay before navigating to ${url}`);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Navigate with enhanced options
            const navigationOptions = {
                waitUntil: 'networkidle',
                timeout: 30000,
                ...navOptions
            };

            try {
                const response = await page.goto(url, navigationOptions);

                // ✅ CHANGED: record only after successful navigation
                this.recordRequest(url);

                // Add small random delay after navigation
                const postDelay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms
                await new Promise(resolve => setTimeout(resolve, postDelay));

                return response;
            } catch (error) {
                console.error(`Navigation failed for ${url}:`, error.message);
                throw error;
            }
        };

        // Run under the per-domain lock unless opted out.
        // The canonical domain key means "www.example.com" and "example.com"
        // share the same lock, so a crawl that starts at www and gets
        // redirected to bare doesn't accidentally double its lock contention.
        return skipDomainLock ? doNavigate() : this.withDomainLock(domainKey, doNavigate);
    }

    /**
     * Get a random user agent string for browser automation
     * @returns {string} Random user agent string
     */
    getRandomUserAgent() {
        const userAgents = [
            // Chrome on Windows
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            
            // Chrome on macOS
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            
            // Chrome on Linux
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            
            // Firefox on Windows
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
            
            // Firefox on macOS
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
            
            // Safari on macOS
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Safari/605.1.15',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
            
            // Edge on Windows  
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
        ];
        
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }
    
    /**
     * Enhanced acquire method with anti-detection
     * @param {Object} options - Options for page creation
     * @returns {Promise<Object>} - Page and browser objects
     */
    async acquire(options = {}) {
        const { page, context } = await this.getPage(null, {
            // Enhanced anti-detection options
            userAgent: this.getRandomUserAgent(),
            viewport: this.getRandomViewport(),
            locale: options.locale || 'en-US',
            timezoneId: options.timezoneId || 'America/New_York',
            // Add realistic headers
            extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                ...options.extraHTTPHeaders
            },
            ...options
        });

        // Add mouse movement simulation
        await page.mouse.move(
            Math.floor(Math.random() * 100) + 100,
            Math.floor(Math.random() * 100) + 100
        );

        return { page, browser: this.browser, context, safeNavigate: (url, navOptions) => this.safeNavigate(page, url, navOptions) };
    }

    /**
     * Release browser resources (compatibility method for AutomationService)
     * @param {Object} browser - Browser object (not used, for compatibility)
     */
    async release(browser) {
        console.log('🔄 Browser release called (managed by pool)');
    }

    /**
     * Alternative release method that actually releases a page from pool
     * @param {Object} pageObject - The page object returned from acquire()
     */
    async releasePageObject(pageObject) {
        if (pageObject && pageObject.context) {
            try {
                if (pageObject.page && !pageObject.page.isClosed()) {
                    await pageObject.page.close();
                }
                await pageObject.context.close();
                console.log('✅ Page and context released');
            } catch (error) {
                console.error('❌ Error releasing page:', error);
            }
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
