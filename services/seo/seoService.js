const browserPool = require('../../utils/browserPool');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function performSeoAudit(url, options = {}) {
  console.log(`🔍 Starting comprehensive SEO audit for: ${url}`);

  const {
    includeScreenshot = true,
    waitUntil = 'domcontentloaded', // בטוח יותר כברירת מחדל
    timeout = 45000,
    blockThirdParties = true
  } = options;

  const startTime = Date.now();
  const { page, context, id } = await browserPool.getPage();

  try {
    // חסימת משאבים "רעשניים" (מאיץ וגם מונע networkidle אינסופי)
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

    // כותרות שפה מנומסות (עוזר מול חלק מהאתרים)
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    const navigationStart = Date.now();

    // ניווט עם fallback אם ביקשת networkidle והוא נתקע
    let response;
    try {
      response = await page.goto(url, { waitUntil, timeout });
    } catch (err) {
      if (waitUntil === 'networkidle') {
        console.warn('⚠️ networkidle timed out — retrying with domcontentloaded');
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.max(timeout, 45000) });
      } else {
        throw err;
      }
    }

    const statusCode = response ? response.status() : null;
    const navigationEnd = Date.now();

    // המתנה לתוכן אמיתי (main/article/entry-content...) במקום לשקט רשת
    await Promise.race([
      page.waitForSelector('main, article, .entry-content, .post-content, #content, #main', { timeout: 15000 }),
      page.waitForTimeout(3000) // fallback קצר
    ]);

    // === ניתוחים ===
    const basicAnalysis = await extractBasicData(page, url);
    const contentAnalysis = await analyzeContentAndMedia(page);

    // צילום מסך אופציונלי
    let screenshot = null;
    if (includeScreenshot) {
      screenshot = await captureScreenshot(page);
    }

    // חישוב ציון
    const seoScore = calculateSeoScore({
      ...basicAnalysis,
      ...contentAnalysis
    });

    const executionTime = Date.now() - startTime;
    const loadTime = navigationEnd - navigationStart;

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
        screenshot: includeScreenshot ? screenshot : null
      }
    };

    console.log(`✅ SEO audit completed - Status: ${statusCode} - Score: ${seoScore.total}/100`);
    return results;

  } catch (error) {
    console.error(`❌ Error during SEO audit for ${url}:`, error);
    throw error;
  } finally {
    await browserPool.releasePage(id);
  }
}

// === פונקציות מאוחדות ומשופרות ===

async function extractBasicData(page, url) {
    return await page.evaluate((currentUrl) => {
        // === פונקציות עזר פנימיות ===
        function extractPageInfo() {
            const title = document.title || '';
            const url = window.location.href;
            const domain = window.location.hostname;
            const protocol = window.location.protocol;
            
            const doctype = document.doctype ? 
                `<!DOCTYPE ${document.doctype.name}>` : 'Missing DOCTYPE';
                
            const language = document.documentElement.lang || 'Not specified';
            const charset = document.characterSet || 'Not specified';
            const htmlLength = document.documentElement.outerHTML.length;
            const textLength = document.body ? document.body.innerText.length : 0;
            
            return {
                title, titleLength: title.length, url, domain, protocol,
                doctype, language, charset, htmlLength, textLength,
                lastModified: document.lastModified || 'Not available'
            };
        }
        
        function extractMetaTags() {
            return {
                description: document.querySelector('meta[name="description"]')?.content || '',
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
                }
            };
        }
        
        function extractStructuredData() {
            const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            const schemaTypes = new Set();
            
            jsonLdScripts.forEach(script => {
                try {
                    const data = JSON.parse(script.textContent);
                    if (data['@graph']) {
                        data['@graph'].forEach(item => {
                            if (item['@type']) schemaTypes.add(item['@type']);
                        });
                    } else if (data['@type']) {
                        schemaTypes.add(data['@type']);
                    }
                } catch {}
            });
            
            const schemaArray = Array.from(schemaTypes);
            return {
                found_schemas: schemaArray,
                schemas_count: schemaArray.length,
                main_type: schemaArray[0] || null
            };
        }
        
        function performSeoChecks() {
            const title = document.title || '';
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
            const images = Array.from(document.querySelectorAll('img'));
            const h1s = document.querySelectorAll('h1');
            const hasSitemap = !!document.querySelector('link[rel="sitemap"]');
            
            // בדיקת mobile responsiveness בסיסית
            const hasViewportMeta = !!document.querySelector('meta[name="viewport"]');
            const bodyWidth = document.body?.scrollWidth || 0;
            const windowWidth = window.innerWidth || 0;
            const isResponsive = hasViewportMeta && (bodyWidth <= windowWidth * 1.1);
            
            return {
                // בסיסי
                hasTitle: !!title && title.trim().length > 0,
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
                hasSitemap: hasSitemap,
                
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
                
                // links
                totalLinks: document.querySelectorAll('a[href]').length,
                linksWithoutText: Array.from(document.querySelectorAll('a[href]')).filter(link => !link.textContent.trim()).length
            };
        }
        
        // === הרצת כל הניתוחים ===
        return {
            pageInfo: extractPageInfo(),
            metaTags: extractMetaTags(),
            structuredData: extractStructuredData(),
            seoChecks: performSeoChecks()
        };
    }, url);
}

/**
 * === גרסה חדשה: ניתוח תוכן + ביטויים דומיננטיים (2–4 מילים) ===
 * enhancedKeywords = { dominant_phrases: [...], summary: {...} }
 */
async function analyzeContentAndMedia(page) {
    return await page.evaluate(() => {

        // ===== Helpers =====
        function normalizeHebrew(str = '') {
            return str
                .replace(/[\u05B0-\u05BD\u05BF\u05C1-\u05C2\u05C4\u05C5\u05C7]/g, '') // ניקוד
                .replace(/[\"׳״']/g, '') // גרשיים
                .replace(/\s+/g, ' ')
                .trim();
        }
        function tokenize(text = '') {
            return text
                .toLowerCase()
                .replace(/[^\u0590-\u05FFa-zA-Z0-9\s\-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .split(' ')
                .filter(w => w.length > 1);
        }
        function buildNgrams(tokens, nMin = 2, nMax = 4) {
            const out = [];
            for (let n = nMin; n <= nMax; n++) {
                for (let i = 0; i <= tokens.length - n; i++) {
                    out.push(tokens.slice(i, i + n).join(' '));
                }
            }
            return out;
        }
        function collectText(el) {
            return (el && (el.innerText || el.textContent) || '').trim();
        }
        function getMainContentRoot() {
            const picks = ['main', '[role="main"]', 'article', '.main-content', '.content', '.entry-content', '.post-content', '#content', '#main-content'];
            for (const s of picks) { const el = document.querySelector(s); if (el) return el; }
            const cands = Array.from(document.querySelectorAll('div, section, article'));
            let best = null, bestScore = 0;
            for (const el of cands) {
                const p = el.querySelectorAll('p').length;
                const h = el.querySelectorAll('h1,h2,h3').length;
                const t = (el.innerText || '').length;
                const score = p * 2 + h + t / 100;
                if (score > bestScore) { best = el; bestScore = score; }
            }
            return best || document.body;
        }
        function isGarbagePhrase(p) {
            const blacklist = [
                'קרא עוד', 'לחץ כאן', 'learn more', 'read more', 'click here',
                'posted', 'reply', 'menu', 'search', 'home', 'contact', 'about'
            ];
            return blacklist.includes(p);
        }

        // ===== dominant_phrases builder =====
        function buildDominantPhrases() {
            const root = getMainContentRoot();

            const title = document.title || '';
            const h1s = Array.from(document.querySelectorAll('h1'));
            const h2s = Array.from(document.querySelectorAll('h2'));
            const meta = document.querySelector('meta[name="description"]')?.content || '';
            const anchors = Array.from(root.querySelectorAll('a[href]'));
            const imgs = Array.from(root.querySelectorAll('img[alt]'));

            // תוכן עיקרי
            const mainText = normalizeHebrew(collectText(root));
            const mainTokens = tokenize(mainText);
            const stop = (typeof getStopWords === 'function') ? getStopWords('mixed') : [];
            const filtered = mainTokens.filter(t => !stop.includes(t));

            // N-grams 2–4 מילים
            const ngrams = buildNgrams(filtered, 2, 4);

            // מיפוי ניקוד
            const map = new Map(); // phrase -> { score, count, in:{} }
            const bump = (phrase, pts, flag) => {
                if (!phrase || isGarbagePhrase(phrase)) return;
                const item = map.get(phrase) || { score: 0, count: 0, in: { title: false, h1: false, h2: false, meta: false, anchors: false, alt: false, intro: false } };
                item.score += pts;
                if (flag) item.in[flag] = true;
                map.set(phrase, item);
            };

            // תדירות בתוכן – בסיס
            const counts = new Map();
            for (const p of ngrams) {
                if (isGarbagePhrase(p)) continue;
                counts.set(p, (counts.get(p) || 0) + 1);
            }
            counts.forEach((c, p) => { if (c > 1) { // דרוש לפחות פעמיים
                bump(p, c);
            }});

            // בונוסים לפי מיקום
            const bonifyText = (txt, pts, flag) => {
                const toks = tokenize(normalizeHebrew(txt));
                const ngs = buildNgrams(toks, 2, 4);
                ngs.forEach(p => bump(p, pts, flag));
            };
            bonifyText(title, 5, 'title');
            h1s.forEach(h => bonifyText(collectText(h), 4, 'h1'));
            h2s.forEach(h => bonifyText(collectText(h), 2, 'h2'));
            bonifyText(meta, 3, 'meta');
            anchors.forEach(a => bonifyText(collectText(a), 1, 'anchors'));
            imgs.forEach(img => bonifyText(img.alt || '', 1, 'alt'));

            // פתיח (200 מילים ראשונות)
            const intro = filtered.slice(0, 200);
            buildNgrams(intro, 2, 4).forEach(p => bump(p, 2, 'intro'));

            // יצירת רשימה
            const result = Array.from(map.entries())
                .filter(([p, v]) => v.score > 0 && p.split(' ').length <= 5)
                .sort((a, b) => b[1].score - a[1].score || (b[0].split(' ').length - a[0].split(' ').length))
                .map(([phrase, meta]) => {
                    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    const count = (mainText.match(re) || []).length;
                    return { phrase, score: meta.score, count, in: meta.in };
                })
                .filter((item, idx, arr) => {
                    const shorterInside = arr.slice(0, idx).some(prev => item.phrase.includes(prev.phrase));
                    return !shorterInside;
                })
                .slice(0, 12);

            return result;
        }

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
                const filteredText = text
                    .replace(/\s+/g, ' ')
                    .trim();
                if (filteredText.length > 10) {
                    cleanText += filteredText + ' ';
                }
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
            const avgWordsPerSentence = sentences.length > 0 ? (words.length / sentences.length).toFixed(1) : 0;

            const dominant = buildDominantPhrases();

            return {
                headings,
                headingCounts,
                text: {
                    totalWords: words.length,
                    totalSentences: sentences.length,
                    avgWordsPerSentence: parseFloat(avgWordsPerSentence)
                },
                enhancedKeywords: {
                    dominant_phrases: dominant,
                    summary: { total: dominant.length, method: 'weighted_ngrams_v2' }
                },
                readability: {
                    score: avgWordsPerSentence < 20 ? 80 : 60,
                    level: avgWordsPerSentence < 20 ? 'קל לקריאה' : 'בינוני'
                }
            };
        }

        function analyzeLinks() {
            const currentDomain = window.location.hostname;
            const contentLinks = Array.from(document.querySelectorAll('a[href]'));
            let internal = 0, external = 0;
            contentLinks.forEach(link => {
                try {
                    const linkUrl = new URL(link.href, window.location.href);
                    if (linkUrl.hostname === currentDomain) {
                        internal++;
                    } else {
                        external++;
                    }
                } catch { }
            });
            return {
                total: contentLinks.length,
                internal,
                external,
                contentOnly: true,
                linksWithoutText: contentLinks.filter(link => !link.textContent.trim()).length
            };
        }

        return {
            content: analyzeContent(),
            links: analyzeLinks()
        };
    });
}

// === חישוב ציון SEO משופר ===
function calculateSeoScore(results) {
    const categories = {};
    
    // === קטגוריית בסיס (25 נקודות) ===
    let basicScore = 0;
    const basicIssues = [];
    
    if (results.seoChecks?.hasTitle) basicScore += 5;
    else basicIssues.push("חסר כותרת");
    
    if (results.seoChecks?.titleOptimal) basicScore += 5;
    else if (results.seoChecks?.hasTitle) basicIssues.push("כותרת לא באורך אופטימלי (30-60 תווים)");
    
    if (results.seoChecks?.hasMetaDescription) basicScore += 5;
    else basicIssues.push("חסר meta description");
    
    if (results.seoChecks?.metaDescriptionOptimal) basicScore += 5;
    else if (results.seoChecks?.hasMetaDescription) basicIssues.push("Meta description לא באורך אופטימלי (120-160 תווים)");
    
    if (results.seoChecks?.hasH1 && results.seoChecks?.h1Optimal) basicScore += 5;
    else basicIssues.push("בעיה עם כותרת H1");
    
    categories.basic = { score: basicScore, max: 25, issues: basicIssues };
    
    // === קטגוריית טכני (20 נקודות) ===
    let technicalScore = 0;
    const technicalIssues = [];
    
    if (results.seoChecks?.isHttps) technicalScore += 5;
    else technicalIssues.push("האתר לא מאובטח (לא HTTPS)");
    
    if (results.seoChecks?.hasCanonical) technicalScore += 3;
    else technicalIssues.push("חסר canonical URL");
    
    if (results.seoChecks?.hasViewport) technicalScore += 3;
    else technicalIssues.push("חסר viewport meta tag");
    
    if (results.seoChecks?.hasDoctype) technicalScore += 2;
    else technicalIssues.push("חסר DOCTYPE");
    
    if (results.seoChecks?.hasLang) technicalScore += 2;
    else technicalIssues.push("חסר שפה בHTML");
    
    if (results.seoChecks?.hasFavicon) technicalScore += 2;
    else technicalIssues.push("חסר favicon");
    
    if (results.seoChecks?.hasSitemap) technicalScore += 3;
    else technicalIssues.push("חסר sitemap");
    
    categories.technical = { score: technicalScore, max: 20, issues: technicalIssues };
    
    // === קטגוריית תוכן (20 נקודות) — עודכן לשימוש בביטויים דומיננטיים ===
    let contentScore = 0;
    const contentIssues = [];
    
    const totalWords = results.contentAnalysis?.text?.totalWords || 0;
    if (totalWords > 300) contentScore += 5;
    else contentIssues.push("תוכן קצר מידי (פחות מ-300 מילים)");
    
    // 🔁 חדש: במקום keywordCount>5 — בודקים ביטויים דומיננטיים חזקים
    const domPhrases = results.contentAnalysis?.enhancedKeywords?.dominant_phrases || [];
    // "חזק" = score >= 6 (ניתן לשינוי לפי הצורך)
    const strongPhrases = domPhrases.filter(p => (p?.score ?? 0) >= 6).length;
    if (strongPhrases >= 3) {
        contentScore += 5;
    } else {
        contentIssues.push("מעט ביטויי מפתח דומיננטיים (נסו למקד את התוכן סביב 2–4 ביטויים מרכזיים)");
    }
    
    const headingCount = results.contentAnalysis?.headingCounts?.total || 0;
    if (headingCount > 3) contentScore += 3;
    else contentIssues.push("מעט כותרות משנה");
    
    const internalLinks = results.linkAnalysis?.internal || 0;
    if (internalLinks > 0) contentScore += 3;
    else contentIssues.push("אין קישורים פנימיים");
    
    const readabilityScore = results.contentAnalysis?.readability?.score || 0;
    if (readabilityScore > 70) contentScore += 4;
    else contentIssues.push("קושי בקריאה - משפטים ארוכים מידי");
    
    categories.content = { score: contentScore, max: 20, issues: contentIssues };
    
    // === קטגוריית מדיה ונגישות (15 נקודות) ===
    let mediaScore = 0;
    const mediaIssues = [];
    
    if (results.seoChecks?.allImagesHaveAlt) {
        mediaScore += 5;
    } else {
        const missingAlt = results.seoChecks?.imagesWithoutAlt || 0;
        if (missingAlt > 0) {
            mediaIssues.push(`${missingAlt} תמונות ללא alt text`);
        }
    }
    
    if ((results.linkAnalysis?.linksWithoutText ?? 0) === 0) mediaScore += 3;
    else mediaIssues.push("יש קישורים ללא טקסט");
    
    if (results.seoChecks?.isResponsive) mediaScore += 5;
    else mediaIssues.push("האתר לא responsive");
    
    if (results.seoChecks?.hasH1) mediaScore += 2;
    else mediaIssues.push("חסר כותרת H1");
    
    categories.media = { score: mediaScore, max: 15, issues: mediaIssues };
    
    // === קטגוריית רשתות חברתיות (10 נקודות) ===
    let socialScore = 0;
    const socialIssues = [];
    
    if (results.seoChecks?.hasOpenGraph) socialScore += 5;
    else socialIssues.push("חסר Open Graph tags");
    
    const ogImage = results.metaTags?.openGraph?.image;
    if (ogImage) socialScore += 3;
    else socialIssues.push("חסר תמונה לשיתוף ברשתות חברתיות");
    
    const socialLinks = results.linkAnalysis?.external || 0;
    if (socialLinks > 0) socialScore += 2;
    
    categories.social = { score: socialScore, max: 10, issues: socialIssues };
    
    // === קטגוריית נתונים מובנים (10 נקודות) ===
    let structuredScore = 0;
    const structuredIssues = [];
    
    if (results.seoChecks?.hasJsonLd) structuredScore += 5;
    else structuredIssues.push("חסר structured data (JSON-LD)");
    
    const schemasCount = results.structuredData?.schemas_count || 0;
    if (schemasCount > 0) structuredScore += 3;
    
    if (schemasCount > 2) structuredScore += 2;
    else if (schemasCount > 0) structuredIssues.push("מעט schemas - הוסף נתונים מובנים נוספים");
    
    categories.structured = { score: structuredScore, max: 10, issues: structuredIssues };
    
    // === חישוב ציון כולל ===
    const totalScore = basicScore + technicalScore + contentScore + mediaScore + socialScore + structuredScore;
    
    // קביעת איכות
    let quality;
    if (totalScore >= 85) quality = "excellent";
    else if (totalScore >= 70) quality = "good";
    else if (totalScore >= 50) quality = "needs_improvement";
    else quality = "poor";
    
    // קביעת דירוג
    let grade = 'F';
    if (totalScore >= 90) grade = 'A+';
    else if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 80) grade = 'A-';
    else if (totalScore >= 75) grade = 'B+';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 65) grade = 'B-';
    else if (totalScore >= 60) grade = 'C+';
    else if (totalScore >= 55) grade = 'C';
    else if (totalScore >= 50) grade = 'C-';
    else if (totalScore >= 40) grade = 'D';
    
    return {
        total: totalScore,
        grade,
        quality,
        categories
    };
}

async function captureScreenshot(page) {
    try {
        const screenshot = await page.screenshot({ 
            fullPage: true,
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
