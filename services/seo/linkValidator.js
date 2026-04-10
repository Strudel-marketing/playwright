/**
 * Link Validator Module
 *
 * Validates internal and external links with rate limiting and timeouts.
 * Used by the site audit service to detect broken links.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Simple concurrency limiter (no external dependency needed)
function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  function next() {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  }

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

/**
 * Validate a single link using HEAD request with fallback to GET
 */
async function validateLink(url, timeoutMs = 5000) {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const makeRequest = (method) => {
      const req = client.request(parsedUrl, {
        method,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
          'Accept': '*/*'
        },
        // Don't follow redirects - we want to detect them
        maxRedirects: 0
      }, (res) => {
        // Consume response data to free up memory
        res.resume();

        const status = res.statusCode;

        if (status >= 400) {
          resolve({ url, status, type: 'broken' });
        } else if ([301, 302, 307, 308].includes(status)) {
          resolve({
            url,
            status,
            type: 'redirect',
            redirect_to: res.headers['location'] || ''
          });
        } else {
          resolve({ url, status, type: 'ok' });
        }
      });

      req.on('error', (err) => {
        // If HEAD fails, try GET (some servers block HEAD)
        if (method === 'HEAD') {
          makeRequest('GET');
          return;
        }
        resolve({ url, error: err.message, type: 'error' });
      });

      req.on('timeout', () => {
        req.destroy();
        if (method === 'HEAD') {
          makeRequest('GET');
          return;
        }
        resolve({ url, error: 'timeout', type: 'error' });
      });

      req.end();
    };

    makeRequest('HEAD');
  });
}

/**
 * Validate multiple links with concurrency control
 *
 * @param {string[]} links - Array of URLs to validate
 * @param {Object} options - Configuration options
 * @param {number} options.concurrency - Max concurrent requests (default: 10)
 * @param {number} options.timeout - Per-request timeout in ms (default: 5000)
 * @param {string[]} options.skipDomains - Domains to skip validation for
 * @returns {Object} Validation results with broken, redirect, and error links
 */
async function validateLinks(links, options = {}) {
  const {
    concurrency = 10,
    timeout = 5000,
    skipDomains = []
  } = options;

  // Deduplicate links
  const uniqueLinks = [...new Set(links)];

  // Filter out known-good domains
  const skipSet = new Set(skipDomains.map(d => d.toLowerCase()));
  const linksToCheck = uniqueLinks.filter(link => {
    try {
      const hostname = new URL(link).hostname.toLowerCase();
      return !skipSet.has(hostname);
    } catch {
      return false; // Skip malformed URLs
    }
  });

  const limit = createLimiter(concurrency);

  const results = await Promise.all(
    linksToCheck.map(link =>
      limit(() => validateLink(link, timeout))
    )
  );

  const broken = results.filter(r => r.type === 'broken');
  const redirects = results.filter(r => r.type === 'redirect');
  const errors = results.filter(r => r.type === 'error');
  const ok = results.filter(r => r.type === 'ok');

  return {
    total_checked: linksToCheck.length,
    total_skipped: uniqueLinks.length - linksToCheck.length,
    broken_links: broken,
    redirect_links: redirects,
    error_links: errors,
    ok_count: ok.length,
    broken_count: broken.length + errors.length,
    redirect_count: redirects.length
  };
}

module.exports = {
  validateLink,
  validateLinks,
  createLimiter
};
