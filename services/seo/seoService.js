const browserPool = require('../../utils/browserPool');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ← חדש: ריצה של פייתון (Advertools) להוצאת ביטויים דומיננטיים
const { analyzeTextKeywords } = require('./textKeywordsService');

// ← חדש: מערכת המלצות מפורטות
const {
  buildRecommendation,
  buildCategoryRecommendations,
  generateActionPlan,
  getSimpleIssue,
  TYPES: REC
} = require('./recommendationBuilder');

// פולבק מהיר אם פייתון נופל (N-grams 2–4 בצד Node)
function fallbackDominantPhrases(text = '', topN = 12) {
  try {
    const cleaned = String(text).toLowerCase().replace(/[^\u0590-\u05FFa-zA-Z0-9\s\-]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(w => w.length > 1);
    const bag = [];
    const ngrams = (arr, n) => {
      const out = [];
      for (let i = 0; i <= arr.length - n; i++) out.push(arr.slice(i, i + n).join(' '));
      return out;
    };
    [2, 3, 4].forEach(n => bag.push(...ngrams(tokens, n)));
    const counts = new Map();
    for (const p of bag) counts.set(p, (counts.get(p) || 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([phrase, count]) => ({ phrase, count, score: count, in: {} }));
  } catch {
    return [];
  }
}

async function performSeoAudit(url, options = {}) {
  console.log(`🔍 Starting comprehensive SEO audit for: ${url}`);

  const {
    includeScreenshot = true,
    waitUntil = 'networkidle', // networkidle for CSR/SPA sites (React, Next, Vue)
    timeout = 60000,
    blockThirdParties = true,
    includeMobile = false,
    language // אופציונלי: לאכוף שפה לניתוח ביטויים
  } = options;

  const startTime = Date.now();
  
  // ✅ FIXED: Use acquire() to get safeNavigate
  const { page, context, safeNavigate } = await browserPool.acquire();

  try {
    // חסימת משאבים "רעשניים"
    if (blockThirdParties && context && !context._routesPatched) {
      await context.route('**/*', route => {
        const u = route.request().url();
        if (
          /\.(png|jpg|jpeg|webp|gif|svg|woff2?|ttf)$/i.test(u) ||
          /googletagmanager|google-analytics|hotjar|facebook|intercom|tawk|segment\.com|amplitude|clarity/.test(u)
        ) {
          return route.abort();
        }
        route.continue();
      });
      context._routesPatched = true;
    }

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    const navigationStart = Date.now();

    // ✅ FIXED: Use safeNavigate instead of page.goto
    let response;
    try {
      response = await safeNavigate(url, { waitUntil, timeout });
    } catch (err) {
      if (waitUntil === 'networkidle') {
        console.warn('⚠️ networkidle timed out — retrying with domcontentloaded');
        response = await safeNavigate(url, { waitUntil: 'domcontentloaded', timeout: Math.max(timeout, 45000) });
      } else {
        throw err;
      }
    }

    const statusCode = response ? response.status() : null;
    const navigationEnd = Date.now();

    await Promise.race([
      page.waitForSelector('main, article, .entry-content, .post-content, #content, #main', { timeout: 15000 }),
      page.waitForTimeout(3000)
    ]);

    // Hydration detection for CSR/SPA frameworks (React, Next.js, Vue, etc.)
    await Promise.race([
      page.waitForFunction(() => {
        // React/Next/Vue hydration markers
        const root = document.getElementById('__next') || document.getElementById('root') || document.getElementById('app');
        if (root && root.children.length > 0 && document.body.innerText.length > 100) return true;
        // Generic: wait for meaningful content
        const paragraphs = document.querySelectorAll('p');
        return paragraphs.length >= 2 && document.body.innerText.length > 200;
      }, { timeout: 10000 }),
      page.waitForTimeout(10000) // absolute max wait
    ]);

    // === Core Web Vitals measurement ===
    const cwv = await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics = { lcp: null, cls: null, ttfb: null };

        // LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            metrics.lcp = entries[entries.length - 1].startTime;
          }
        });
        try { lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true }); } catch(e) {}

        // CLS
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) clsValue += entry.value;
          }
          metrics.cls = clsValue;
        });
        try { clsObserver.observe({ type: 'layout-shift', buffered: true }); } catch(e) {}

        // TTFB from Navigation Timing
        const navEntry = performance.getEntriesByType('navigation')[0];
        if (navEntry) {
          metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        }

        // Give observers 3 seconds to collect
        setTimeout(() => {
          lcpObserver.disconnect();
          clsObserver.disconnect();
          resolve(metrics);
        }, 3000);
      });
    });

    // === ניתוחים בדפדפן ===
    const basicAnalysis = await extractBasicData(page, url);
    const contentAnalysis = await analyzeContentAndMedia(page);

    // === הזרקת ביטויים דומיננטיים דרך Advertools (פייתון) ===
    try {
      const htmlLang = await page.evaluate(() => document.documentElement.lang || '');
      const lang = (language || htmlLang || 'en').split('-')[0];

      const rawText = contentAnalysis?.content?.text?.rawText || ''; // ← מגיע מ-analyzeContentAndMedia המעודכן
      if (rawText) {
        const kw = await analyzeTextKeywords({ text: rawText, language: lang, top_n: 12, timeout: 20000 });
        if (kw && kw.success && Array.isArray(kw.dominant_phrases)) {
          contentAnalysis.content.enhancedKeywords = {
            dominant_phrases: kw.dominant_phrases // [{ phrase, count }]
          };
        } else {
          // פולבק Node
          contentAnalysis.content.enhancedKeywords = {
            dominant_phrases: fallbackDominantPhrases(rawText, 12)
          };
        }
      }
    } catch (e) {
      console.warn('Keywords (advertools) failed:', e.message);
      const rawText = contentAnalysis?.content?.text?.rawText || '';
      contentAnalysis.content.enhancedKeywords = {
        dominant_phrases: fallbackDominantPhrases(rawText, 12)
      };
    }

    // חישוב זמנים
    const executionTime = Date.now() - startTime;
    const loadTime = navigationEnd - navigationStart;

    // צילום מסך אופציונלי
    let screenshot = null;
    if (includeScreenshot) {
      screenshot = await captureScreenshot(page);
    }

    // === Mobile Audit ===
    let mobileAudit = null;
    if (includeMobile) {
      try {
        const mobileContext = await browserPool.browser.newContext({
          viewport: { width: 390, height: 844 }, // iPhone 14 Pro
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        });
        const mobilePage = await mobileContext.newPage();

        try {
          await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

          mobileAudit = await mobilePage.evaluate(() => ({
            // Tap targets - elements too small to tap
            smallTapTargets: Array.from(document.querySelectorAll('a, button, input, select'))
              .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
              }).length,

            // Horizontal scroll
            hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 5,

            // Font size - text too small for mobile
            smallText: Array.from(document.querySelectorAll('p, span, li, a'))
              .filter(el => {
                const size = parseFloat(window.getComputedStyle(el).fontSize);
                return size < 14 && el.textContent.trim().length > 10;
              }).length,

            // Viewport dimensions
            viewportWidth: window.innerWidth,
            contentWidth: document.documentElement.scrollWidth,

            // Fixed elements that might block content
            fixedElements: Array.from(document.querySelectorAll('*'))
              .filter(el => {
                const style = window.getComputedStyle(el);
                return style.position === 'fixed' && el.getBoundingClientRect().height > 100;
              }).length
          }));
        } finally {
          await mobilePage.close();
          await mobileContext.close();
        }
      } catch (mobileErr) {
        console.warn('⚠️ Mobile audit failed:', mobileErr.message);
      }
    }

    // Core Web Vitals object
    const coreWebVitals = {
      lcp: cwv.lcp,    // ms - good: <2500, needs improvement: <4000, poor: >4000
      cls: cwv.cls,    // score - good: <0.1, needs improvement: <0.25, poor: >0.25
      ttfb: cwv.ttfb,  // ms - good: <800, needs improvement: <1800, poor: >1800
      loadTime         // existing navigation time
    };

    // חישוב ציון (עם loadTime + CWV)
    const seoScore = calculateSeoScore({
      ...basicAnalysis,
      ...contentAnalysis
    }, loadTime, coreWebVitals);

    const results = {
      success: true,
      statusCode,
      timestamp: new Date().toISOString(),
      executionTime,
      loadTime,
      userAgent: await page.evaluate(() => navigator.userAgent),
      viewport: { width: 1920, height: 1080 },

      results: {
        seoScore,
        pageInfo: basicAnalysis.pageInfo,
        metaTags: basicAnalysis.metaTags,
        seoChecks: basicAnalysis.seoChecks,
        contentAnalysis: contentAnalysis.content,
        linkAnalysis: contentAnalysis.links,
        structuredData: basicAnalysis.structuredData,
        coreWebVitals,
        mobileAudit,
        screenshot: includeScreenshot ? screenshot : null
      }
    };

    console.log(`✅ SEO audit completed - Status: ${statusCode} - Score: ${seoScore.total}/100`);
    return results;

  } catch (error) {
    console.error(`❌ Error during SEO audit for ${url}:`, error);
    throw error;
  } finally {
    // ✅ FIXED: Use releasePageObject to properly clean up
    await browserPool.releasePageObject({ page, context });
  }
}

// === פונקציות מאוחדות ומשופרות ===

async function extractBasicData(page, url) {
  return await page.evaluate((currentUrl) => {
    function extractPageInfo() {
      const title = document.title || '';
      const url = window.location.href;
      const domain = window.location.hostname;
      const protocol = window.location.protocol;
      const doctype = document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : 'Missing DOCTYPE';
      const language = document.documentElement.lang || 'Not specified';
      const charset = document.characterSet || 'Not specified';
      const htmlLength = document.documentElement.outerHTML.length;
      const textLength = document.body ? document.body.innerText.length : 0;

      // Fix: Use trimmed title to match seoChecks.hasTitle logic
      const trimmedTitle = title.trim();

      return {
        title: trimmedTitle,
        titleLength: trimmedTitle.length,
        url, domain, protocol,
        doctype, language, charset, htmlLength, textLength,
        lastModified: document.lastModified || 'Not available'
      };
    }

    function extractMetaTags() {
      // Fix: Trim meta description to match seoChecks logic
      const rawDescription = document.querySelector('meta[name="description"]')?.content || '';
      const description = rawDescription.trim();

      return {
        description,
        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
        author: document.querySelector('meta[name="author"]')?.content || '',
        robots: document.querySelector('meta[name="robots"]')?.content || '',
        viewport: document.querySelector('meta[name="viewport"]')?.content || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        openGraph: {
          title: document.querySelector('meta[property="og:title"]')?.content || '',
          description: document.querySelector('meta[property="og:description"]')?.content || '',
          image: document.querySelector('meta[property="og:image"]')?.content || '',
          url: document.querySelector('meta[property="og:url"]')?.content || '',
          type: document.querySelector('meta[property="og:type"]')?.content || '',
          siteName: document.querySelector('meta[property="og:site_name"]')?.content || ''
        },
        twitter: {
          card: document.querySelector('meta[name="twitter:card"]')?.content || '',
          title: document.querySelector('meta[name="twitter:title"]')?.content || '',
          description: document.querySelector('meta[name="twitter:description"]')?.content || '',
          image: document.querySelector('meta[name="twitter:image"]')?.content || '',
          site: document.querySelector('meta[name="twitter:site"]')?.content || ''
        }
      };
    }

    function extractStructuredData() {
      const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      const schemaTypes = new Set();
      const schemasData = [];
      let hasErrors = false;

      jsonLdScripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          schemasData.push(data);

          // Extract types
          if (data['@graph']) {
            data['@graph'].forEach(item => {
              if (item['@type']) {
                const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
                types.forEach(t => schemaTypes.add(t));
              }
            });
          } else if (data['@type']) {
            const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
            types.forEach(t => schemaTypes.add(t));
          }
        } catch (e) {
          hasErrors = true;
        }
      });

      const schemaArray = Array.from(schemaTypes);

      // Critical schemas check (קריטי ל-LLMs!)
      const criticalSchemas = {
        hasOrganization: schemaArray.some(s => s === 'Organization' || s.includes('Organization')),
        hasWebSite: schemaArray.some(s => s === 'WebSite'),
        hasWebPage: schemaArray.some(s => s.includes('WebPage') || s.includes('Page')),
        hasBreadcrumb: schemaArray.some(s => s === 'BreadcrumbList'),
        hasArticle: schemaArray.some(s => s.includes('Article')),
        hasProduct: schemaArray.some(s => s === 'Product'),
        hasPerson: schemaArray.some(s => s === 'Person'),
        hasLocalBusiness: schemaArray.some(s => s.includes('LocalBusiness') || s.includes('Business')),
        hasFAQ: schemaArray.some(s => s === 'FAQPage'),
        hasHowTo: schemaArray.some(s => s === 'HowTo'),
        hasEvent: schemaArray.some(s => s === 'Event'),
        hasReview: schemaArray.some(s => s.includes('Review') || s === 'AggregateRating')
      };

      // LLM-specific analysis
      const llmReadiness = analyzeLLMReadiness(schemasData, criticalSchemas);

      // Schema quality metrics
      const quality = {
        hasValidJSON: !hasErrors,
        hasContext: schemasData.some(s => s['@context']),
        hasMainEntity: schemasData.some(s => s.mainEntity || s.mainEntityOfPage),
        hasImages: schemasData.some(s => {
          const str = JSON.stringify(s);
          return str.includes('"image"') || str.includes('"logo"');
        }),
        hasStructuredProperties: schemasData.some(s => {
          const str = JSON.stringify(s);
          return str.includes('"name"') && str.includes('"url"');
        })
      };

      return {
        found_schemas: schemaArray,
        schemas_count: schemaArray.length,
        main_type: schemaArray[0] || null,
        critical_schemas: criticalSchemas,
        quality,
        llm_readiness: llmReadiness,
        raw_count: jsonLdScripts.length,
        has_errors: hasErrors
      };
    }

    // Helper: LLM Readiness Analysis
    function analyzeLLMReadiness(schemasData, criticalSchemas) {
      let score = 0;
      const recommendations = [];

      // Base schemas (30 points)
      if (criticalSchemas.hasOrganization) score += 10;
      else recommendations.push('הוסף Organization schema - חיוני ל-AI engines');

      if (criticalSchemas.hasWebSite) score += 10;
      else recommendations.push('הוסף WebSite schema - מסייע ל-search engines');

      if (criticalSchemas.hasWebPage) score += 10;
      else recommendations.push('הוסף WebPage schema לכל עמוד');

      // Content schemas (40 points)
      if (criticalSchemas.hasArticle) score += 15;
      if (criticalSchemas.hasProduct) score += 15;
      if (criticalSchemas.hasPerson) score += 5;
      if (criticalSchemas.hasLocalBusiness) score += 5;

      // Enhanced schemas (30 points)
      if (criticalSchemas.hasBreadcrumb) score += 10;
      else recommendations.push('הוסף BreadcrumbList - משפר navigation ב-AI');

      if (criticalSchemas.hasFAQ) score += 10;
      if (criticalSchemas.hasHowTo) score += 5;
      if (criticalSchemas.hasReview) score += 5;

      // Check for rich properties
      const hasRichData = schemasData.some(s => {
        const str = JSON.stringify(s);
        return (
          str.includes('"aggregateRating"') ||
          str.includes('"offers"') ||
          str.includes('"author"') ||
          str.includes('"publisher"')
        );
      });
      if (hasRichData) score += 10;
      else if (criticalSchemas.hasArticle || criticalSchemas.hasProduct) {
        recommendations.push('הוסף נתונים מפורטים (author, rating, offers)');
      }

      // Quality bonuses
      if (recommendations.length === 0) score += 10; // Bonus for complete

      return {
        score: Math.min(100, score),
        level: score >= 80 ? 'מצוין - מוכן ל-LLMs' :
               score >= 60 ? 'טוב - כמעט מוכן' :
               score >= 40 ? 'בינוני - חסר schemas חשובים' :
               'חלש - דרושה עבודה',
        recommendations: recommendations.length > 0 ? recommendations : ['Schema markup מצוין!']
      };
    }

    function performSeoChecks() {
      const rawTitle = document.title || '';
      const title = rawTitle.trim(); // Use trimmed title consistently
      const rawMetaDesc = document.querySelector('meta[name="description"]')?.content || '';
      const metaDesc = rawMetaDesc.trim(); // Use trimmed meta description consistently
      const images = Array.from(document.querySelectorAll('img'));
      const h1s = document.querySelectorAll('h1');
      const hasSitemap = !!document.querySelector('link[rel="sitemap"]');

      const hasViewportMeta = !!document.querySelector('meta[name="viewport"]');
      const bodyWidth = document.body?.scrollWidth || 0;
      const windowWidth = window.innerWidth || 0;
      const isResponsive = hasViewportMeta && (bodyWidth <= windowWidth * 1.1);

      return {
        // בסיסי
        hasTitle: !!title && title.length > 0,
        titleLength: title.length,
        titleOptimal: title.length >= 30 && title.length <= 60,

        hasMetaDescription: !!metaDesc,
        metaDescriptionLength: metaDesc.length,
        metaDescriptionOptimal: metaDesc.length >= 120 && metaDesc.length <= 160,

        // כותרות
        hasH1: h1s.length > 0,
        h1Count: h1s.length,
        h1Optimal: h1s.length === 1,

        // טכני
        hasCanonical: !!document.querySelector('link[rel="canonical"]'),
        hasViewport: hasViewportMeta,
        hasRobots: !!document.querySelector('meta[name="robots"]'),
        isHttps: currentUrl.startsWith('https://'),
        hasDoctype: !!document.doctype,
        hasLang: !!document.documentElement.lang,
        hasFavicon: !!document.querySelector('link[rel*="icon"]'),
        hasSitemap: hasSitemap, // נשאר לשימוש עתידי, לא משפיע על ניקוד

        // תמונות
        totalImages: images.length,
        imagesWithAlt: images.filter(img => img.alt && img.alt.trim()).length,
        imagesWithoutAlt: images.filter(img => !img.alt || !img.alt.trim()).length,
        allImagesHaveAlt: images.length > 0 && images.every(img => img.alt && img.alt.trim()),

        // structured data
        hasJsonLd: document.querySelectorAll('script[type="application/ld+json"]').length > 0,

        // mobile
        isResponsive: isResponsive,

        // social
        hasOpenGraph: !!document.querySelector('meta[property^="og:"]'),

        // links (ברמת עמוד)
        totalLinks: document.querySelectorAll('a[href]').length,
        linksWithoutText: Array.from(document.querySelectorAll('a[href]')).filter(link => !link.textContent.trim()).length
      };
    }

    return {
      pageInfo: extractPageInfo(),
      metaTags: extractMetaTags(),
      structuredData: extractStructuredData(),
      seoChecks: performSeoChecks()
    };
  }, url);
}

/**
 * === גרסה מעודכנת ומשופרת: ניתוח תוכן (כולל structured content) ===
 */
async function analyzeContentAndMedia(page) {
  return await page.evaluate(() => {
    function extractCleanContent() {
      const tempDoc = document.cloneNode(true);
      const scripts = tempDoc.querySelectorAll('script, style, noscript, nav, footer, .menu, .navigation');
      scripts.forEach(el => el.remove());
      const contentSelectors = [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'li', 'article', 'main', '.content', '.entry-content', '.post-content'
      ].join(', ');
      const contentElements = tempDoc.querySelectorAll(contentSelectors);
      let cleanText = '';
      contentElements.forEach(el => {
        const text = el.innerText || el.textContent || '';
        const filteredText = text.replace(/\s+/g, ' ').trim();
        if (filteredText.length > 10) cleanText += filteredText + ' ';
      });
      return cleanText.trim();
    }

    function analyzeContent() {
      const headings = {
        h1: Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim()),
        h2: Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim()),
        h3: Array.from(document.querySelectorAll('h3')).map(h => h.innerText.trim())
      };
      const headingCounts = {
        h1: headings.h1.length,
        h2: headings.h2.length,
        h3: headings.h3.length,
        total: headings.h1.length + headings.h2.length + headings.h3.length
      };

      const bodyText = extractCleanContent();
      const words = bodyText.trim().split(/\s+/).filter(w => w.length > 0);
      const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgWordsPerSentence = sentences.length > 0 ? Number((words.length / sentences.length).toFixed(1)) : 0;

      // זיהוי שפה (עברית/אנגלית)
      const hebrewChars = (bodyText.match(/[\u0590-\u05FF]/g) || []).length;
      const totalChars = bodyText.replace(/\s/g, '').length;
      const isHebrew = totalChars > 0 && (hebrewChars / totalChars) > 0.3;

      // ספירת פסקאות
      const paragraphs = Array.from(document.querySelectorAll('p')).filter(p => {
        const text = p.innerText || p.textContent || '';
        return text.trim().length > 50; // רק פסקאות עם תוכן משמעותי
      });

      // Structured content analysis
      const lists = {
        ul: document.querySelectorAll('ul').length,
        ol: document.querySelectorAll('ol').length,
        total: document.querySelectorAll('ul, ol').length
      };

      const tables = document.querySelectorAll('table').length;
      const blockquotes = document.querySelectorAll('blockquote').length;
      const codeBlocks = document.querySelectorAll('pre, code').length;

      return {
        headings,
        headingCounts,
        text: {
          totalWords: words.length,
          totalSentences: sentences.length,
          totalParagraphs: paragraphs.length,
          avgWordsPerSentence,
          avgWordsPerParagraph: paragraphs.length > 0 ? Math.round(words.length / paragraphs.length) : 0,
          isHebrew,
          language: isHebrew ? 'he' : 'en',
          rawText: bodyText
        },
        structuredContent: {
          lists,
          tables,
          blockquotes,
          codeBlocks,
          hasStructure: lists.total > 0 || tables > 0 || blockquotes > 0
        },
        enhancedKeywords: { dominant_phrases: [] }, // יוזן אחרי פייתון
        readability: {
          score: 0, // יחושב מחדש ב-calculateReadability
          level: ''
        }
      };
    }

    function analyzeLinks() {
      const currentDomain = window.location.hostname;

      // מצא את אזור התוכן העיקרי - נסה מספר אסטרטגיות
      let mainContentArea = null;

      // 1. נסה אלמנטים סמנטיים
      const semanticSelectors = [
        'main',
        'article',
        '[role="main"]',
        '[role="article"]',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.page-content',
        '#content',
        '#main-content',
        '.main-content',
        '.content'
      ];

      for (const selector of semanticSelectors) {
        mainContentArea = document.querySelector(selector);
        if (mainContentArea) break;
      }

      // 2. אם לא נמצא, נסנן קישורים מתוך אזורי ניווט/פוטר
      let contentLinks;
      if (mainContentArea) {
        // מצאנו אזור תוכן - קח רק קישורים משם
        contentLinks = Array.from(mainContentArea.querySelectorAll('a[href]'));
      } else {
        // לא מצאנו אזור מוגדר - קח את כל הקישורים אבל הוצא nav/header/footer/aside
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        contentLinks = allLinks.filter(link => {
          // בדוק אם הקישור נמצא בתוך אלמנטי ניווט/פוטר/סייד-בר
          const inNavigation = link.closest('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]');
          return !inNavigation;
        });
      }

      let internal = 0, external = 0;
      contentLinks.forEach(link => {
        try {
          const linkUrl = new URL(link.href, window.location.href);
          if (linkUrl.hostname === currentDomain) internal++; else external++;
        } catch {}
      });

      return {
        total: contentLinks.length,
        internal,
        external,
        contentOnly: true,
        mainContentFound: !!mainContentArea,
        linksWithoutText: contentLinks.filter(link => !link.textContent.trim()).length
      };
    }

    return {
      content: analyzeContent(),
      links: analyzeLinks()
    };
  });
}

/**
 * === חישוב Readability מתקדם עם תמיכה בשפות ===
 */
function calculateReadability(contentAnalysis) {
  if (!contentAnalysis || !contentAnalysis.text) {
    return { score: 0, level: 'לא זמין', details: {} };
  }

  const {
    avgWordsPerSentence = 0,
    avgWordsPerParagraph = 0,
    totalParagraphs = 0,
    totalWords = 0,
    isHebrew = false
  } = contentAnalysis.text;

  const structuredContent = contentAnalysis.structuredContent || {};

  let score = 100;
  const details = {};

  // התאמה לשפה - טווחים אופטימליים שונים
  const optimalSentenceRange = isHebrew ? [10, 18] : [12, 20];
  const optimalParagraphRange = isHebrew ? [60, 120] : [80, 150];

  // בדיקת אורך משפט ממוצע
  if (avgWordsPerSentence > 0) {
    if (avgWordsPerSentence < optimalSentenceRange[0]) {
      const penalty = (optimalSentenceRange[0] - avgWordsPerSentence) * 2;
      score -= penalty;
      details.sentenceIssue = 'משפטים קצרים מדי - נסה לפתח רעיונות';
    } else if (avgWordsPerSentence > optimalSentenceRange[1]) {
      const penalty = (avgWordsPerSentence - optimalSentenceRange[1]) * 1.5;
      score -= Math.min(penalty, 30); // מקסימום 30 נקודות קנס
      details.sentenceIssue = 'משפטים ארוכים מדי - פצל למשפטים קצרים יותר';
    } else {
      details.sentenceLength = 'אופטימלי';
    }
  }

  // בדיקת אורך פסקה ממוצע
  if (avgWordsPerParagraph > 0) {
    if (avgWordsPerParagraph < optimalParagraphRange[0]) {
      score -= 5;
      details.paragraphIssue = 'פסקאות קצרות מדי';
    } else if (avgWordsPerParagraph > optimalParagraphRange[1]) {
      const penalty = Math.min((avgWordsPerParagraph - optimalParagraphRange[1]) / 10, 15);
      score -= penalty;
      details.paragraphIssue = 'פסקאות ארוכות מדי - פצל לפסקאות קצרות יותר';
    } else {
      details.paragraphLength = 'אופטימלי';
    }
  }

  // בונוס לפסקאות מספיקות
  if (totalParagraphs >= 4) {
    score += 5;
    details.paragraphBonus = 'מספר פסקאות טוב';
  }

  // בונוס לתוכן מובנה (רשימות, טבלאות)
  if (structuredContent.hasStructure) {
    score += 3;
    details.structureBonus = 'שימוש בתוכן מובנה (רשימות/טבלאות)';
  }

  // בונוס לאורך תוכן סביר
  if (totalWords >= 300 && totalWords <= 2000) {
    score += 2;
  } else if (totalWords > 2000) {
    // תוכן ארוך מאוד - ודא שיש מבנה
    if (!structuredContent.hasStructure && totalParagraphs < 10) {
      score -= 5;
      details.longContentWarning = 'תוכן ארוך - הוסף כותרות משנה ורשימות';
    }
  }

  // הגבלת ציון לטווח 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // קביעת רמת קריאות
  let level;
  if (score >= 85) level = 'מצוין - קל מאוד לקריאה';
  else if (score >= 70) level = 'טוב - קל לקריאה';
  else if (score >= 55) level = 'בינוני - קריא אבל ניתן לשיפור';
  else if (score >= 40) level = 'קשה - דורש שיפור משמעותי';
  else level = 'קשה מאוד - משפטים ארוכים וחסר מבנה';

  return {
    score,
    level,
    details,
    recommendations: generateReadabilityRecommendations(details, avgWordsPerSentence, totalParagraphs)
  };
}

function generateReadabilityRecommendations(details, avgWordsPerSentence, totalParagraphs) {
  const recommendations = [];

  if (details.sentenceIssue && avgWordsPerSentence > 20) {
    recommendations.push('פצל משפטים ארוכים למשפטים קצרים יותר');
  }

  if (details.paragraphIssue && details.paragraphIssue.includes('ארוכות')) {
    recommendations.push('חלק פסקאות ארוכות לפסקאות קצרות יותר');
  }

  if (totalParagraphs < 3) {
    recommendations.push('הוסף פסקאות נוספות למבנה ברור יותר');
  }

  if (!details.structureBonus) {
    recommendations.push('הוסף רשימות (bullets) או טבלאות לשיפור הקריאות');
  }

  return recommendations.length > 0 ? recommendations : ['הקריאות טובה - המשך כך'];
}

// === חישוב ציון SEO משופר עם איזון מחדש ===
function calculateSeoScore(results, loadTime = 0, coreWebVitals = {}) {
  const categories = {};

  // === Basic (15) - הופחת מ-20 ===
  let basicScore = 0;
  const basicIssues = [];

  // Title (5 נקודות)
  if (results.seoChecks?.hasTitle) {
    const titleLen = results.seoChecks?.titleLength || 0;
    if (titleLen >= 50 && titleLen <= 60) {
      basicScore += 5; // אופטימלי
    } else if (titleLen >= 40 && titleLen <= 65) {
      basicScore += 3; // טוב
    } else if (titleLen > 65) {
      basicScore += 1;
      basicIssues.push(`כותרת ארוכה מדי (${titleLen} תווים, מומלץ 50-60)`);
    } else if (titleLen >= 30) {
      basicScore += 1;
      basicIssues.push(`כותרת קצרה מדי (${titleLen} תווים, מומלץ 50-60)`);
    } else {
      basicIssues.push(`כותרת קצרה מדי (${titleLen} תווים)`);
    }
  } else {
    basicIssues.push("חסר כותרת");
  }

  // Meta Description (5 נקודות)
  const metaDescLen = results.seoChecks?.metaDescriptionLength || 0;
  if (results.seoChecks?.hasMetaDescription) {
    if (metaDescLen >= 140 && metaDescLen <= 160) {
      basicScore += 5; // אופטימלי
    } else if (metaDescLen >= 120 && metaDescLen <= 165) {
      basicScore += 3; // טוב
    } else if (metaDescLen > 165) {
      basicScore += 1;
      basicIssues.push(`Meta description ארוך מדי (${metaDescLen} תווים, מומלץ 140-160)`);
    } else if (metaDescLen >= 100) {
      basicScore += 1;
      basicIssues.push(`Meta description קצר מדי (${metaDescLen} תווים, מומלץ 140-160)`);
    } else {
      basicIssues.push(`Meta description קצר מדי (${metaDescLen} תווים)`);
    }
  } else {
    basicIssues.push("חסר meta description");
  }

  // H1 (5 נקודות)
  if (results.seoChecks?.hasH1 && results.seoChecks?.h1Optimal) {
    basicScore += 5;
  } else if (results.seoChecks?.hasH1) {
    basicScore += 2;
    basicIssues.push(`יותר מ-H1 אחד בעמוד (${results.seoChecks?.h1Count} H1s)`);
  } else {
    basicIssues.push("חסר כותרת H1");
  }

  categories.basic = { score: basicScore, max: 15, issues: basicIssues };

  // === Technical (20) — מאוזן מחדש ===
  let technicalScore = 0;
  const technicalIssues = [];

  // HTTPS (5 נקודות) - קריטי!
  if (results.seoChecks?.isHttps) {
    technicalScore += 5;
  } else {
    technicalIssues.push("האתר לא מאובטח (לא HTTPS) - קריטי!");
  }

  // Canonical (4 נקודות)
  if (results.seoChecks?.hasCanonical) {
    technicalScore += 4;
  } else {
    technicalIssues.push("חסר canonical URL");
  }

  // Viewport (4 נקודות) - קריטי למובייל
  if (results.seoChecks?.hasViewport) {
    technicalScore += 4;
  } else {
    technicalIssues.push("חסר viewport meta tag - חובה למובייל");
  }

  // Robots (3 נקודות)
  if (results.seoChecks?.hasRobots) {
    technicalScore += 3;
  } else {
    technicalIssues.push("חסר robots meta tag");
  }

  // Language (2 נקודות)
  if (results.seoChecks?.hasLang) {
    technicalScore += 2;
  } else {
    technicalIssues.push("חסר שפה בHTML (lang attribute)");
  }

  // DOCTYPE (1 נקודה)
  if (results.seoChecks?.hasDoctype) {
    technicalScore += 1;
  } else {
    technicalIssues.push("חסר DOCTYPE");
  }

  // Favicon (1 נקודה) - נחמד אבל לא קריטי
  if (results.seoChecks?.hasFavicon) {
    technicalScore += 1;
  }

  categories.technical = { score: technicalScore, max: 20, issues: technicalIssues };

  // === Content (25) — הועלה מ-20, התוכן הוא מלך! ===
  let contentScore = 0;
  const contentIssues = [];

  // אורך תוכן (6 נקודות)
  const totalWords = results.contentAnalysis?.text?.totalWords || 0;
  if (totalWords >= 800) {
    contentScore += 6;
  } else if (totalWords >= 500) {
    contentScore += 4;
  } else if (totalWords >= 300) {
    contentScore += 2;
    contentIssues.push(`תוכן קצר (${totalWords} מילים, מומלץ 500+)`);
  } else {
    contentIssues.push(`תוכן קצר מידי (${totalWords} מילים, מינימום 300)`);
  }

  // ביטויי מפתח דומיננטיים (7 נקודות) - גמיש יותר
  const domPhrases = results.contentAnalysis?.enhancedKeywords?.dominant_phrases || [];
  const strongPhrases = domPhrases.filter(p => (p?.score ?? p?.count ?? 0) >= 4).length; // הופחת מ-6 ל-4
  const mediumPhrases = domPhrases.filter(p => {
    const val = p?.score ?? p?.count ?? 0;
    return val >= 2 && val < 4;
  }).length;

  if (strongPhrases >= 2) {
    contentScore += 7; // 2 ביטויים חזקים
  } else if (strongPhrases >= 1) {
    contentScore += 4; // 1 ביטוי חזק
    contentIssues.push("מעט ביטויי מפתח דומיננטיים - מקד את התוכן");
  } else if (mediumPhrases >= 3) {
    contentScore += 2; // 3 ביטויים בינוניים
    contentIssues.push("אין ביטויי מפתח חזקים - הוסף מיקוד לתוכן");
  } else {
    contentIssues.push("חסר מיקוד בביטויי מפתח - השתמש במילים חוזרות");
  }

  // כותרות משנה (4 נקודות)
  const headingCount = results.contentAnalysis?.headingCounts?.total || 0;
  if (headingCount >= 5) {
    contentScore += 4;
  } else if (headingCount >= 3) {
    contentScore += 2;
  } else {
    contentIssues.push("מעט כותרות משנה - הוסף H2/H3");
  }

  // קישורים פנימיים (3 נקודות)
  const internalLinks = results.linkAnalysis?.internal || 0;
  if (internalLinks >= 3) {
    contentScore += 3;
  } else if (internalLinks >= 1) {
    contentScore += 1;
    contentIssues.push("מעט קישורים פנימיים");
  } else {
    contentIssues.push("אין קישורים פנימיים");
  }

  // Readability (5 נקודות) - משתמש בפונקציה המשופרת
  const readability = calculateReadability(results.contentAnalysis);
  const readabilityScore = readability.score || 0;

  // עדכון התוצאה רק אם contentAnalysis קיים
  if (results.contentAnalysis) {
    results.contentAnalysis.readability = readability;
  }

  if (readabilityScore >= 80) {
    contentScore += 5;
  } else if (readabilityScore >= 60) {
    contentScore += 3;
  } else if (readabilityScore >= 40) {
    contentScore += 1;
    contentIssues.push("קריאות בינונית - שפר מבנה משפטים");
  } else {
    contentIssues.push("קריאות קשה - פצל משפטים ארוכים");
  }

  categories.content = { score: contentScore, max: 25, issues: contentIssues };

  // === Media & UX (10) — מאוזן מחדש ===
  let mediaScore = 0;
  const mediaIssues = [];

  // תמונות עם Alt (4 נקודות) - gradient
  const totalImages = results.seoChecks?.totalImages || 0;
  const imagesWithAlt = results.seoChecks?.imagesWithAlt || 0;
  const imagesWithoutAlt = results.seoChecks?.imagesWithoutAlt || 0;

  if (totalImages > 0) {
    const altRatio = imagesWithAlt / totalImages;
    if (altRatio === 1) {
      mediaScore += 4; // כל התמונות עם alt
    } else if (altRatio >= 0.8) {
      mediaScore += 3; // 80%+ עם alt
      mediaIssues.push(`${imagesWithoutAlt} תמונות ללא alt text`);
    } else if (altRatio >= 0.5) {
      mediaScore += 1; // 50%+ עם alt
      mediaIssues.push(`${imagesWithoutAlt} תמונות ללא alt text`);
    } else {
      mediaIssues.push(`רוב התמונות ללא alt text (${imagesWithoutAlt}/${totalImages})`);
    }
  }

  // Responsive (3 נקודות)
  if (results.seoChecks?.isResponsive) {
    mediaScore += 3;
  } else {
    mediaIssues.push("האתר לא responsive - חובה למובייל");
  }

  // קישורים ללא טקסט (2 נקודות)
  if ((results.linkAnalysis?.linksWithoutText ?? 0) === 0) {
    mediaScore += 2;
  } else {
    const emptyLinks = results.linkAnalysis?.linksWithoutText || 0;
    mediaIssues.push(`${emptyLinks} קישורים ללא טקסט`);
  }

  // Load Time (1 נקודה)
  if (loadTime > 0) {
    if (loadTime < 2000) {
      mediaScore += 1;
    } else if (loadTime >= 5000) {
      mediaIssues.push(`זמן טעינה איטי (${(loadTime / 1000).toFixed(1)}s)`);
    }
  }

  categories.mediaUX = { score: mediaScore, max: 10, issues: mediaIssues };

  // === Social (5) — הופחת מ-8 ===
  let socialScore = 0;
  const socialIssues = [];

  // Open Graph (2 נקודות)
  if (results.seoChecks?.hasOpenGraph) {
    socialScore += 2;
  } else {
    socialIssues.push("חסר Open Graph tags");
  }

  // OG Image (2 נקודות)
  const ogImage = results.metaTags?.openGraph?.image;
  if (ogImage) {
    socialScore += 2;
  } else {
    socialIssues.push("חסר תמונה לשיתוף ברשתות חברתיות (og:image)");
  }

  // Twitter Card (1 נקודה)
  const twitterCard = results.metaTags?.twitter?.card;
  if (twitterCard) {
    socialScore += 1;
  }

  categories.social = { score: socialScore, max: 5, issues: socialIssues };

  // === Structured Data (15) — הועלה מ-7, ניתוח מתקדם ===
  let structuredScore = 0;
  const structuredIssues = [];

  const structuredData = results.structuredData || {};
  const llmReadiness = structuredData.llm_readiness || {};
  const criticalSchemas = structuredData.critical_schemas || {};
  const quality = structuredData.quality || {};

  // Schema JSON validity (2 נקודות)
  if (results.seoChecks?.hasJsonLd && quality.hasValidJSON) {
    structuredScore += 2;
  } else if (results.seoChecks?.hasJsonLd && !quality.hasValidJSON) {
    structuredScore += 1;
    structuredIssues.push("Schema JSON לא תקין - תקן שגיאות");
  } else {
    structuredIssues.push("חסר structured data (JSON-LD) - קריטי ל-LLMs!");
  }

  // Required fields completeness (5 נקודות) - name, url, @type on every entity
  if (quality.hasStructuredProperties) {
    structuredScore += 3; // has name + url
  } else if (results.seoChecks?.hasJsonLd) {
    structuredIssues.push("Schema חסר שדות חובה (name, url)");
  }
  if (quality.hasContext) {
    structuredScore += 2; // has @context
  } else if (results.seoChecks?.hasJsonLd) {
    structuredIssues.push("Schema חסר @context");
  }

  // Publisher/Author completeness for Article (3 נקודות)
  if (criticalSchemas.hasArticle) {
    const schemasStr = JSON.stringify(structuredData);
    const hasAuthor = schemasStr.includes('"author"');
    const hasPublisher = schemasStr.includes('"publisher"');
    if (hasAuthor && hasPublisher) {
      structuredScore += 3;
    } else if (hasAuthor || hasPublisher) {
      structuredScore += 1;
      structuredIssues.push("Article schema חסר author או publisher");
    } else {
      structuredIssues.push("Article schema חסר author ו-publisher");
    }
  } else {
    // Non-article pages get partial credit if they have rich properties
    if (quality.hasImages || quality.hasMainEntity) {
      structuredScore += 2;
    }
  }

  // LLM Readiness Score (5 נקודות) - הציון החשוב ביותר!
  const llmScore = llmReadiness.score || 0;
  if (llmScore >= 80) {
    structuredScore += 5;
  } else if (llmScore >= 60) {
    structuredScore += 3;
    if (llmReadiness.recommendations) {
      llmReadiness.recommendations.slice(0, 2).forEach(r => structuredIssues.push(r));
    }
  } else if (llmScore >= 40) {
    structuredScore += 1;
    structuredIssues.push("Schema markup לא מספיק מקיף ל-AI engines");
  } else {
    structuredIssues.push("Schema markup חלש - הוסף schemas בסיסיים");
  }

  // Add LLM readiness info to results
  categories.structured = {
    score: structuredScore,
    max: 15,
    issues: structuredIssues,
    llmReadiness: {
      score: llmScore,
      level: llmReadiness.level,
      criticalSchemas: Object.entries(criticalSchemas || {})
        .filter(([key, val]) => val)
        .map(([key]) => key.replace('has', ''))
    }
  };

  // === Core Web Vitals (10) — קטגוריה חדשה ===
  let cwvScore = 0;
  const cwvIssues = [];

  // LCP (4 נקודות)
  const lcpValue = coreWebVitals.lcp;
  if (lcpValue != null) {
    if (lcpValue < 2500) {
      cwvScore += 4;
    } else if (lcpValue < 4000) {
      cwvScore += 2;
      cwvIssues.push(`LCP צריך שיפור (${(lcpValue / 1000).toFixed(1)}s, מומלץ <2.5s)`);
    } else {
      cwvIssues.push(`LCP איטי (${(lcpValue / 1000).toFixed(1)}s, מומלץ <2.5s)`);
    }
  }

  // CLS (3 נקודות)
  const clsValue = coreWebVitals.cls;
  if (clsValue != null) {
    if (clsValue < 0.1) {
      cwvScore += 3;
    } else if (clsValue < 0.25) {
      cwvScore += 1;
      cwvIssues.push(`CLS צריך שיפור (${clsValue.toFixed(3)}, מומלץ <0.1)`);
    } else {
      cwvIssues.push(`CLS גבוה (${clsValue.toFixed(3)}, מומלץ <0.1)`);
    }
  }

  // TTFB (3 נקודות)
  const ttfbValue = coreWebVitals.ttfb;
  if (ttfbValue != null) {
    if (ttfbValue < 800) {
      cwvScore += 3;
    } else if (ttfbValue < 1800) {
      cwvScore += 1;
      cwvIssues.push(`TTFB צריך שיפור (${Math.round(ttfbValue)}ms, מומלץ <800ms)`);
    } else {
      cwvIssues.push(`TTFB איטי (${Math.round(ttfbValue)}ms, מומלץ <800ms)`);
    }
  }

  categories.coreWebVitals = { score: cwvScore, max: 10, issues: cwvIssues };

  // === חישוב ציון כולל ===
  const totalScore = basicScore + technicalScore + contentScore + mediaScore + socialScore + structuredScore + cwvScore;

  let overallQuality;
  if (totalScore >= 85) overallQuality = "excellent";
  else if (totalScore >= 70) overallQuality = "good";
  else if (totalScore >= 50) overallQuality = "needs_improvement";
  else overallQuality = "poor";

  // Grading משופר עם רמות נוספות
  let grade = 'F';
  if (totalScore >= 95) grade = 'A++';       // חדש! מעל ומעבר
  else if (totalScore >= 90) grade = 'A+';
  else if (totalScore >= 85) grade = 'A';
  else if (totalScore >= 80) grade = 'A-';
  else if (totalScore >= 75) grade = 'B+';
  else if (totalScore >= 70) grade = 'B';
  else if (totalScore >= 65) grade = 'B-';
  else if (totalScore >= 60) grade = 'C+';
  else if (totalScore >= 55) grade = 'C';
  else if (totalScore >= 50) grade = 'C-';
  else if (totalScore >= 45) grade = 'D+';  // חדש
  else if (totalScore >= 40) grade = 'D';
  else if (totalScore >= 35) grade = 'D-';  // חדש
  else if (totalScore >= 30) grade = 'E';   // חדש

  // === Build detailed recommendations ===
  const allRecommendationTypes = [];
  const recommendationContext = {};

  // Collect all issues from categories
  Object.entries(categories).forEach(([catName, catData]) => {
    if (catData.issues && catData.issues.length > 0) {
      catData.issues.forEach(issue => {
        // Try to map issue to recommendation type
        const recType = mapIssueToRecommendationType(issue, catName);
        if (recType) {
          allRecommendationTypes.push(recType);
        }
      });
    }
  });

  // Build detailed recommendations
  const detailedRecommendations = allRecommendationTypes.map(type =>
    buildRecommendation(type, recommendationContext[type] || {})
  );

  // Generate action plan
  const actionPlan = generateActionPlan(detailedRecommendations);

  return {
    total: totalScore,
    grade,
    quality: overallQuality,
    categories,
    breakdown: {
      basic: `${basicScore}/15`,
      technical: `${technicalScore}/20`,
      content: `${contentScore}/25`,
      mediaUX: `${mediaScore}/10`,
      social: `${socialScore}/5`,
      structured: `${structuredScore}/15`,
      coreWebVitals: `${cwvScore}/10`
    },
    // New: Detailed recommendations with how-to-fix
    recommendations: {
      total: detailedRecommendations.length,
      details: detailedRecommendations,
      actionPlan: actionPlan,
      summary: actionPlan.summary
    }
  };
}

/**
 * Map issue text to recommendation type
 */
function mapIssueToRecommendationType(issue, category) {
  // Simple mapping - can be enhanced
  if (issue.includes('חסר כותרת')) return REC.MISSING_TITLE;
  if (issue.includes('כותרת') && issue.includes('קצר')) return REC.TITLE_TOO_SHORT;
  if (issue.includes('כותרת') && issue.includes('ארוכ')) return REC.TITLE_TOO_LONG;
  if (issue.includes('חסר meta description')) return REC.MISSING_META_DESCRIPTION;
  if (issue.includes('Meta description') && issue.includes('קצר')) return REC.META_DESC_TOO_SHORT;
  if (issue.includes('Meta description') && issue.includes('ארוך')) return REC.META_DESC_TOO_LONG;

  if (issue.includes('לא מאובטח') || issue.includes('HTTPS')) return REC.NOT_HTTPS;
  if (issue.includes('canonical')) return REC.MISSING_CANONICAL;
  if (issue.includes('viewport')) return REC.MISSING_VIEWPORT;
  if (issue.includes('robots meta')) return REC.MISSING_ROBOTS;
  if (issue.includes('שפה בHTML')) return REC.MISSING_LANG;

  if (issue.includes('תוכן קצר')) return REC.CONTENT_TOO_SHORT;
  if (issue.includes('ביטויי מפתח') || issue.includes('מיקוד')) return REC.WEAK_KEYWORD_FOCUS;
  if (issue.includes('כותרות משנה')) return REC.FEW_HEADINGS;
  if (issue.includes('קישורים פנימיים')) return REC.NO_INTERNAL_LINKS;
  if (issue.includes('קריאות') || issue.includes('משפטים ארוכים')) return REC.POOR_READABILITY;

  if (issue.includes('תמונות ללא alt')) return REC.MISSING_ALT_TEXT;
  if (issue.includes('responsive')) return REC.NOT_RESPONSIVE;
  if (issue.includes('זמן טעינה')) return REC.SLOW_LOAD_TIME;
  if (issue.includes('קישורים ללא טקסט')) return REC.LINKS_WITHOUT_TEXT;

  if (issue.includes('חסר structured data') || issue.includes('JSON-LD')) return REC.NO_STRUCTURED_DATA;
  if (issue.includes('Schema markup') || issue.includes('LLM')) return REC.WEAK_LLM_READINESS;
  if (issue.includes('BreadcrumbList')) return REC.MISSING_BREADCRUMB;

  if (issue.includes('Open Graph')) return REC.NO_OPEN_GRAPH;
  if (issue.includes('תמונה לשיתוף') || issue.includes('og:image')) return REC.NO_OG_IMAGE;

  return null;
}

async function captureScreenshot(page) {
  try {
    const screenshot = await page.screenshot({
      fullPage: false, // Capture only the viewport (above the fold)
      type: 'jpeg',
      quality: 80
    });
    return `data:image/jpeg;base64,${screenshot.toString('base64')}`;
  } catch {
    return null;
  }
}

module.exports = {
  performSeoAudit
};
