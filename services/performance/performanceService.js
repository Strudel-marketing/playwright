// Try to load lighthouse dependencies with error handling
let lighthouse, chromeLauncher;

try {
    lighthouse = require('lighthouse');
    chromeLauncher = require('chrome-launcher');
    console.log('✅ Performance service lighthouse dependencies loaded successfully');
} catch (error) {
    console.log('⚠️ Performance service lighthouse dependencies not found, lighthouse features will be disabled:', error.message);
}

/**
 * Runs Lighthouse performance analysis on a given URL
 * @param {string} url - The URL to analyze
 * @param {Object} options - Optional configuration options
 * @returns {Object} Lighthouse analysis results
 */
async function runLighthouseAnalysis(url, options = {}) {
  if (!lighthouse || !chromeLauncher) {
    return {
      success: false,
      error: 'Lighthouse dependencies not available in performance service',
      url
    };
  }

  let chrome;
  
  try {
    chrome = await chromeLauncher.launch({ 
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
    });

    const runnerOptions = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
      ...options
    };

    const runnerResult = await lighthouse(url, runnerOptions);
    
    return {
      success: true,
      url,
      timestamp: new Date().toISOString(),
      data: runnerResult.lhr
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Lighthouse analysis failed: ${error.message}`,
      url
    };
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
}

module.exports = {
  runLighthouseAnalysis
};
