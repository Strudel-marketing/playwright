// Try to load lighthouse dependencies with error handling
let lighthouse, chromeLauncher;

async function loadLighthouseDependencies() {
    try {
        // Use dynamic import for ES modules
        lighthouse = await import('lighthouse');
        chromeLauncher = await import('chrome-launcher');
        console.log('✅ Lighthouse dependencies loaded successfully');
        return true;
    } catch (error) {
        console.log('⚠️ Lighthouse dependencies not found, lighthouse features will be disabled:', error.message);
        return false;
    }
}

// Initialize dependencies on module load
let dependenciesLoaded = false;
loadLighthouseDependencies().then(loaded => {
    dependenciesLoaded = loaded;
});

class LighthouseService {
    async runLighthouse(url, options = {}) {
        // Ensure dependencies are loaded
        if (!dependenciesLoaded) {
            await loadLighthouseDependencies();
        }
        
        if (!lighthouse || !chromeLauncher) {
            return {
                success: false,
                error: 'Lighthouse dependencies not available',
                url
            };
        }

        let chrome;
        
        try {
            // Launch Chrome
            chrome = await chromeLauncher.default.launch({
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
            const runnerResult = await lighthouse.default(url, lighthouseOptions);

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
                    speedIndex: audits['speed-index']?.numericValue,
                    totalBlockingTime: audits['total-blocking-time']?.numericValue,
                    cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
                    timeToInteractive: audits['interactive']?.numericValue
                },
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

const lighthouseService = new LighthouseService();

module.exports = { 
    runLighthouse: lighthouseService.runLighthouse.bind(lighthouseService)
};
