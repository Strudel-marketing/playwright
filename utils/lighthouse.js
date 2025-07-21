const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// Check if lighthouse CLI is available
let lighthouseAvailable = false;
let chromePath = null;

async function findChromePath() {
    // Try environment variable first
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }
    
    // Try common Playwright Chrome locations
    const possiblePaths = [
        '/ms-playwright/chromium-*/chrome-linux/chrome',
        '/ms-playwright/chromium-*/chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ];
    
    for (const pathPattern of possiblePaths) {
        try {
            if (pathPattern.includes('*')) {
                // Handle glob patterns
                const { stdout } = await execAsync(`ls ${pathPattern} 2>/dev/null | head -1`);
                const foundPath = stdout.trim();
                if (foundPath && fs.existsSync(foundPath)) {
                    return foundPath;
                }
            } else if (fs.existsSync(pathPattern)) {
                return pathPattern;
            }
        } catch (error) {
            // Continue to next path
        }
    }
    
    return null;
}

async function checkLighthouseAvailability() {
    try {
        // Find Chrome path
        chromePath = await findChromePath();
        console.log('🔍 Chrome path found:', chromePath);
        
        await execAsync('npx lighthouse --version');
        lighthouseAvailable = true;
        console.log('✅ Lighthouse CLI available');
        return true;
    } catch (error) {
        console.log('⚠️ Lighthouse CLI not available:', error.message);
        return false;
    }
}

// Initialize lighthouse availability check
checkLighthouseAvailability();

class LighthouseService {
    async runLighthouse(url, options = {}) {
        if (!lighthouseAvailable) {
            // Try to check availability again
            await checkLighthouseAvailability();
        }
        
        if (!lighthouseAvailable) {
            return {
                success: false,
                error: 'Lighthouse CLI not available',
                url
            };
        }

        try {
            // Create temporary output file
            const outputFile = path.join('/tmp', `lighthouse-${Date.now()}.json`);
            
            // Build lighthouse CLI command
            const categories = options.categories || ['performance', 'accessibility', 'best-practices', 'seo'];
            const categoriesFlag = categories.map(cat => `--only-categories=${cat}`).join(' ');
            
            // Build Chrome flags
            const chromeFlags = [
                '--headless',
                '--no-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--disable-extensions'
            ].join(' ');
            
            let command = `npx lighthouse "${url}" \
                --output=json \
                --output-path="${outputFile}" \
                --chrome-flags="${chromeFlags}" \
                --quiet \
                ${categoriesFlag}`;
            
            // Add Chrome path if available
            if (chromePath) {
                command = `CHROME_PATH="${chromePath}" ${command}`;
            }

            console.log('🚀 Running Lighthouse CLI for:', url);
            console.log('🔧 Using Chrome path:', chromePath || 'system default');
            
            // Execute lighthouse CLI
            const { stdout, stderr } = await execAsync(command, { 
                timeout: 90000, // 90 second timeout
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                env: { 
                    ...process.env, 
                    CHROME_PATH: chromePath || process.env.CHROME_PATH 
                }
            });

            // Read the output file
            if (!fs.existsSync(outputFile)) {
                throw new Error('Lighthouse output file not created');
            }

            const lighthouseResult = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            
            // Clean up temporary file
            fs.unlinkSync(outputFile);

            // Extract key metrics from lighthouse result
            const { categories: lhrCategories, audits } = lighthouseResult;

            const result = {
                success: true,
                url,
                timestamp: new Date().toISOString(),
                scores: {
                    performance: Math.round((lhrCategories.performance?.score || 0) * 100),
                    accessibility: Math.round((lhrCategories.accessibility?.score || 0) * 100),
                    bestPractices: Math.round((lhrCategories['best-practices']?.score || 0) * 100),
                    seo: Math.round((lhrCategories.seo?.score || 0) * 100)
                },
                metrics: {
                    firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
                    largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
                    cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
                    speedIndex: audits['speed-index']?.numericValue,
                    totalBlockingTime: audits['total-blocking-time']?.numericValue,
                    interactiveTime: audits['interactive']?.numericValue
                },
                categories: lhrCategories,
                audits: Object.keys(audits).reduce((acc, key) => {
                    const audit = audits[key];
                    if (audit.score !== null || audit.numericValue !== undefined) {
                        acc[key] = {
                            score: audit.score,
                            numericValue: audit.numericValue,
                            displayValue: audit.displayValue,
                            title: audit.title
                        };
                    }
                    return acc;
                }, {})
            };

            console.log('✅ Lighthouse analysis completed for:', url);
            return result;

        } catch (error) {
            console.error('❌ Lighthouse CLI execution failed:', error.message);
            return {
                success: false,
                error: `Lighthouse CLI execution failed: ${error.message}`,
                url
            };
        }
    }

    async runPerformanceOnly(url, options = {}) {
        return this.runLighthouse(url, { 
            ...options, 
            categories: ['performance'] 
        });
    }

    async runFullAudit(url, options = {}) {
        return this.runLighthouse(url, { 
            ...options, 
            categories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'] 
        });
    }
}

module.exports = new LighthouseService();
