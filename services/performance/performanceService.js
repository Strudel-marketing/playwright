const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

/**
 * Runs Lighthouse performance analysis on a given URL
 * @param {string} url - The URL to analyze
 * @param {Object} options - Optional configuration options
 * @returns {Object} Lighthouse analysis results
 */
async function runLighthouseAnalysis(url, options = {}) {
  const chrome = await chromeLauncher.launch({ 
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  const runnerOptions = {
    port: chrome.port,
    output: 'json',
    logLevel: 'info',
    onlyCategories: options.categories || ['performance', 'accessibility', 'seo', 'best-practices'],
    emulatedFormFactor: options.formFactor || 'mobile'
  };

  try {
    const runnerResult = await lighthouse(url, runnerOptions);
    
    return {
      timing: runnerResult.lhr.timing,
      lhr: runnerResult.lhr,
      report: runnerResult.report
    };
  } catch (error) {
    throw new Error(`Lighthouse analysis failed: ${error.message}`);
  } finally {
    await chrome.kill();
  }
}

module.exports = {
  runLighthouseAnalysis
};
