const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

class LighthouseService {
    async runLighthouse(url, options = {}) {
        let chrome;
        
        try {
            // Launch Chrome
            chrome = await chromeLauncher.launch({
                chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage']
            });

            // Default Lighthouse options
            const lighthouseOptions = {
                logLevel: 'info',
                output: 'json',
                onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
                port: chrome.port,
                ...options
            };

            // Run Lighthouse
            const runnerResult = await lighthouse(url, lighthouseOptions);

            // Extract key metrics
            const { lhr } = runnerResult;
            const categories = lhr.categories;
            const audits = lhr.audits;

            return {
                success: true,
                url,
                timestamp: new Date().toISOString(),
                scores: {
                    performance: Math.round(categories.performance.score * 100),
                    accessibility: Math.round(categories.accessibility.score * 100),
                    bestPractices: Math.round(categories['best-practices'].score * 100),
                    seo: Math.round(categories.seo.score * 100)
                },
                metrics: {
                    firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
                    largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
                    firstMeaningfulPaint: audits['first-meaningful-paint']?.numericValue,
                    speedIndex: audits['speed-index']?.numericValue,
                    totalBlockingTime: audits['total-blocking-time']?.numericValue,
                    cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
                    timeToInteractive: audits['interactive']?.numericValue
                },
                opportunities: Object.keys(audits)
                    .filter(key => audits[key].details && audits[key].details.type === 'opportunity')
                    .map(key => ({
                        id: key,
                        title: audits[key].title,
                        description: audits[key].description,
                        score: audits[key].score,
                        numericValue: audits[key].numericValue,
                        displayValue: audits[key].displayValue
                    })),
                diagnostics: Object.keys(audits)
                    .filter(key => audits[key].details && audits[key].details.type === 'diagnostic')
                    .map(key => ({
                        id: key,
                        title: audits[key].title,
                        description: audits[key].description,
                        score: audits[key].score,
                        displayValue: audits[key].displayValue
                    })),
                fullReport: lhr
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                url
            };
        } finally {
            if (chrome) {
                await chrome.kill();
            }
        }
    }

    async runPerformanceAudit(url) {
        return await this.runLighthouse(url, {
            onlyCategories: ['performance']
        });
    }

    async runSEOAudit(url) {
        return await this.runLighthouse(url, {
            onlyCategories: ['seo']
        });
    }

    async runAccessibilityAudit(url) {
        return await this.runLighthouse(url, {
            onlyCategories: ['accessibility']
        });
    }

    async runFullAudit(url) {
        return await this.runLighthouse(url, {
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa']
        });
    }
}

module.exports = { runLighthouse: new LighthouseService().runLighthouse.bind(new LighthouseService()) };
