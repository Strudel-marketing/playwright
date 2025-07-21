const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// Check if lighthouse CLI is available
let lighthouseAvailable = false;

async function checkLighthouseAvailability() {
    try {
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

  try {
    // Create temporary output file
    const outputFile = path.join('/tmp', `lighthouse-perf-${Date.now()}.json`);
    
    // Build lighthouse CLI command
    const categories = options.categories || ['performance'];
    const categoriesFlag = categories.map(cat => `--only-categories=${cat}`).join(' ');
    
    const command = `npx lighthouse "${url}" \
        --output=json \
        --output-path="${outputFile}" \
        --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" \
        --quiet \
        ${categoriesFlag}`;

    console.log('⚡ Running Lighthouse performance analysis for:', url);
    
    // Execute lighthouse CLI
    const { stdout, stderr } = await execAsync(command, { 
        timeout: 60000, // 60 second timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
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

    console.log('✅ Performance analysis completed for:', url);
    return result;

  } catch (error) {
    console.error('❌ Performance analysis failed:', error.message);
    return {
      success: false,
      error: `Performance analysis failed: ${error.message}`,
      url
    };
  }
}

module.exports = {
  runLighthouseAnalysis
};
