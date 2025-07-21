// Try to load lighthouse dependencies with error handling
let lighthouse, chromeLauncher;

async function loadLighthouseDependencies() {
    try {
        // Use dynamic import for ES modules
        lighthouse = await import('lighthouse');
        chromeLauncher = await import('chrome-launcher');
        console.log('✅ Performance service lighthouse dependencies loaded successfully');
        return true;
    } catch (error) {
        console.log('⚠️ Performance service lighthouse dependencies not found, lighthouse features will be disabled:', error.message);
        return false;
    }
}

// Initialize dependencies on module load
let dependenciesLoaded = false;
loadLighthouseDependencies().then(loaded => {
    dependenciesLoaded = loaded;
});

/**
 * Runs Lighthouse performance analysis on a given URL
 * @param {string} url - The URL to analyze
 * @param {Object} options - Optional configuration options
 * @returns {Object} Lighthouse analysis results
 */
async function runLighthouseAnalysis(url, options = {}) {
  // Ensure dependencies are loaded
  if (!dependenciesLoaded) {
    await loadLighthouseDependencies();
  }
  
  if (!lighthouse || !chromeLauncher) {
    return {
      success: false,
      error: 'Lighthouse dependencies not available in performance service',
      url
    };
  }

  let chrome;
  
  try {
    chrome = await chromeLauncher.default.launch({ 
      chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage']
    });

    const lighthouseOptions = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: options.categories || ['performance'],
      port: chrome.port,
      ...options
    };

    const runnerResult = await lighthouse.default(url, lighthouseOptions);
    
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
