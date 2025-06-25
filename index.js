const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Static files serving for screenshots
app.use('/screenshots', express.static('/app/screenshots', {
    maxAge: '7d',
    setHeaders: (res, path) => {
        res.setHeader('Content-Type', 'image/png');
    }
}));

// Global browser instance
let globalBrowser = null;

// Initialize browser
async function initBrowser() {
    try {
        globalBrowser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        console.log('🎭 Playwright browser initialized');
    } catch (error) {
        console.error('Failed to initialize browser:', error);
    }
}

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Playwright Universal Automation API',
        version: '2.1.0',
        features: [
            'comprehensive-seo-analysis',
            'structured-data-extraction', 
            'performance-monitoring',
            'accessibility-check',
            'mobile-optimization',
            'core-web-vitals',
            'screenshots',
            'schema-extraction'
        ],
        timestamp: new Date().toISOString()
    });
});

// Comprehensive SEO Audit Endpoint
app.post('/api/seo/audit', async (req, res) => {
    const { url, includeScreenshot = false, detailed = true } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    const browser = globalBrowser || await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        const startTime = Date.now();
        
        // Navigate to page
        await page.goto(url, { waitUntil: 'networkidle' });
        const loadTime = Date.now() - startTime;
        
        // Get performance metrics
        const performanceMetrics = await page.evaluate(() => {
            const perfData = performance.getEntriesByType('navigation')[0];
            const paintMetrics = performance.getEntriesByType('paint');
            
            return {
                loadTime: perfData?.loadEventEnd - perfData?.loadEventStart || 0,
                domContentLoaded: perfData?.domContentLoadedEventEnd - perfData?.domContentLoadedEventStart || 0,
                firstContentfulPaint: paintMetrics.find(m => m.name === 'first-contentful-paint')?.startTime || 0,
                largestContentfulPaint: paintMetrics.find(m => m.name === 'largest-contentful-paint')?.startTime || 0,
                timeToInteractive: perfData?.loadEventEnd || 0
            };
        });
        
        // Comprehensive SEO analysis
        const seoData = await page.evaluate(() => {
            // Basic meta data
            const title = document.title;
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
            const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
            const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
            
            // Language and structure
            const lang = document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') || '';
            const charset = document.querySelector('meta[charset]')?.getAttribute('charset') || 
                           document.querySelector('meta[http-equiv="content-type"]')?.getAttribute('content') || '';
            
            // Headings analysis
            const headings = {
                h1: Array.from(document.querySelectorAll('h1')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h2: Array.from(document.querySelectorAll('h2')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h3: Array.from(document.querySelectorAll('h3')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h4: document.querySelectorAll('h4').length,
                h5: document.querySelectorAll('h5').length,
                h6: document.querySelectorAll('h6').length
            };
            
            // Images analysis
            const images = Array.from(document.querySelectorAll('img'));
            const imageAnalysis = {
                total: images.length,
                withAlt: images.filter(img => img.getAttribute('alt')).length,
                withoutAlt: images.filter(img => !img.getAttribute('alt')).length,
                withTitle: images.filter(img => img.getAttribute('title')).length,
                withLazyLoading: images.filter(img => img.getAttribute('loading') === 'lazy').length,
                oversized: images.filter(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 1920 || rect.height > 1080;
                }).length
            };
            
            // Links analysis
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            const internalLinks = allLinks.filter(link => {
                const href = link.getAttribute('href');
                return href.startsWith('/') || href.startsWith(window.location.origin) || (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:'));
            });
            const externalLinks = allLinks.filter(link => {
                const href = link.getAttribute('href');
                return href.startsWith('http') && !href.startsWith(window.location.origin);
            });
            
            const linkAnalysis = {
                total: allLinks.length,
                internal: internalLinks.length,
                external: externalLinks.length,
                nofollow: allLinks.filter(link => link.getAttribute('rel')?.includes('nofollow')).length,
                withoutText: allLinks.filter(link => !link.textContent.trim()).length,
                broken: [] // Would need additional checking
            };
            
            // Content analysis
            const textContent = document.body.textContent || '';
            const wordCount = textContent.trim().split(/\s+/).length;
            const readingTime = Math.ceil(wordCount / 200); // Average reading speed
            
            // Forms analysis
            const forms = Array.from(document.querySelectorAll('form'));
            const formAnalysis = {
                total: forms.length,
                withAction: forms.filter(form => form.getAttribute('action')).length,
                withMethod: forms.filter(form => form.getAttribute('method')).length,
                inputs: document.querySelectorAll('input').length,
                textareas: document.querySelectorAll('textarea').length,
                selects: document.querySelectorAll('select').length
            };
            
            // Social media meta
            const socialMeta = {
                openGraph: {},
                twitterCard: {},
                facebook: {}
            };
            
            // Open Graph
            document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
                const property = meta.getAttribute('property').replace('og:', '');
                socialMeta.openGraph[property] = meta.getAttribute('content');
            });
            
            // Twitter Cards
            document.querySelectorAll('meta[name^="twitter:"]').forEach(meta => {
                const name = meta.getAttribute('name').replace('twitter:', '');
                socialMeta.twitterCard[name] = meta.getAttribute('content');
            });
            
            // Schema.org structured data
            const structuredData = {
                jsonLD: [],
                microdata: [],
                hasStructuredData: false
            };
            
            // JSON-LD
            try {
                const jsonLDScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                structuredData.jsonLD = jsonLDScripts.map(script => {
                    try {
                        return JSON.parse(script.textContent);
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);
                structuredData.hasStructuredData = structuredData.jsonLD.length > 0;
            } catch (e) {}
            
            // Microdata
            try {
                const itemScopes = Array.from(document.querySelectorAll('[itemscope]'));
                structuredData.microdata = itemScopes.map(item => ({
                    type: item.getAttribute('itemtype'),
                    properties: Array.from(item.querySelectorAll('[itemprop]')).map(prop => ({
                        name: prop.getAttribute('itemprop'),
                        value: prop.getAttribute('content') || prop.textContent.trim()
                    }))
                }));
                if (structuredData.microdata.length > 0) {
                    structuredData.hasStructuredData = true;
                }
            } catch (e) {}
            
            // Technical SEO
            const technicalSEO = {
                hasHTTPS: window.location.protocol === 'https:',
                hasRobotsTxt: false, // Would need separate request
                hasSitemap: !!document.querySelector('link[rel="sitemap"]'),
                hasCanonical: !!canonical,
                hasViewport: !!viewport,
                isResponsive: !!viewport && viewport.includes('width=device-width'),
                hasCharset: !!charset,
                hasLang: !!lang,
                amp: !!document.querySelector('html[amp]') || !!document.querySelector('html[⚡]')
            };
            
            // Page speed indicators
            const pageSpeedIndicators = {
                totalStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
                totalScripts: document.querySelectorAll('script[src]').length,
                inlineStyles: document.querySelectorAll('style').length,
                inlineScripts: document.querySelectorAll('script:not([src])').length,
                totalImages: images.length,
                hasMinifiedCSS: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link => 
                    link.getAttribute('href')?.includes('.min.css')),
                hasMinifiedJS: Array.from(document.querySelectorAll('script[src]')).some(script => 
                    script.getAttribute('src')?.includes('.min.js'))
            };
            
            return {
                // Basic SEO
                title,
                titleLength: title.length,
                description,
                descriptionLength: description.length,
                keywords,
                canonical,
                robots,
                viewport,
                lang,
                charset,
                
                // Content structure
                headings,
                wordCount,
                readingTime,
                
                // Media
                imageAnalysis,
                
                // Links
                linkAnalysis,
                
                // Forms
                formAnalysis,
                
                // Social
                socialMeta,
                
                // Structured data
                structuredData,
                
                // Technical
                technicalSEO,
                
                // Performance indicators
                pageSpeedIndicators,
                
                // URL analysis
                url: window.location.href,
                urlLength: window.location.href.length,
                hasParameters: window.location.search.length > 0,
                hasFragment: window.location.hash.length > 0
            };
        });
        
        // Calculate comprehensive SEO score
        const seoScore = calculateSEOScore(seoData, performanceMetrics);
        
        const result = {
            url: url,
            timestamp: new Date().toISOString(),
            score: seoScore.total,
            grade: seoScore.grade,
            issues: seoScore.issues,
            recommendations: seoScore.recommendations,
            seoData: seoData,
            performance: {
                ...performanceMetrics,
                loadTime: loadTime,
                scoreBreakdown: seoScore.breakdown
            }
        };
        
        // Add screenshot if requested
        if (includeScreenshot) {
            const screenshotPath = `/tmp/seo_audit_${Date.now()}.png`;
            await page.screenshot({ 
                path: screenshotPath, 
                fullPage: true,
                timeout: 30000
            });
            result.screenshot = `file://${screenshotPath}`;
        }
        
        res.json({
            success: true,
            result: result
        });
        
    } catch (error) {
        console.error('SEO audit error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: url
        });
    } finally {
        await page.close();
        if (!globalBrowser) {
            await browser.close();
        }
    }
});

// Calculate comprehensive SEO score
function calculateSEOScore(seoData, performanceMetrics) {
    let score = 100;
    const issues = [];
    const recommendations = [];
    const breakdown = {
        content: 0,
        technical: 0,
        performance: 0,
        mobile: 0,
        social: 0,
        structured: 0
    };
    
    // Content Score (30 points)
    let contentScore = 30;
    
    // Title optimization
    if (!seoData.title) {
        contentScore -= 8;
        issues.push('Missing page title');
        recommendations.push('Add a descriptive page title');
    } else if (seoData.titleLength < 30 || seoData.titleLength > 60) {
        contentScore -= 4;
        issues.push('Title length not optimal (30-60 chars)');
        recommendations.push('Optimize title length to 30-60 characters');
    }
    
    // Meta description
    if (!seoData.description) {
        contentScore -= 6;
        issues.push('Missing meta description');
        recommendations.push('Add a compelling meta description');
    } else if (seoData.descriptionLength < 120 || seoData.descriptionLength > 160) {
        contentScore -= 3;
        issues.push('Meta description length not optimal (120-160 chars)');
        recommendations.push('Optimize meta description to 120-160 characters');
    }
    
    // Headings structure
    if (seoData.headings.h1.length === 0) {
        contentScore -= 6;
        issues.push('Missing H1 tag');
        recommendations.push('Add a clear H1 heading that describes the page content');
    } else if (seoData.headings.h1.length > 1) {
        contentScore -= 3;
        issues.push('Multiple H1 tags found');
        recommendations.push('Use only one H1 tag per page');
    }
    
    // Content length
    if (seoData.wordCount < 300) {
        contentScore -= 4;
        issues.push('Content too short (less than 300 words)');
        recommendations.push('Add more valuable content (aim for 300+ words)');
    }
    
    breakdown.content = Math.max(0, contentScore);
    
    // Technical Score (25 points)
    let technicalScore = 25;
    
    // HTTPS
    if (!seoData.technicalSEO.hasHTTPS) {
        technicalScore -= 8;
        issues.push('Not using HTTPS');
        recommendations.push('Implement SSL certificate for security');
    }
    
    // Canonical URL
    if (!seoData.technicalSEO.hasCanonical) {
        technicalScore -= 3;
        issues.push('Missing canonical URL');
        recommendations.push('Add canonical URL to prevent duplicate content');
    }
    
    // Viewport meta tag
    if (!seoData.technicalSEO.hasViewport) {
        technicalScore -= 4;
        issues.push('Missing viewport meta tag');
        recommendations.push('Add viewport meta tag for mobile optimization');
    }
    
    // Language declaration
    if (!seoData.technicalSEO.hasLang) {
        technicalScore -= 2;
        issues.push('Missing language declaration');
        recommendations.push('Add lang attribute to html tag');
    }
    
    // Charset
    if (!seoData.technicalSEO.hasCharset) {
        technicalScore -= 2;
        issues.push('Missing charset declaration');
        recommendations.push('Add charset meta tag');
    }
    
    breakdown.technical = Math.max(0, technicalScore);
    
    // Performance Score (20 points)
    let performanceScore = 20;
    
    if (performanceMetrics.loadTime > 3000) {
        performanceScore -= 8;
        issues.push('Slow page load time');
        recommendations.push('Optimize images and reduce HTTP requests');
    } else if (performanceMetrics.loadTime > 2000) {
        performanceScore -= 4;
        issues.push('Page load time could be improved');
        recommendations.push('Consider optimizing page load speed');
    }
    
    if (seoData.pageSpeedIndicators.totalImages > 20) {
        performanceScore -= 3;
        issues.push('Too many images may slow down page');
        recommendations.push('Optimize and compress images');
    }
    
    if (seoData.pageSpeedIndicators.totalScripts > 10) {
        performanceScore -= 2;
        issues.push('Many JavaScript files detected');
        recommendations.push('Consider bundling and minifying JavaScript');
    }
    
    breakdown.performance = Math.max(0, performanceScore);
    
    // Mobile Score (10 points)
    let mobileScore = 10;
    
    if (!seoData.technicalSEO.isResponsive) {
        mobileScore -= 8;
        issues.push('Not mobile responsive');
        recommendations.push('Implement responsive design for mobile devices');
    }
    
    breakdown.mobile = Math.max(0, mobileScore);
    
    // Social Score (8 points)
    let socialScore = 8;
    
    if (Object.keys(seoData.socialMeta.openGraph).length === 0) {
        socialScore -= 4;
        issues.push('Missing Open Graph tags');
        recommendations.push('Add Open Graph meta tags for social sharing');
    }
    
    if (Object.keys(seoData.socialMeta.twitterCard).length === 0) {
        socialScore -= 2;
        issues.push('Missing Twitter Card tags');
        recommendations.push('Add Twitter Card meta tags');
    }
    
    breakdown.social = Math.max(0, socialScore);
    
    // Structured Data Score (7 points)
    let structuredScore = 7;
    
    if (!seoData.structuredData.hasStructuredData) {
        structuredScore -= 5;
        issues.push('No structured data found');
        recommendations.push('Add Schema.org structured data markup');
    } else if (seoData.structuredData.jsonLD.length === 0 && seoData.structuredData.microdata.length > 0) {
        structuredScore -= 2;
        issues.push('Consider using JSON-LD for structured data');
        recommendations.push('JSON-LD is the preferred format for structured data');
    }
    
    breakdown.structured = Math.max(0, structuredScore);
    
    // Images optimization
    if (seoData.imageAnalysis.withoutAlt > 0) {
        const penalty = Math.min(5, seoData.imageAnalysis.withoutAlt);
        breakdown.content -= penalty;
        issues.push(`${seoData.imageAnalysis.withoutAlt} images missing alt text`);
        recommendations.push('Add descriptive alt text to all images');
    }
    
    const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const grade = totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 70 ? 'C' : totalScore >= 60 ? 'D' : 'F';
    
    return {
        total: Math.max(0, Math.round(totalScore)),
        grade,
        issues,
        recommendations,
        breakdown
    };
}

// Schema Extraction Endpoint
app.post('/api/extract/schema', async (req, res) => {
    const { url, options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    const browser = globalBrowser || await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        
        const extractedData = await extractAllSchemas(page, options);
        
        res.json({
            success: true,
            url: url,
            timestamp: new Date().toISOString(),
            data: extractedData
        });
        
    } catch (error) {
        console.error('Schema extraction error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: url
        });
    } finally {
        await page.close();
        if (!globalBrowser) {
            await browser.close();
        }
    }
});

// Extract all schema types from page
async function extractAllSchemas(page, options = {}) {
    const results = {};
    
    // 1. JSON-LD Structured Data
    try {
        results.jsonLD = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            return scripts.map(script => {
                try {
                    return JSON.parse(script.textContent);
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
        });
    } catch (e) {
        results.jsonLD = [];
    }
    
    // 2. Microdata
    try {
        results.microdata = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('[itemscope]'));
            return items.map(item => {
                const type = item.getAttribute('itemtype');
                const properties = {};
                
                const props = Array.from(item.querySelectorAll('[itemprop]'));
                props.forEach(prop => {
                    const name = prop.getAttribute('itemprop');
                    const value = prop.getAttribute('content') || 
                                 prop.getAttribute('datetime') ||
                                 prop.textContent.trim();
                    properties[name] = value;
                });
                
                return { type, properties };
            });
        });
    } catch (e) {
        results.microdata = [];
    }
    
    // 3. Open Graph
    try {
        results.openGraph = await page.evaluate(() => {
            const ogTags = Array.from(document.querySelectorAll('meta[property^="og:"]'));
            const og = {};
            ogTags.forEach(tag => {
                const property = tag.getAttribute('property').replace('og:', '');
                const content = tag.getAttribute('content');
                og[property] = content;
            });
            return og;
        });
    } catch (e) {
        results.openGraph = {};
    }
    
    // 4. Twitter Cards
    try {
        results.twitterCard = await page.evaluate(() => {
            const twitterTags = Array.from(document.querySelectorAll('meta[name^="twitter:"]'));
            const twitter = {};
            twitterTags.forEach(tag => {
                const name = tag.getAttribute('name').replace('twitter:', '');
                const content = tag.getAttribute('content');
                twitter[name] = content;
            });
            return twitter;
        });
    } catch (e) {
        results.twitterCard = {};
    }
    
    // 5. Basic SEO Meta
    try {
        results.seoMeta = await page.evaluate(() => ({
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
            keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content'),
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
            robots: document.querySelector('meta[name="robots"]')?.getAttribute('content')
        }));
    } catch (e) {
        results.seoMeta = {};
    }
    
    return results;
}

// Quick Schema Check
app.post('/api/extract/quick-check', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    const browser = globalBrowser || await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        
    const quickCheck = await page.evaluate(() => {
    const hasJsonLD = document.querySelectorAll('script[type="application/ld+json"]').length > 0;
    const hasMicrodata = document.querySelectorAll('[itemscope]').length > 0;
    const hasOpenGraph = document.querySelectorAll('meta[property^="og:"]').length > 0;
    const hasTwitterCard = document.querySelectorAll('meta[name^="twitter:"]').length > 0;
    const hasSchemaTypes = [];
    
    // Check for common schema types - improved version
    const jsonLDScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    jsonLDScripts.forEach(script => {
        try {
            const data = JSON.parse(script.textContent);
        
            // Function to extract types recursively
            function extractTypes(obj) {
                if (!obj) return;
                
                if (typeof obj === 'object') {
                    if (obj['@type']) {
                        if (Array.isArray(obj['@type'])) {
                            hasSchemaTypes.push(...obj['@type']);
                        } else {
                            hasSchemaTypes.push(obj['@type']);
                        }
                    }
                    
                    // Check all properties recursively
                    Object.values(obj).forEach(value => {
                        if (Array.isArray(value)) {
                            value.forEach(item => extractTypes(item));
                        } else if (typeof value === 'object') {
                            extractTypes(value);
                        }
                    });
            }
        }
        
        if (Array.isArray(data)) {
            data.forEach(item => extractTypes(item));
        } else {
            extractTypes(data);
        }
        
    } catch (e) {
        console.log('Error parsing JSON-LD:', e);
    }
});
    
    return {
        hasStructuredData: hasJsonLD || hasMicrodata,
        hasJsonLD,
        hasMicrodata,
        hasOpenGraph,
        hasTwitterCard,
        schemaTypes: [...new Set(hasSchemaTypes)],
        structuredDataScore: (hasJsonLD ? 40 : 0) + 
                          (hasMicrodata ? 30 : 0) + 
                          (hasOpenGraph ? 20 : 0) + 
                          (hasTwitterCard ? 10 : 0)
    };
});

res.json({
    success: true,
    url: url,
    quickCheck: quickCheck,
    recommendation: quickCheck.structuredDataScore < 50 ? 
        'Consider adding more structured data markup' : 
        'Good structured data implementation'
});

} catch (error) {
    console.error('Quick check error:', error);
    res.status(500).json({
        success: false,
        error: error.message
    });
} finally {
    await page.close();
    if (!globalBrowser) {
        await browser.close();
    }
}
});     

// Screenshot endpoint
app.post('/api/screenshot', async (req, res) => {
    const { url, options = {} } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    const browser = globalBrowser || await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        // Set viewport if specified
        if (options.viewport) {
            await page.setViewportSize(options.viewport);
        }
        
        await page.goto(url, { waitUntil: 'networkidle' });
        
        // Block popups if requested
        if (options.blockPopups) {
            await page.addInitScript(() => {
                window.alert = () => {};
                window.confirm = () => true;
                window.prompt = () => '';
            });
        }
        
        const filename = `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
            const screenshotOptions = {
            path: `/app/screenshots/${filename}`,
            fullPage: options.fullPage !== false,
            ...options
        };
        if (options.selector) {
            const element = await page.$(options.selector);
            if (element) {
                await element.screenshot(screenshotOptions);
            } else {
                throw new Error(`Element with selector "${options.selector}" not found`);
            }
        } else {
            await page.screenshot(screenshotOptions);
        }
        
        res.json({
            success: true,
            result: {
                filename: filename,
                url: `https://playwright.strudel.marketing/screenshots/${filename}`,
                localPath: screenshotOptions.path,
                originalUrl: url,
                options: options,
                expiresIn: '7 days'
            }
        });
        
    } catch (error) {
        console.error('Screenshot error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        await page.close();
        if (!globalBrowser) {
            await browser.close();
        }
    }
});

// Cleanup old screenshots (older than 7 days)
function cleanupOldScreenshots() {
    const fs = require('fs');
    const path = require('path');
    const screenshotsDir = '/app/screenshots';
    
    try {
        if (fs.existsSync(screenshotsDir)) {
            const files = fs.readdirSync(screenshotsDir);
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            
            files.forEach(file => {
                const filePath = path.join(screenshotsDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > sevenDays) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Cleaned up old screenshot: ${file}`);
                }
            });
        }
    } catch (error) {
        console.error('Error cleaning up screenshots:', error);
    }
}

// Run cleanup every 24 hours
setInterval(cleanupOldScreenshots, 24 * 60 * 60 * 1000);

// Initialize browser on startup
initBrowser();

// Clean up old screenshots on startup
cleanupOldScreenshots();

// Initialize browser on startup
initBrowser();

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Playwright Universal Automation API running on port ${PORT}`);
    console.log(`📊 Available endpoints:`);
    console.log(`   GET  /health - Service health check`);
    console.log(`   POST /api/seo/audit - Comprehensive SEO analysis`);
    console.log(`   POST /api/extract/schema - Schema extraction`);
    console.log(`   POST /api/extract/quick-check - Quick structured data check`);
    console.log(`   POST /api/screenshot - Advanced screenshots`);
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    if (globalBrowser) {
        await globalBrowser.close();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    if (globalBrowser) {
        await globalBrowser.close();
    }
    process.exit(0);
});
