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
        console.log('🔍 Performance service Chrome path found:', chromePath);
        
        await execAsync('npx lighthouse --version');
        lighthouseAvailable = true;
        console.log('✅ Performance service lighthouse CLI available');
        return true;
    } catch (error) {
        console.log('⚠️ Performance service lighthouse CLI not available:', error.message);
        return false;
    }
}

// Initialize lighthouse availability check
checkLighthouseAvailability();

/**
 * Clean up Chrome/Lighthouse processes
 * Prevents process accumulation and EAGAIN errors
 */
async function cleanupChromeProcesses() {
    try {
        console.log('🧹 Cleaning up Chrome/Lighthouse processes...');
        
        // Kill Chrome processes
        await execAsync('pkill -9 chrome 2>/dev/null || true');
        await execAsync('pkill -9 chromium 2>/dev/null || true');
        await execAsync('pkill -9 lighthouse 2>/dev/null || true');
        await execAsync('pkill -9 headless_shell 2>/dev/null || true');
        
        // Small delay to ensure processes are killed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('✅ Chrome cleanup completed');
    } catch (error) {
        console.warn('⚠️ Chrome cleanup warning:', error.message);
        // Don't throw - cleanup errors shouldn't fail the request
    }
}

/**
 * Clean up temporary files
 * @param {string} outputFile - Path to temp file
 */
async function cleanupTempFile(outputFile) {
    if (outputFile && fs.existsSync(outputFile)) {
        try {
            fs.unlinkSync(outputFile);
            console.log('🗑️ Temp file cleaned:', outputFile);
        } catch (error) {
            console.warn('⚠️ Failed to clean temp file:', error.message);
        }
    }
}

/**
 * Runs Lighthouse performance analysis on a given URL
 * @param {string} url - The URL to analyze
 * @param {Object} options - Optional configuration options
 * @returns {Object} Lighthouse analysis results
 */
async function runLighthouseAnalysis(url, options = {}) {
  if (!lighthouseAvailable) {
    // Try to check availability again
    await checkLighthouseAvailability();
  }
  
  if (!lighthouseAvailable) {
    return {
      success: false,
      error: 'Lighthouse CLI not available in performance service',
      url
    };
  }

  let outputFile = null;
  
  try {
    // Create temporary output file
    outputFile = path.join('/tmp', `lighthouse-perf-${Date.now()}.json`);
    
    // Build lighthouse CLI command
    const categories = options.categories || ['performance'];
    const categoriesFlag = categories.map(cat => `--only-categories=${cat}`).join(' ');
    
    // Build Chrome flags - optimized for server environment
    const chromeFlags = [
        '--headless',
        '--no-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--no-zygote',  // Reduces process count
        '--single-process'  // Use single process mode to reduce RAM
    ].join(' ');
    
    let command = `npx lighthouse "${url}" \
        --output=json \
        --output-path="${outputFile}" \
        --chrome-flags="${chromeFlags}" \
        --quiet \
        --max-wait-for-load=45000 \
        ${categoriesFlag}`;
    
    // Add Chrome path if available
    if (chromePath) {
        command = `CHROME_PATH="${chromePath}" ${command}`;
    }

    console.log('⚡ Running Lighthouse performance analysis for:', url);
    console.log('🔧 Using Chrome path:', chromePath || 'system default');
    
    // Execute lighthouse CLI
    const { stdout, stderr } = await execAsync(command, { 
        timeout: 180000, // 180 second timeout
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

    console.log('✅ Performance analysis completed for:', url);
    return result;

  } catch (error) {
    console.error('❌ Performance analysis failed:', error.message);
    return {
      success: false,
      error: `Performance analysis failed: ${error.message}`,
      url
    };
  } finally {
    // 🧹 CRITICAL: Always cleanup, even if there was an error
    
    // Clean up temp file
    await cleanupTempFile(outputFile);
    
    // Kill Chrome processes
    await cleanupChromeProcesses();
    
    console.log('🔄 Lighthouse cleanup completed for:', url);
  }
}

module.exports = {
  runLighthouseAnalysis
};
