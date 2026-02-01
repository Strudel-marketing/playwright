const fs = require('fs').promises;
const path = require('path');
const browserPool = require('../../utils/browserPool');
const store = require('./invoiceStore');

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads', 'invoices');

class InvoiceService {
  constructor() {
    this._ensureDir();
    // Active analysis sessions: sessionId -> { page, context, createdAt }
    this._sessions = new Map();
    // Auto-cleanup sessions after 5 minutes
    setInterval(() => this._cleanupSessions(), 60000);
  }

  _cleanupSessions() {
    const maxAge = 5 * 60 * 1000;
    for (const [id, session] of this._sessions) {
      if (Date.now() - session.createdAt > maxAge) {
        browserPool.releasePageObject(session).catch(() => {});
        this._sessions.delete(id);
      }
    }
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
   * Analyze a URL and suggest selectors for login forms, download buttons, etc.
   * Returns structured suggestions the UI can use to auto-populate steps.
   */
  async analyzePage(url) {
    const { page, context } = await browserPool.acquire();
    const analysis = { url, forms: [], downloadLinks: [], navigation: [], screenshot: null };

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      analysis.finalUrl = page.url();
      analysis.title = await page.title();

      // --- Detect all forms and their fields ---
      analysis.forms = await page.evaluate(() => {
        const forms = [];
        // Check explicit <form> tags and also look for implicit login patterns
        const formEls = document.querySelectorAll('form');
        const processed = new Set();

        function describeInput(el) {
          const type = el.type || el.tagName.toLowerCase();
          const name = el.name || '';
          const id = el.id || '';
          const placeholder = el.placeholder || '';
          const label = el.labels?.[0]?.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label') || '';

          // Build best selector
          let selector = '';
          if (id) selector = `#${CSS.escape(id)}`;
          else if (name) selector = `${el.tagName.toLowerCase()}[name="${name}"]`;
          else if (el.type && el.type !== 'text') selector = `input[type="${el.type}"]`;

          // Guess the purpose
          let purpose = 'unknown';
          const allText = (name + id + placeholder + label + ariaLabel + (el.type || '')).toLowerCase();
          if (allText.match(/email|mail|אימייל|דוא/)) purpose = 'email';
          else if (allText.match(/user|username|שם.?משתמש|login/)) purpose = 'username';
          else if (allText.match(/pass|password|סיסמ/)) purpose = 'password';
          else if (allText.match(/phone|טלפון|נייד|mobile/)) purpose = 'phone';
          else if (allText.match(/otp|code|קוד|אימות|verify/)) purpose = 'otp';
          else if (type === 'password') purpose = 'password';
          else if (type === 'email') purpose = 'email';

          return { type, name, id, placeholder, label: label || ariaLabel, selector, purpose, tagName: el.tagName.toLowerCase() };
        }

        function describeButton(el) {
          const text = el.textContent?.trim() || '';
          const type = el.type || '';
          const id = el.id || '';
          let selector = '';
          if (id) selector = `#${CSS.escape(id)}`;
          else if (type === 'submit') selector = `button[type="submit"], input[type="submit"]`;
          else selector = el.tagName.toLowerCase();

          let purpose = 'submit';
          const allText = (text + id + (el.className || '')).toLowerCase();
          if (allText.match(/login|sign.?in|כניס|התחבר|enter/)) purpose = 'login';
          else if (allText.match(/register|sign.?up|הרשמ/)) purpose = 'register';
          else if (allText.match(/forgot|reset|שכח|איפוס/)) purpose = 'forgot_password';

          return { text, type, id, selector, purpose };
        }

        formEls.forEach((form, idx) => {
          const inputs = Array.from(form.querySelectorAll('input, select, textarea'))
            .filter(el => !['hidden', 'submit', 'button'].includes(el.type))
            .map(describeInput);

          const buttons = Array.from(form.querySelectorAll('button, input[type="submit"], [role="button"]'))
            .map(describeButton);

          // Determine form type
          const allPurposes = inputs.map(i => i.purpose).join(',');
          let formType = 'unknown';
          if (allPurposes.match(/password/) && allPurposes.match(/email|username/)) formType = 'login';
          else if (allPurposes.match(/email|username/) && !allPurposes.match(/password/)) formType = 'email_only_login';
          else if (allPurposes.match(/otp/)) formType = 'otp_verification';

          inputs.forEach(i => processed.add(i.selector));

          forms.push({
            index: idx,
            action: form.action || '',
            method: form.method || '',
            formType,
            inputs,
            buttons,
            selector: form.id ? `#${CSS.escape(form.id)}` : `form:nth-of-type(${idx + 1})`
          });
        });

        // Also look for "loose" inputs not inside a form (common in SPA login pages)
        const looseInputs = Array.from(document.querySelectorAll('input, select, textarea'))
          .filter(el => !el.closest('form') && !['hidden', 'submit', 'button'].includes(el.type))
          .map(describeInput)
          .filter(i => !processed.has(i.selector));

        const looseButtons = Array.from(document.querySelectorAll('button, [role="button"], a.btn, a.button'))
          .filter(el => !el.closest('form'))
          .map(describeButton)
          .filter(b => b.purpose === 'login' || b.text.length > 0);

        if (looseInputs.length > 0) {
          const allPurposes = looseInputs.map(i => i.purpose).join(',');
          let formType = 'unknown';
          if (allPurposes.match(/password/) && allPurposes.match(/email|username/)) formType = 'login';
          else if (allPurposes.match(/email|username/)) formType = 'email_only_login';

          forms.push({
            index: -1,
            action: '',
            method: '',
            formType,
            inputs: looseInputs,
            buttons: looseButtons.slice(0, 5),
            selector: 'body (no form tag)',
            isLoose: true
          });
        }

        return forms;
      });

      // --- Detect download links and buttons ---
      analysis.downloadLinks = await page.evaluate(() => {
        const results = [];

        // Links with download-like hrefs
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.href || '';
          const text = a.textContent?.trim() || '';
          const allText = (href + text + (a.className || '') + (a.id || '')).toLowerCase();

          const isDownload = a.hasAttribute('download') ||
            allText.match(/download|הורד|חשבונית|invoice|receipt|קבלה|pdf|excel|csv|export|ייצוא/) ||
            href.match(/\.(pdf|xlsx|xls|csv|doc|docx|zip)(\?|$)/i);

          if (isDownload) {
            let selector = '';
            if (a.id) selector = `#${CSS.escape(a.id)}`;
            else if (a.className) selector = `a.${a.className.split(/\s+/)[0]}`;
            else selector = `a[href*="${href.split('/').pop()?.split('?')[0] || ''}"]`;

            results.push({
              text,
              href: href.substring(0, 200),
              selector,
              hasDownloadAttr: a.hasAttribute('download'),
              fileType: (href.match(/\.(pdf|xlsx|xls|csv|doc|docx|zip)/i) || [])[1] || 'unknown'
            });
          }
        });

        // Buttons that look like downloads
        document.querySelectorAll('button, [role="button"]').forEach(btn => {
          const text = btn.textContent?.trim() || '';
          const allText = (text + (btn.className || '') + (btn.id || '')).toLowerCase();

          if (allText.match(/download|הורד|חשבונית|invoice|export|ייצוא|pdf|excel/)) {
            let selector = '';
            if (btn.id) selector = `#${CSS.escape(btn.id)}`;
            else if (btn.className) selector = `button.${btn.className.split(/\s+/)[0]}`;

            results.push({
              text,
              href: '',
              selector,
              hasDownloadAttr: false,
              fileType: 'unknown',
              isButton: true
            });
          }
        });

        return results;
      });

      // --- Detect navigation links (invoices pages, billing, account, etc.) ---
      analysis.navigation = await page.evaluate(() => {
        const results = [];
        const seen = new Set();

        document.querySelectorAll('a[href], [role="link"]').forEach(a => {
          const href = a.href || '';
          const text = a.textContent?.trim() || '';
          if (!text || text.length > 60 || seen.has(href)) return;
          seen.add(href);

          const allText = (href + text).toLowerCase();
          const isRelevant = allText.match(/invoice|billing|חשבונ|חיוב|payment|תשלום|receipt|קבלה|account|חשבון|document|מסמכ|report|דו"?ח|statement|הצהר|order|הזמנ|subscription|מנוי|finance|כספ/);

          if (isRelevant) {
            let selector = '';
            if (a.id) selector = `#${CSS.escape(a.id)}`;
            else selector = `a[href*="${new URL(href, document.baseURI).pathname}"]`;

            results.push({ text, href: href.substring(0, 200), selector });
          }
        });

        return results.slice(0, 15);
      });

      // --- Generate suggested steps ---
      analysis.suggestedLoginSteps = [];
      analysis.suggestedDownloadSteps = [];

      // Find the best login form
      const loginForm = analysis.forms.find(f => f.formType === 'login') ||
                        analysis.forms.find(f => f.formType === 'email_only_login') ||
                        analysis.forms[0];

      if (loginForm) {
        for (const input of loginForm.inputs) {
          if (input.purpose === 'email' || input.purpose === 'username') {
            analysis.suggestedLoginSteps.push({
              action: 'type', selector: input.selector,
              text: '{{username}}',
              description: input.label || input.placeholder || input.purpose
            });
          } else if (input.purpose === 'password') {
            analysis.suggestedLoginSteps.push({
              action: 'type', selector: input.selector,
              text: '{{password}}',
              description: input.label || input.placeholder || 'password'
            });
          }
        }
        // Add submit button
        const loginBtn = loginForm.buttons.find(b => b.purpose === 'login') || loginForm.buttons[0];
        if (loginBtn) {
          analysis.suggestedLoginSteps.push({
            action: 'click', selector: loginBtn.selector,
            description: loginBtn.text || 'submit'
          });
        }
      }

      // Suggest navigation to invoices page if found
      if (analysis.navigation.length > 0) {
        const invoicePage = analysis.navigation.find(n =>
          n.text.toLowerCase().match(/invoice|חשבונ/)
        ) || analysis.navigation[0];

        analysis.suggestedDownloadSteps.push({
          action: 'navigate', url: invoicePage.href,
          selector: invoicePage.selector,
          description: `נווט ל: ${invoicePage.text}`
        });
      }

      // Suggest download buttons
      if (analysis.downloadLinks.length > 0) {
        const best = analysis.downloadLinks[0];
        analysis.suggestedDownloadSteps.push({
          action: analysis.downloadLinks.length > 1 ? 'downloadAll' : 'download',
          selector: best.selector,
          description: `${best.text || 'download'} (${best.fileType})`
        });
      }

      // Screenshot
      const screenshot = await page.screenshot({ fullPage: false });
      analysis.screenshot = screenshot.toString('base64');

    } catch (error) {
      analysis.error = error.message;
      try {
        const screenshot = await page.screenshot({ fullPage: false });
        analysis.screenshot = screenshot.toString('base64');
      } catch {}
    } finally {
      await browserPool.releasePageObject({ page, context });
    }

    return analysis;
  }

  /**
   * Start an interactive analysis session - keeps browser open for multi-screen exploration.
   * Returns a sessionId to use in subsequent calls.
   */
  async startSession(url) {
    const { page, context } = await browserPool.acquire();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    this._sessions.set(sessionId, { page, context, createdAt: Date.now() });

    const scan = await this._scanCurrentPage(page);
    return { sessionId, ...scan };
  }

  /**
   * Execute an action in an active session, then re-scan the page.
   * action: { type: 'click'|'type'|'navigate'|'wait', selector, text, url, time }
   */
  async sessionAction(sessionId, action) {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error('Session not found or expired');
    session.createdAt = Date.now(); // refresh TTL

    let { page, context } = session;
    const urlBefore = page.url();

    switch (action.type) {
      case 'click': {
        // Click may trigger navigation - race waitForNavigation with a timeout
        const navPromise = page.waitForNavigation({ timeout: 8000, waitUntil: 'networkidle' }).catch(() => null);
        await page.click(action.selector, { timeout: 10000 });
        // Also listen for popup (new tab)
        const popupPromise = new Promise(resolve => {
          const handler = (popup) => { resolve(popup); };
          context.once('page', handler);
          setTimeout(() => { context.removeListener('page', handler); resolve(null); }, 3000);
        });
        // Wait for either navigation or popup
        const [navResult, popup] = await Promise.all([navPromise, popupPromise]);
        // If a new tab opened, switch to it
        if (popup) {
          await popup.waitForLoadState('networkidle').catch(() => {});
          session.page = popup;
          page = popup;
        }
        break;
      }
      case 'type':
        await page.fill(action.selector, action.text || '', { timeout: 10000 });
        break;
      case 'navigate':
        await page.goto(action.url, { waitUntil: 'networkidle', timeout: 30000 });
        break;
      case 'select':
        await page.selectOption(action.selector, action.value, { timeout: 10000 });
        break;
      case 'wait':
        if (action.selector) await page.waitForSelector(action.selector, { timeout: action.time || 10000 });
        else await new Promise(r => setTimeout(r, action.time || 2000));
        break;
      case 'pressKey':
        await page.keyboard.press(action.key || 'Enter');
        break;
    }

    // Wait for page to settle after action
    if (action.type !== 'click') {
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    // Extra settle time for SPAs that render after navigation
    await new Promise(r => setTimeout(r, 800));
    // If URL changed or it was a click, wait for domcontentloaded too
    if (page.url() !== urlBefore || action.type === 'click') {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await new Promise(r => setTimeout(r, 500));
    }

    const scan = await this._scanCurrentPage(page);
    return { sessionId, ...scan };
  }

  /**
   * Re-scan the current page in an active session without performing any action.
   */
  async sessionScan(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error('Session not found or expired');
    session.createdAt = Date.now();
    const scan = await this._scanCurrentPage(session.page);
    return { sessionId, ...scan };
  }

  /**
   * Close an analysis session
   */
  async closeSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return;
    await browserPool.releasePageObject(session);
    this._sessions.delete(sessionId);
  }

  /**
   * Scan current page state - extract forms, links, downloads, screenshot.
   * This is the core analysis logic, reusable across single-shot and session modes.
   */
  async _scanCurrentPage(page) {
    const analysis = { forms: [], downloadLinks: [], navigation: [], clickableElements: [] };

    analysis.currentUrl = page.url();
    analysis.title = await page.title();

    // Detect forms (reuse the same evaluate from analyzePage)
    analysis.forms = await page.evaluate(() => {
      const forms = [];
      const formEls = document.querySelectorAll('form');
      const processed = new Set();

      function describeInput(el) {
        const type = el.type || el.tagName.toLowerCase();
        const name = el.name || '';
        const id = el.id || '';
        const placeholder = el.placeholder || '';
        const label = el.labels?.[0]?.textContent?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        let selector = '';
        if (id) selector = `#${CSS.escape(id)}`;
        else if (name) selector = `${el.tagName.toLowerCase()}[name="${name}"]`;
        else if (el.type && el.type !== 'text') selector = `input[type="${el.type}"]`;
        let purpose = 'unknown';
        const allText = (name + id + placeholder + label + ariaLabel + (el.type || '')).toLowerCase();
        if (allText.match(/email|mail|אימייל|דוא/)) purpose = 'email';
        else if (allText.match(/user|username|שם.?משתמש|login/)) purpose = 'username';
        else if (allText.match(/pass|password|סיסמ/)) purpose = 'password';
        else if (allText.match(/phone|טלפון|נייד|mobile/)) purpose = 'phone';
        else if (allText.match(/otp|code|קוד|אימות|verify/)) purpose = 'otp';
        else if (type === 'password') purpose = 'password';
        else if (type === 'email') purpose = 'email';
        return { type, name, id, placeholder, label: label || ariaLabel, selector, purpose, tagName: el.tagName.toLowerCase() };
      }

      function describeButton(el) {
        const text = el.textContent?.trim() || '';
        const type = el.type || '';
        const id = el.id || '';
        let selector = '';
        if (id) selector = `#${CSS.escape(id)}`;
        else if (type === 'submit') selector = `button[type="submit"], input[type="submit"]`;
        else selector = el.tagName.toLowerCase();
        let purpose = 'submit';
        const allText = (text + id + (el.className || '')).toLowerCase();
        if (allText.match(/login|sign.?in|כניס|התחבר|enter/)) purpose = 'login';
        else if (allText.match(/register|sign.?up|הרשמ/)) purpose = 'register';
        else if (allText.match(/forgot|reset|שכח|איפוס/)) purpose = 'forgot_password';
        return { text, type, id, selector, purpose };
      }

      formEls.forEach((form, idx) => {
        const inputs = Array.from(form.querySelectorAll('input, select, textarea'))
          .filter(el => !['hidden', 'submit', 'button'].includes(el.type)).map(describeInput);
        const buttons = Array.from(form.querySelectorAll('button, input[type="submit"], [role="button"]')).map(describeButton);
        const allPurposes = inputs.map(i => i.purpose).join(',');
        let formType = 'unknown';
        if (allPurposes.match(/password/) && allPurposes.match(/email|username/)) formType = 'login';
        else if (allPurposes.match(/email|username/) && !allPurposes.match(/password/)) formType = 'email_only_login';
        else if (allPurposes.match(/otp/)) formType = 'otp_verification';
        inputs.forEach(i => processed.add(i.selector));
        forms.push({ index: idx, action: form.action || '', method: form.method || '', formType, inputs, buttons, selector: form.id ? `#${CSS.escape(form.id)}` : `form:nth-of-type(${idx + 1})` });
      });

      const looseInputs = Array.from(document.querySelectorAll('input, select, textarea'))
        .filter(el => !el.closest('form') && !['hidden', 'submit', 'button'].includes(el.type))
        .map(describeInput).filter(i => !processed.has(i.selector));
      const looseButtons = Array.from(document.querySelectorAll('button, [role="button"], a.btn, a.button'))
        .filter(el => !el.closest('form')).map(describeButton).filter(b => b.purpose === 'login' || b.text.length > 0);
      if (looseInputs.length > 0) {
        const allPurposes = looseInputs.map(i => i.purpose).join(',');
        let formType = 'unknown';
        if (allPurposes.match(/password/) && allPurposes.match(/email|username/)) formType = 'login';
        else if (allPurposes.match(/email|username/)) formType = 'email_only_login';
        forms.push({ index: -1, action: '', method: '', formType, inputs: looseInputs, buttons: looseButtons.slice(0, 5), selector: 'body (no form tag)', isLoose: true });
      }
      return forms;
    });

    // Detect download links
    analysis.downloadLinks = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href || '';
        const text = a.textContent?.trim() || '';
        const allText = (href + text + (a.className || '') + (a.id || '')).toLowerCase();
        const isDownload = a.hasAttribute('download') ||
          allText.match(/download|הורד|חשבונית|invoice|receipt|קבלה|pdf|excel|csv|export|ייצוא/) ||
          href.match(/\.(pdf|xlsx|xls|csv|doc|docx|zip)(\?|$)/i);
        if (isDownload) {
          let selector = '';
          if (a.id) selector = `#${CSS.escape(a.id)}`;
          else if (a.className) selector = `a.${a.className.split(/\s+/)[0]}`;
          else selector = `a[href*="${href.split('/').pop()?.split('?')[0] || ''}"]`;
          results.push({ text, href: href.substring(0, 200), selector, hasDownloadAttr: a.hasAttribute('download'), fileType: (href.match(/\.(pdf|xlsx|xls|csv|doc|docx|zip)/i) || [])[1] || 'unknown' });
        }
      });
      document.querySelectorAll('button, [role="button"]').forEach(btn => {
        const text = btn.textContent?.trim() || '';
        const allText = (text + (btn.className || '') + (btn.id || '')).toLowerCase();
        if (allText.match(/download|הורד|חשבונית|invoice|export|ייצוא|pdf|excel/)) {
          let selector = '';
          if (btn.id) selector = `#${CSS.escape(btn.id)}`;
          else if (btn.className) selector = `button.${btn.className.split(/\s+/)[0]}`;
          results.push({ text, href: '', selector, hasDownloadAttr: false, fileType: 'unknown', isButton: true });
        }
      });
      return results;
    });

    // Detect navigation links
    analysis.navigation = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      document.querySelectorAll('a[href], [role="link"]').forEach(a => {
        const href = a.href || '';
        const text = a.textContent?.trim() || '';
        if (!text || text.length > 60 || seen.has(href)) return;
        seen.add(href);
        const allText = (href + text).toLowerCase();
        const isRelevant = allText.match(/invoice|billing|חשבונ|חיוב|payment|תשלום|receipt|קבלה|account|חשבון|document|מסמכ|report|דו"?ח|statement|הצהר|order|הזמנ|subscription|מנוי|finance|כספ/);
        if (isRelevant) {
          let selector = '';
          if (a.id) selector = `#${CSS.escape(a.id)}`;
          else selector = `a[href*="${new URL(href, document.baseURI).pathname}"]`;
          results.push({ text, href: href.substring(0, 200), selector });
        }
      });
      return results.slice(0, 15);
    });

    // Detect general clickable elements (buttons, tabs, menus) for multi-screen navigation
    analysis.clickableElements = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      document.querySelectorAll('button, [role="button"], [role="tab"], [role="menuitem"], .nav-link, .menu-item, [onclick], a[href]').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (!text || text.length > 50 || text.length < 2) return;
        const id = el.id || '';
        const key = text + id;
        if (seen.has(key)) return;
        seen.add(key);

        // Skip external links and mailto
        const href = el.href || '';
        if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

        let selector = '';
        if (id) selector = `#${CSS.escape(id)}`;
        else if (el.className && typeof el.className === 'string') {
          const cls = el.className.split(/\s+/).filter(c => c.length > 0 && c.length < 30)[0];
          if (cls) selector = `${el.tagName.toLowerCase()}.${cls}`;
        }
        if (!selector) {
          // Fallback: use text-based selector
          if (el.tagName === 'A' && href) {
            try { selector = `a[href*="${new URL(href, document.baseURI).pathname}"]`; } catch {}
          }
          if (!selector) return;
        }

        const allText = (text + id + (el.className || '')).toLowerCase();
        let category = 'other';
        if (allText.match(/menu|תפריט|nav/)) category = 'menu';
        else if (allText.match(/tab|לשונית/)) category = 'tab';
        else if (allText.match(/invoice|חשבונ|billing|חיוב|payment|תשלום|finance|כספ|report|דו"?ח|document|מסמכ/)) category = 'relevant';
        else if (allText.match(/account|חשבון|setting|הגדר|profile|פרופיל|dashboard|ראשי|home|בית/)) category = 'navigation';

        results.push({ text, selector, category, tagName: el.tagName.toLowerCase(), href: href.substring(0, 200) });
      });
      // Sort: relevant first, then navigation, then menu/tab, then other
      const order = { relevant: 0, navigation: 1, menu: 2, tab: 3, other: 4 };
      results.sort((a, b) => (order[a.category] || 4) - (order[b.category] || 4));
      return results.slice(0, 30);
    });

    // Generate suggestions
    analysis.suggestedLoginSteps = [];
    analysis.suggestedDownloadSteps = [];

    const loginForm = analysis.forms.find(f => f.formType === 'login') ||
                      analysis.forms.find(f => f.formType === 'email_only_login') ||
                      analysis.forms[0];
    if (loginForm) {
      for (const input of loginForm.inputs) {
        if (input.purpose === 'email' || input.purpose === 'username') {
          analysis.suggestedLoginSteps.push({ action: 'type', selector: input.selector, text: '{{username}}', description: input.label || input.placeholder || input.purpose });
        } else if (input.purpose === 'password') {
          analysis.suggestedLoginSteps.push({ action: 'type', selector: input.selector, text: '{{password}}', description: input.label || input.placeholder || 'password' });
        }
      }
      const loginBtn = loginForm.buttons.find(b => b.purpose === 'login') || loginForm.buttons[0];
      if (loginBtn) {
        analysis.suggestedLoginSteps.push({ action: 'click', selector: loginBtn.selector, description: loginBtn.text || 'submit' });
      }
    }

    if (analysis.navigation.length > 0) {
      const invoicePage = analysis.navigation.find(n => n.text.toLowerCase().match(/invoice|חשבונ/)) || analysis.navigation[0];
      analysis.suggestedDownloadSteps.push({ action: 'navigate', url: invoicePage.href, selector: invoicePage.selector, description: `נווט ל: ${invoicePage.text}` });
    }
    if (analysis.downloadLinks.length > 0) {
      const best = analysis.downloadLinks[0];
      analysis.suggestedDownloadSteps.push({ action: analysis.downloadLinks.length > 1 ? 'downloadAll' : 'download', selector: best.selector, description: `${best.text || 'download'} (${best.fileType})` });
    }

    // Screenshot
    const screenshot = await page.screenshot({ fullPage: false });
    analysis.screenshot = screenshot.toString('base64');

    return analysis;
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
