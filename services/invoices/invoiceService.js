const fs = require('fs').promises;
const path = require('path');
const browserPool = require('../../utils/browserPool');
const store = require('./invoiceStore');

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads', 'invoices');

class InvoiceService {
  constructor() {
    this._ensureDir();
  }

  async _ensureDir() {
    try { await fs.mkdir(DOWNLOADS_DIR, { recursive: true }); } catch {}
  }

  /**
   * Run an invoice download for a configured site
   */
  async runSite(siteId) {
    const site = await store.getSite(siteId);
    if (!site) throw new Error(`Site not found: ${siteId}`);
    return this.executeFlow(site);
  }

  /**
   * Execute a full invoice download flow
   */
  async executeFlow(site) {
    const { page, context } = await browserPool.acquire();
    const results = { siteId: site.id, siteName: site.name, actions: [], downloads: [] };
    const startTime = Date.now();

    try {
      // Step 1: Navigate to login/start URL
      const startUrl = site.loginUrl || site.url;
      await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 30000 });
      results.actions.push({ step: 'navigate', url: startUrl, success: true });

      // Step 2: Handle login if credentials exist
      if (site.credentials && site.loginSteps) {
        for (const step of site.loginSteps) {
          await this._executeStep(page, step, site.credentials);
          results.actions.push({ step: step.action, selector: step.selector, success: true });
        }
        // Wait for login to complete
        if (site.loginWaitFor) {
          await page.waitForSelector(site.loginWaitFor, { timeout: 15000 });
        } else {
          await page.waitForLoadState('networkidle');
        }
        results.actions.push({ step: 'login_complete', success: true });
      }

      // Step 3: Navigate to invoices page if different from login
      if (site.invoicesUrl) {
        await page.goto(site.invoicesUrl, { waitUntil: 'networkidle', timeout: 30000 });
        results.actions.push({ step: 'navigate_invoices', url: site.invoicesUrl, success: true });
      }

      // Step 4: Execute pre-download steps (e.g., selecting date range, filters)
      if (site.preDownloadSteps) {
        for (const step of site.preDownloadSteps) {
          await this._executeStep(page, step, site.credentials);
          results.actions.push({ step: step.action, selector: step.selector, success: true });
        }
      }

      // Step 5: Download invoices
      if (site.downloadSteps) {
        for (const step of site.downloadSteps) {
          if (step.action === 'downloadAll') {
            // Download multiple files by iterating over selectors
            const elements = await page.$$(step.selector);
            for (let i = 0; i < elements.length; i++) {
              const file = await this._downloadFile(page, elements[i], step, site);
              if (file) results.downloads.push(file);
            }
          } else if (step.action === 'download') {
            const file = await this._downloadBySelector(page, step, site);
            if (file) results.downloads.push(file);
          }
        }
      }

      results.success = true;
      results.executionTime = Date.now() - startTime;

      // Take final screenshot for verification
      const screenshot = await page.screenshot({ fullPage: false });
      results.finalScreenshot = screenshot.toString('base64');

    } catch (error) {
      results.success = false;
      results.error = error.message;
      results.executionTime = Date.now() - startTime;

      // Capture error screenshot
      try {
        const screenshot = await page.screenshot({ fullPage: false });
        results.errorScreenshot = screenshot.toString('base64');
      } catch {}
    } finally {
      await browserPool.releasePageObject({ page, context });
    }

    // Save to history
    await store.addHistory({
      siteId: site.id,
      siteName: site.name,
      success: results.success,
      downloadsCount: results.downloads.length,
      executionTime: results.executionTime,
      error: results.error || null,
      downloadFiles: results.downloads.map(d => ({ filename: d.filename, size: d.size }))
    });

    return results;
  }

  /**
   * Execute a single step on the page
   */
  async _executeStep(page, step, credentials = {}) {
    const timeout = step.timeout || 5000;

    switch (step.action) {
      case 'click':
        await page.click(step.selector, { timeout });
        break;

      case 'type': {
        // Support credential references like {{username}}
        let text = step.text || '';
        text = text.replace(/\{\{(\w+)\}\}/g, (_, key) => credentials[key] || '');
        if (step.clear !== false) {
          await page.fill(step.selector, text, { timeout });
        } else {
          await page.type(step.selector, text, { timeout });
        }
        break;
      }

      case 'select':
        await page.selectOption(step.selector, step.value, { timeout });
        break;

      case 'wait':
        if (step.selector) {
          await page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
        } else if (step.time) {
          await new Promise(r => setTimeout(r, step.time));
        } else if (step.navigation) {
          await page.waitForNavigation({ timeout: step.timeout || 30000 });
        }
        break;

      case 'navigate':
        await page.goto(step.url, { waitUntil: 'networkidle', timeout: 30000 });
        break;

      case 'pressKey':
        await page.keyboard.press(step.key);
        break;

      default:
        console.warn(`Unknown step action: ${step.action}`);
    }

    // Optional delay after step
    if (step.delay) {
      await new Promise(r => setTimeout(r, step.delay));
    }
  }

  /**
   * Download a file by clicking a selector
   */
  async _downloadBySelector(page, step, site) {
    try {
      const [download] = await Promise.all([
        page.waitForDownload({ timeout: step.timeout || 30000 }),
        page.click(step.selector)
      ]);

      return this._saveDownload(download, site);
    } catch (error) {
      console.error(`Download failed for selector ${step.selector}:`, error.message);
      return null;
    }
  }

  /**
   * Download a file by clicking an element handle
   */
  async _downloadFile(page, element, step, site) {
    try {
      const [download] = await Promise.all([
        page.waitForDownload({ timeout: step.timeout || 30000 }),
        element.click()
      ]);

      return this._saveDownload(download, site);
    } catch (error) {
      console.error('Download failed:', error.message);
      return null;
    }
  }

  /**
   * Save a downloaded file to disk
   */
  async _saveDownload(download, site) {
    const filename = download.suggestedFilename();
    const siteDir = path.join(DOWNLOADS_DIR, site.id);
    await fs.mkdir(siteDir, { recursive: true });

    const dateStr = new Date().toISOString().split('T')[0];
    const savePath = path.join(siteDir, `${dateStr}_${filename}`);
    await download.saveAs(savePath);

    const stats = await fs.stat(savePath);

    return {
      filename: `${dateStr}_${filename}`,
      originalFilename: filename,
      path: savePath,
      size: stats.size,
      downloadedAt: new Date().toISOString()
    };
  }

  /**
   * List downloaded files for a site
   */
  async listDownloads(siteId) {
    const siteDir = path.join(DOWNLOADS_DIR, siteId);
    try {
      const files = await fs.readdir(siteDir);
      const fileInfos = [];
      for (const file of files) {
        const filePath = path.join(siteDir, file);
        const stats = await fs.stat(filePath);
        fileInfos.push({
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime.toISOString()
        });
      }
      return fileInfos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch {
      return [];
    }
  }

  /**
   * Get a downloaded file's content as base64
   */
  async getDownloadFile(siteId, filename) {
    const filePath = path.join(DOWNLOADS_DIR, siteId, filename);
    const data = await fs.readFile(filePath);
    return {
      data: data.toString('base64'),
      filename,
      size: data.length
    };
  }

  /**
   * Test a site configuration by running login only
   */
  async testSite(site) {
    const { page, context } = await browserPool.acquire();
    const results = { steps: [] };

    try {
      const startUrl = site.loginUrl || site.url;
      await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 30000 });
      results.steps.push({ step: 'navigate', success: true });

      if (site.credentials && site.loginSteps) {
        for (const step of site.loginSteps) {
          try {
            await this._executeStep(page, step, site.credentials);
            results.steps.push({ step: `${step.action} ${step.selector || ''}`, success: true });
          } catch (err) {
            results.steps.push({ step: `${step.action} ${step.selector || ''}`, success: false, error: err.message });
            break;
          }
        }
      }

      // Wait a bit for page to settle
      await page.waitForLoadState('networkidle').catch(() => {});

      const screenshot = await page.screenshot({ fullPage: false });
      results.screenshot = screenshot.toString('base64');
      results.currentUrl = page.url();
      results.title = await page.title();
      results.success = results.steps.every(s => s.success);

    } catch (error) {
      results.success = false;
      results.error = error.message;
      try {
        const screenshot = await page.screenshot({ fullPage: false });
        results.screenshot = screenshot.toString('base64');
      } catch {}
    } finally {
      await browserPool.releasePageObject({ page, context });
    }

    return results;
  }
}

module.exports = new InvoiceService();
