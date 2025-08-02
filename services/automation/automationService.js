const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const browserPool = require('../../utils/browserPool');

/**
 * Automation service for handling automated web tasks
 */
class AutomationService {
  /**
   * Execute a sequence of actions on a web page
   * @param {string} url - Starting URL
   * @param {Array} actions - Array of actions to perform
   * @param {Object} options - Additional options
   * @returns {Object} - Results of the automation sequence
   */
  async executeActionSequence(url, actions, options = {}) {
    const { page, browser } = await browserPool.acquire();
    const results = [];
    const screenshots = [];
    
    try {
      const startTime = Date.now();
      await page.goto(url, { waitUntil: options.waitUntil || 'networkidle', timeout: options.timeout || 30000 });
      
      // Track navigation history
      const navigationHistory = [url];
      
      // Execute each action in sequence
      for (const action of actions) {
        const actionResult = { type: action.type, success: false, timestamp: new Date().toISOString() };
        
        try {
          switch (action.type) {
            case 'click':
              await page.click(action.selector, { timeout: action.timeout || 5000 });
              actionResult.success = true;
              actionResult.details = { selector: action.selector };
              break;
              
            case 'type':
              await page.fill(action.selector, action.text, { timeout: action.timeout || 5000 });
              actionResult.success = true;
              actionResult.details = { 
                selector: action.selector, 
                textLength: action.text.length 
              };
              break;
              
            case 'select':
              await page.selectOption(action.selector, action.value, { timeout: action.timeout || 5000 });
              actionResult.success = true;
              actionResult.details = { selector: action.selector, value: action.value };
              break;
              
            case 'wait':
              if (action.selector) {
                await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
                actionResult.details = { selector: action.selector };
              } else if (action.time) {
                await page.waitForTimeout(action.time);
                actionResult.details = { time: action.time };
              } else if (action.navigation) {
                await page.waitForNavigation({ timeout: action.timeout || 30000 });
                actionResult.details = { navigation: true };
              }
              actionResult.success = true;
              break;
              
            case 'screenshot':
              const screenshotBuffer = await page.screenshot({
                fullPage: action.fullPage || false,
                path: action.path || null,
                type: action.format || 'png',
                quality: action.format === 'jpeg' ? (action.quality || 80) : undefined,
              });
              
              const screenshotId = uuidv4();
              const screenshotData = screenshotBuffer.toString('base64');
              
              // Save screenshot to disk if requested
              if (action.save && action.path) {
                const directory = path.dirname(action.path);
                await fs.mkdir(directory, { recursive: true });
                await fs.writeFile(action.path, screenshotBuffer);
              }
              
              screenshots.push({
                id: screenshotId,
                format: action.format || 'png',
                data: action.includeData ? screenshotData : null,
                path: action.path || null
              });
              
              actionResult.success = true;
              actionResult.details = { 
                screenshotId,
                format: action.format || 'png',
                fullPage: action.fullPage || false,
                path: action.path || null
              };
              break;
              
            case 'extract':
              let extractedData = {};
              
              if (action.selectors) {
                for (const [key, selector] of Object.entries(action.selectors)) {
                  try {
                    extractedData[key] = await page.$eval(selector, el => el.textContent.trim());
                  } catch (err) {
                    extractedData[key] = null;
                  }
                }
              }
              
              if (action.attributes) {
                extractedData.attributes = {};
                for (const [key, config] of Object.entries(action.attributes)) {
                  try {
                    extractedData.attributes[key] = await page.$eval(
                      config.selector, 
                      (el, attr) => el.getAttribute(attr), 
                      config.attribute
                    );
                  } catch (err) {
                    extractedData.attributes[key] = null;
                  }
                }
              }
              
              actionResult.success = true;
              actionResult.details = { extractedData };
              break;
              
            case 'navigate':
              await page.goto(action.url, { 
                waitUntil: action.waitUntil || 'networkidle', 
                timeout: action.timeout || 30000 
              });
              navigationHistory.push(action.url);
              actionResult.success = true;
              actionResult.details = { url: action.url };
              break;
              
            case 'evaluate':
              const evalResult = await page.evaluate(action.script);
              actionResult.success = true;
              actionResult.details = { result: evalResult };
              break;

            case 'setCookies':
              // טעינת cookies לדף
              await page.context().addCookies(action.cookies);
              actionResult.success = true;
              actionResult.details = { cookiesSet: action.cookies.length };
              break;

            case 'download':
              // הורדת קובץ
              try {
                const [download] = await Promise.all([
                  page.waitForDownload({ timeout: action.timeout || 30000 }),
                  page.click(action.selector)
                ]);
                
                // קריאת הקובץ שהורד
                const downloadPath = await download.path();
                const fileData = await fs.readFile(downloadPath);
                
                // שמירת הנתונים בתוצאה
                actionResult.success = true;
                actionResult.details = {
                  filename: download.suggestedFilename(),
                  size: fileData.length,
                  mimeType: action.expectedMimeType || 'application/octet-stream'
                };
                
                // הוספת הקובץ לתוצאה הכללית
                actionResult.downloadedFile = {
                  data: fileData.toString('base64'),
                  filename: download.suggestedFilename(),
                  mimeType: action.expectedMimeType || 'application/pdf',
                  size: fileData.length
                };
                
                // מחיקת הקובץ הזמני
                await fs.unlink(downloadPath);
                
              } catch (downloadError) {
                actionResult.success = false;
                actionResult.error = `Download failed: ${downloadError.message}`;
              }
              break;
              
            default:
              throw new Error(`Unsupported action type: ${action.type}`);
          }
        } catch (actionError) {
          actionResult.success = false;
          actionResult.error = actionError.message;
          
          // Take error screenshot if configured
          if (options.screenshotOnError) {
            try {
              const errorScreenshotBuffer = await page.screenshot({ fullPage: true });
              const errorScreenshotId = uuidv4();
              
              screenshots.push({
                id: errorScreenshotId,
                format: 'png',
                data: options.includeErrorScreenshots ? errorScreenshotBuffer.toString('base64') : null,
                error: true
              });
              
              actionResult.errorScreenshotId = errorScreenshotId;
            } catch (screenshotError) {
              console.error('Failed to capture error screenshot:', screenshotError);
            }
          }
          
          // Stop sequence if configured to stop on error
          if (options.stopOnError) {
            break;
          }
        }
        
        results.push(actionResult);
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Get final page URL
      const finalUrl = page.url();
      
      return {
        success: results.every(r => r.success),
        startUrl: url,
        finalUrl,
        navigationHistory,
        executionTime,
        actions: results,
        screenshots: screenshots.map(s => ({
          id: s.id,
          format: s.format,
          path: s.path,
          error: s.error || false,
          data: s.data
        }))
      };
    } catch (error) {
      console.error('Automation sequence error:', error);
      return {
        success: false,
        startUrl: url,
        error: error.message,
        actions: results,
        screenshots
      };
    } finally {
      await browserPool.release(browser);
    }
  }

  /**
   * Fill and submit a form
   * @param {string} url - URL with the form
   * @param {Object} formData - Key-value pairs for form fields
   * @param {Object} options - Additional options
   * @returns {Object} - Form submission results
   */
  async fillForm(url, formData, options = {}) {
    const { page, browser } = await browserPool.acquire();
    
    try {
      await page.goto(url, { waitUntil: options.waitUntil || 'networkidle', timeout: options.timeout || 30000 });
      
      // Fill each form field
      for (const [selector, value] of Object.entries(formData)) {
        if (typeof value === 'string') {
          await page.fill(selector, value);
        } else if (Array.isArray(value)) {
          // For multi-select
          await page.selectOption(selector, value);
        } else if (typeof value === 'boolean') {
          // For checkboxes
          if (value) {
            await page.check(selector);
          } else {
            await page.uncheck(selector);
          }
        }
      }
      
      // Take screenshot before submission if requested
      let beforeSubmitScreenshot = null;
      if (options.screenshotBeforeSubmit) {
        beforeSubmitScreenshot = await page.screenshot({ 
          fullPage: options.fullPageScreenshot || false 
        });
      }
      
      // Submit the form
      if (options.submitSelector) {
        await page.click(options.submitSelector);
      } else if (options.submitButtonText) {
        await page.click(`button:has-text("${options.submitButtonText}")`);
      } else {
        // Try to find a submit button or input
        await page.click('input[type="submit"], button[type="submit"]');
      }
      
      // Wait for navigation or specific element after submission
      if (options.waitForNavigation) {
        await page.waitForNavigation({ timeout: options.timeout || 30000 });
      } else if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: options.timeout || 10000 });
      } else {
        // Default wait for network to be idle
        await page.waitForLoadState('networkidle');
      }
      
      // Take screenshot after submission if requested
      let afterSubmitScreenshot = null;
      if (options.screenshotAfterSubmit) {
        afterSubmitScreenshot = await page.screenshot({ 
          fullPage: options.fullPageScreenshot || false 
        });
      }
      
      // Extract submission result data if selectors provided
      let resultData = {};
      if (options.resultSelectors) {
        for (const [key, selector] of Object.entries(options.resultSelectors)) {
          try {
            resultData[key] = await page.$eval(selector, el => el.textContent.trim());
          } catch (err) {
            resultData[key] = null;
          }
        }
      }
      
      // Check for success indicators if provided
      let submissionSuccess = true;
      if (options.successSelector) {
        submissionSuccess = await page.$(options.successSelector) !== null;
      } else if (options.successText) {
        submissionSuccess = await page.getByText(options.successText).count() > 0;
      } else if (options.errorSelector) {
        submissionSuccess = await page.$(options.errorSelector) === null;
      }
      
      return {
        success: submissionSuccess,
        url: {
          initial: url,
          final: page.url()
        },
        formData,
        resultData,
        screenshots: {
          beforeSubmit: options.includeScreenshotData && beforeSubmitScreenshot ? 
            beforeSubmitScreenshot.toString('base64') : null,
          afterSubmit: options.includeScreenshotData && afterSubmitScreenshot ? 
            afterSubmitScreenshot.toString('base64') : null
        }
      };
    } catch (error) {
      console.error('Form submission error:', error);
      return {
        success: false,
        url: {
          initial: url,
          final: page ? page.url() : null
        },
        error: error.message,
        formData
      };
    } finally {
      await browserPool.release(browser);
    }
  }

  /**
   * Extract data from multiple pages by following pagination
   * @param {string} startUrl - Starting URL
   * @param {Object} extractionConfig - Configuration for data extraction
   * @param {Object} options - Additional options
   * @returns {Object} - Extracted data results
   */
  async extractDataWithPagination(startUrl, extractionConfig, options = {}) {
    const { page, browser } = await browserPool.acquire();
    const allExtractedData = [];
    const visitedUrls = new Set();
    let currentUrl = startUrl;
    let pageNum = 1;
    
    try {
      const maxPages = options.maxPages || 10;
      
      while (pageNum <= maxPages) {
        // Skip if URL was already visited (avoid loops)
        if (visitedUrls.has(currentUrl)) {
          break;
        }
        
        visitedUrls.add(currentUrl);
        await page.goto(currentUrl, { 
          waitUntil: options.waitUntil || 'networkidle', 
          timeout: options.timeout || 30000 
        });
        
        // Extract items from current page
        const pageItems = [];
        const itemSelectors = extractionConfig.itemSelector;
        const items = await page.$$(itemSelectors);
        
        for (const item of items) {
          const extractedItem = {};
          
          // Extract text fields
          if (extractionConfig.fields) {
            for (const [fieldName, fieldSelector] of Object.entries(extractionConfig.fields)) {
              try {
                extractedItem[fieldName] = await item.$eval(fieldSelector, el => el.textContent.trim());
              } catch (err) {
                extractedItem[fieldName] = null;
              }
            }
          }
          
          // Extract attributes
          if (extractionConfig.attributes) {
            for (const [attrName, attrConfig] of Object.entries(extractionConfig.attributes)) {
              try {
                extractedItem[attrName] = await item.$eval(
                  attrConfig.selector, 
                  (el, attr) => el.getAttribute(attr), 
                  attrConfig.attribute
                );
              } catch (err) {
                extractedItem[attrName] = null;
              }
            }
          }
          
          pageItems.push(extractedItem);
        }
        
        // Add page items to overall results
        allExtractedData.push({
          pageUrl: currentUrl,
          pageNumber: pageNum,
          items: pageItems
        });
        
        // Find next page link
        let nextPageUrl = null;
        if (extractionConfig.nextPageSelector) {
          try {
            nextPageUrl = await page.$eval(extractionConfig.nextPageSelector, 
              (el, baseUrl) => {
                const href = el.getAttribute('href');
                if (!href) return null;
                return href.startsWith('http') ? href : new URL(href, baseUrl).toString();
              }, 
              currentUrl
            );
          } catch (err) {
            // No next page found
            break;
          }
        }
        
        // Break if no next page found
        if (!nextPageUrl) {
          break;
        }
        
        currentUrl = nextPageUrl;
        pageNum++;
      }
      
      return {
        success: true,
        startUrl,
        pagesProcessed: pageNum,
        visitedUrls: Array.from(visitedUrls),
        totalItems: allExtractedData.reduce((sum, page) => sum + page.items.length, 0),
        data: allExtractedData
      };
    } catch (error) {
      console.error('Data extraction error:', error);
      return {
        success: false,
        startUrl,
        pagesProcessed: pageNum - 1,
        visitedUrls: Array.from(visitedUrls),
        error: error.message,
        data: allExtractedData
      };
    } finally {
      await browserPool.release(browser);
    }
  }

  /**
   * Monitor a webpage for changes
   * @param {string} url - URL to monitor
   * @param {Object} monitorConfig - Configuration for monitoring
   * @returns {Object} - Monitoring results
   */
  async monitorPageChanges(url, monitorConfig) {
    const { page, browser } = await browserPool.acquire();
    
    try {
      // First visit to capture baseline
      await page.goto(url, { 
        waitUntil: monitorConfig.waitUntil || 'networkidle', 
        timeout: monitorConfig.timeout || 30000 
      });
      
      // Capture baseline data
      const baseline = {};
      
      // Capture text content if specified
      if (monitorConfig.textSelectors) {
        baseline.text = {};
        for (const [key, selector] of Object.entries(monitorConfig.textSelectors)) {
          try {
            baseline.text[key] = await page.$eval(selector, el => el.textContent.trim());
          } catch (err) {
            baseline.text[key] = null;
          }
        }
      }
      
      // Capture attributes if specified
      if (monitorConfig.attributes) {
        baseline.attributes = {};
        for (const [key, config] of Object.entries(monitorConfig.attributes)) {
          try {
            baseline.attributes[key] = await page.$eval(
              config.selector, 
              (el, attr) => el.getAttribute(attr), 
              config.attribute
            );
          } catch (err) {
            baseline.attributes[key] = null;
          }
        }
      }
      
      // Capture screenshot if specified
      if (monitorConfig.captureScreenshot) {
        baseline.screenshot = await page.screenshot({ 
          fullPage: monitorConfig.fullPageScreenshot || false 
        });
      }
      
      // Capture HTML content if specified
      if (monitorConfig.captureHtml) {
        if (monitorConfig.htmlSelector) {
          baseline.html = await page.$eval(monitorConfig.htmlSelector, el => el.outerHTML);
        } else {
          baseline.html = await page.content();
        }
      }
      
      return {
        success: true,
        url,
        timestamp: new Date().toISOString(),
        baseline,
        message: 'Baseline captured successfully'
      };
    } catch (error) {
      console.error('Page monitoring error:', error);
      return {
        success: false,
        url,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    } finally {
      await browserPool.release(browser);
    }
  }

  /**
   * Analyze all forms on a page for automation purposes
   * @param {string} url - URL to analyze
   * @param {Object} options - Additional options
   * @returns {Object} - Detailed form analysis for automation
   */
  async analyzeFormsOnPage(url, options = {}) {
    const { page, browser } = await browserPool.acquire();
    
    try {
      const startTime = Date.now();
      await page.goto(url, { waitUntil: options.waitUntil || 'networkidle', timeout: options.timeout || 30000 });
      
      const formsAnalysis = await page.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form'));
        
        return forms.map((form, index) => {
          // Get form attributes
          const formData = {
            index: index,
            selector: form.id ? `#${form.id}` : form.className ? `.${form.className.split(' ')[0]}` : `form:nth-child(${index + 1})`,
            id: form.id || null,
            className: form.className || null,
            action: form.action || null,
            method: form.method || 'GET',
            enctype: form.enctype || null,
            target: form.target || null,
            fields: [],
            submitButtons: []
          };
          
          // Analyze all form fields
          const inputs = form.querySelectorAll('input, textarea, select');
          inputs.forEach((field, fieldIndex) => {
            const fieldData = {
              index: fieldIndex,
              tagName: field.tagName.toLowerCase(),
              type: field.type || 'text',
              name: field.name || null,
              id: field.id || null,
              className: field.className || null,
              selector: field.id ? `#${field.id}` : field.name ? `[name="${field.name}"]` : `${field.tagName.toLowerCase()}:nth-child(${fieldIndex + 1})`,
              placeholder: field.placeholder || null,
              value: field.value || null,
              required: field.required || false,
              disabled: field.disabled || false,
              readonly: field.readOnly || false,
              maxLength: field.maxLength > 0 ? field.maxLength : null,
              minLength: field.minLength > 0 ? field.minLength : null,
              pattern: field.pattern || null,
              autocomplete: field.autocomplete || null,
              label: null
            };
            
            // Try to find associated label
            if (field.id) {
              const label = document.querySelector(`label[for="${field.id}"]`);
              if (label) {
                fieldData.label = label.textContent.trim();
              }
            }
            
            // If no label found, look for parent label or nearby text
            if (!fieldData.label) {
              const parentLabel = field.closest('label');
              if (parentLabel) {
                fieldData.label = parentLabel.textContent.trim();
              } else {
                // Look for preceding text or sibling elements
                const prevSibling = field.previousElementSibling;
                if (prevSibling && (prevSibling.tagName === 'LABEL' || prevSibling.tagName === 'SPAN')) {
                  fieldData.label = prevSibling.textContent.trim();
                }
              }
            }
            
            // Handle select options
            if (field.tagName.toLowerCase() === 'select') {
              fieldData.options = Array.from(field.options).map(option => ({
                value: option.value,
                text: option.textContent.trim(),
                selected: option.selected
              }));
            }
            
            formData.fields.push(fieldData);
          });
          
          // Find submit buttons
          const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])');
          submitButtons.forEach((button, btnIndex) => {
            const buttonData = {
              index: btnIndex,
              tagName: button.tagName.toLowerCase(),
              type: button.type || 'submit',
              name: button.name || null,
              id: button.id || null,
              className: button.className || null,
              selector: button.id ? `#${button.id}` : button.name ? `[name="${button.name}"]` : `button:nth-child(${btnIndex + 1})`,
              text: button.textContent.trim() || button.value || null,
              value: button.value || null,
              disabled: button.disabled || false
            };
            
            formData.submitButtons.push(buttonData);
          });
          
          return formData;
        });
      });
      
      const executionTime = Date.now() - startTime;
      
      // Generate automation suggestions
      const automationSuggestions = formsAnalysis.map(form => {
        const actions = [];
        
        // Add actions for each field
        form.fields.forEach(field => {
          if (field.type === 'text' || field.type === 'email' || field.type === 'password' || field.type === 'tel') {
            actions.push({
              type: 'type',
              selector: field.selector,
              text: field.placeholder ? `[${field.placeholder}]` : `[${field.name || field.type}]`,
              description: `Fill ${field.label || field.name || field.type} field`
            });
          } else if (field.type === 'checkbox' || field.type === 'radio') {
            actions.push({
              type: 'click',
              selector: field.selector,
              description: `Select ${field.label || field.name || field.type}`
            });
          } else if (field.tagName === 'select') {
            actions.push({
              type: 'select',
              selector: field.selector,
              value: field.options.length > 0 ? field.options[0].value : '',
              description: `Select option from ${field.label || field.name || 'dropdown'}`
            });
          } else if (field.tagName === 'textarea') {
            actions.push({
              type: 'type',
              selector: field.selector,
              text: `[${field.placeholder || field.name || 'message'}]`,
              description: `Fill ${field.label || field.name || 'textarea'} field`
            });
          }
        });
        
        // Add submit action
        if (form.submitButtons.length > 0) {
          actions.push({
            type: 'click',
            selector: form.submitButtons[0].selector,
            description: `Submit ${form.action ? 'form to ' + form.action : 'form'}`
          });
        }
        
        return {
          formSelector: form.selector,
          formAction: form.action,
          suggestedActions: actions
        };
      });
      
      return {
        success: true,
        url: url,
        timestamp: new Date().toISOString(),
        executionTime: executionTime,
        analysis: {
          totalForms: formsAnalysis.length,
          forms: formsAnalysis,
          automationSuggestions: automationSuggestions
        }
      };
      
    } catch (error) {
      console.error('Form analysis error:', error);
      return {
        success: false,
        url: url,
        timestamp: new Date().toISOString(),
        error: error.message,
        analysis: {
          totalForms: 0,
          forms: [],
          automationSuggestions: []
        }
      };
    } finally {
      await browserPool.release(page, browser);
    }
  }
}

module.exports = new AutomationService();
