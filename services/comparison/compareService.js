const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

class CompareService {
    async visualCompare(url1, url2, options = {}) {
        const browser = await chromium.launch();
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });

        try {
            // Take screenshot of first URL
            const page1 = await context.newPage();
            await page1.goto(url1, { waitUntil: 'networkidle' });
            const screenshot1 = await page1.screenshot({ fullPage: true });

            // Take screenshot of second URL
            const page2 = await context.newPage();
            await page2.goto(url2, { waitUntil: 'networkidle' });
            const screenshot2 = await page2.screenshot({ fullPage: true });

            // Compare screenshots
            const img1 = PNG.sync.read(screenshot1);
            const img2 = PNG.sync.read(screenshot2);
            
            const { width, height } = img1;
            const diff = new PNG({ width, height });

            const numDiffPixels = pixelmatch(
                img1.data, img2.data, diff.data, width, height,
                { threshold: 0.1 }
            );

            const diffPercentage = (numDiffPixels / (width * height)) * 100;

            return {
                success: true,
                comparison: {
                    url1,
                    url2,
                    diffPixels: numDiffPixels,
                    diffPercentage: diffPercentage.toFixed(2),
                    totalPixels: width * height,
                    dimensions: { width, height }
                },
                screenshots: {
                    original1: screenshot1.toString('base64'),
                    original2: screenshot2.toString('base64'),
                    diff: PNG.sync.write(diff).toString('base64')
                }
            };

        } finally {
            await browser.close();
        }
    }

    async performanceCompare(url1, url2) {
        const browser = await chromium.launch();
        
        try {
            const results = {};
            
            for (const [key, url] of Object.entries({ url1, url2 })) {
                const context = await browser.newContext();
                const page = await context.newPage();
                
                const startTime = Date.now();
                await page.goto(url, { waitUntil: 'networkidle' });
                const loadTime = Date.now() - startTime;
                
                const metrics = await page.evaluate(() => {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    return {
                        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
                    };
                });
                
                results[key] = {
                    url,
                    loadTime,
                    metrics
                };
                
                await context.close();
            }
            
            return {
                success: true,
                comparison: results,
                summary: {
                    fasterUrl: results.url1.loadTime < results.url2.loadTime ? results.url1.url : results.url2.url,
                    loadTimeDifference: Math.abs(results.url1.loadTime - results.url2.loadTime)
                }
            };
            
        } finally {
            await browser.close();
        }
    }
}

module.exports = new CompareService();
