/**
 * Advanced SEO Service Module - משופר ומתוקן
 * 
 * מספק ניתוח SEO מקיף עם פלט נקי ומועיל
 */

const browserPool = require('../../utils/browserPool');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * ביצוע ניתוח SEO מקיף ומתקדם
 */
async function performSeoAudit(url, options = {}) {
    console.log(`🔍 Starting comprehensive SEO audit for: ${url}`);
    
    const { includeScreenshot = true } = options;
    const startTime = Date.now();
    
    const { page, context, id } = await browserPool.getPage();
    
    try {
        const navigationStart = Date.now();
        const {
          waitUntil = 'networkidle', // ברירת מחדל אם לא סופק
          timeout = 30000
        } = options;
        
        const response = await page.goto(url, { waitUntil, timeout });
        const statusCode = response ? response.status() : null;
        const navigationEnd = Date.now();
        await page.waitForTimeout(2000);
        
        // ===  ניתוח מקיף בקריאות מופחתות ===
        const basicAnalysis = await extractBasicData(page, url);
        const contentAnalysis = await analyzeContentAndMedia(page);
        
        let screenshot = null;
        if (includeScreenshot) {
            screenshot = await captureScreenshot(page);
        }
        
        const seoScore = calculateSeoScore({
            ...basicAnalysis,
            ...contentAnalysis
        });
        
        const executionTime = Date.now() - startTime;
        const loadTime = navigationEnd - navigationStart;
        
        // === מבנה תשובה משופר ===
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

async function analyzeContentAndMedia(page) {
    return await page.evaluate(() => {
        // === ניתוח תוכן משופר ===
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
            
            // חילוץ תוכן נקי
            const bodyText = extractCleanContent();
            const words = bodyText.trim().split(/\s+/).filter(word => word.length > 0);
            const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
            
            // ניתוח מילות מפתח וביטויים
            const enhancedKeywordAnalysis = analyzeKeywordsAndNgrams(bodyText);
            
            const avgWordsPerSentence = sentences.length > 0 ? (words.length / sentences.length).toFixed(1) : 0;
            
            return {
                headings,
                headingCounts,
                text: {
                    totalWords: words.length,
                    totalSentences: sentences.length,
                    avgWordsPerSentence: parseFloat(avgWordsPerSentence)
                },
                enhancedKeywords: enhancedKeywordAnalysis,
                readability: {
                    score: avgWordsPerSentence < 20 ? 80 : 60,
                    level: avgWordsPerSentence < 20 ? 'קל לקריאה' : 'בינוני'
                }
            };
        }
        
        function extractCleanContent() {
            // הסר סקריפטים וסטיילים
            const tempDoc = document.cloneNode(true);
            const scripts = tempDoc.querySelectorAll('script, style, noscript, nav, footer, .menu, .navigation');
            scripts.forEach(el => el.remove());
            
            // קח רק תוכן עיקרי
            const contentSelectors = [
                'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 
                'article', 'main', '.content', '.entry-content', '.post-content'
            ].join(', ');
            
            const contentElements = tempDoc.querySelectorAll(contentSelectors);
            let cleanText = '';
            
            contentElements.forEach(el => {
                const text = el.innerText || el.textContent || '';
                // סינון קוד JavaScript
                const filteredText = text
                    .replace(/function\s*\([^)]*\)\s*{[^}]*}/g, '')
                    .replace(/var\s+\w+\s*=\s*[^;]+;/g, '')
                    .replace(/\b(function|var|return|if|for|while|console|document|window)\b/g, '')
                    .replace(/[{}();=]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                if (filteredText.length > 10) {
                    cleanText += filteredText + ' ';
                }
            });
            
            return cleanText.trim();
        }
        
        function analyzeKeywordsAndNgrams(text) {
            const hebrewText = extractHebrewText(text);
            const englishText = extractEnglishText(text);
            
            return {
                keywords: {
                    hebrew: getTopKeywords(hebrewText, 'he'),
                    english: getTopKeywords(englishText, 'en'),
                    mixed: getTopKeywords(text, 'mixed')
                },
                meaningful_phrases: getMeaningfulNgrams(text),
                summary: {
                    totalKeywords: getTopKeywords(text, 'mixed').length,
                    dominantLanguage: hebrewText.length > englishText.length ? 'hebrew' : 'english'
                }
            };
        }
        
        function getMeaningfulNgrams(text) {
            const stopWords = getStopWords('mixed');
            const words = text.toLowerCase()
                .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 1 && !stopWords.includes(word));
            
            const phrases = {};
            
            // 2-4 מילים בלבד
            for (let n = 2; n <= 4; n++) {
                for (let i = 0; i <= words.length - n; i++) {
                    const phrase = words.slice(i, i + n).join(' ');
                    if (phrase.trim() && phrase.split(' ').every(w => w.length > 1)) {
                        phrases[phrase] = (phrases[phrase] || 0) + 1;
                    }
                }
            }
            
            // רק ביטויים שחוזרים יותר מפעם אחת, רק 4 הבולטים
            return Object.entries(phrases)
                .filter(([phrase, count]) => count > 1)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 4)
                .map(([phrase, count]) => ({ phrase, count }));
        }
        
        function extractHebrewText(text) {
            const hebrewMatches = text.match(/[\u0590-\u05FF\s]+/g);
            return hebrewMatches ? hebrewMatches.join(' ').replace(/\s+/g, ' ').trim() : '';
        }
        
        function extractEnglishText(text) {
            const englishMatches = text.match(/[a-zA-Z\s]+/g);
            return englishMatches ? englishMatches.join(' ').replace(/\s+/g, ' ').trim() : '';
        }
        
        function getTopKeywords(text, language = 'mixed') {
            if (!text.trim()) return [];
            
            const stopWords = getStopWords(language);
            const words = text.toLowerCase()
                .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 2 && !stopWords.includes(word));
            
            const frequency = {};
            words.forEach(word => {
                frequency[word] = (frequency[word] || 0) + 1;
            });
            
            return Object.entries(frequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([word, count]) => ({
                    word,
                    count,
                    density: ((count / words.length) * 100).toFixed(2) + '%'
                }));
        }
        
        function getStopWords(language) {
            const hebrew = ['של', 'את', 'עם', 'על', 'אל', 'כל', 'לא', 'אם', 'כי', 'זה', 'היא', 'הוא', 'ב', 'ל', 'מ', 'ה', 'ו', 'אני', 'אתה', 'הם', 'אנחנו', 'יש', 'יהיה', 'היה', 'או', 'גם', 'רק', 'כמו', 'בין', 'פי', 'לפי', 'אחר', 'אחת', 'שני', 'שלש'];
            const english = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'this', 'that', 'these', 'those'];
            
            if (language === 'he') return hebrew;
            if (language === 'en') return english;
            return [...hebrew, ...english];
        }
        
        // === ניתוח לינקים משופר - רק מתוכן עיקרי ===
        function analyzeContentLinks() {
            const currentDomain = window.location.hostname;
            
            // מציאת האזור עם התוכן העיקרי
            const contentArea = findMainContentArea();
            
            if (!contentArea) {
                console.warn('לא נמצא אזור תוכן עיקרי, חוזר לניתוח רגיל');
                return analyzeAllLinks(); // fallback לפונקציה הקיימת
            }
            
            // קישורים רק מתוכן העיקרי
            const contentLinks = Array.from(contentArea.querySelectorAll('a[href]'));
            
            let internal = 0, external = 0;
            const linkDetails = [];
            
            contentLinks.forEach(link => {
                try {
                    const linkUrl = new URL(link.href, window.location.href);
                    const linkText = link.textContent.trim();
                    const linkTitle = link.title || '';
                    
                    const linkInfo = {
                        url: link.href,
                        text: linkText,
                        title: linkTitle,
                        hasText: linkText.length > 0,
                        isInternal: linkUrl.hostname === currentDomain
                    };
                    
                    if (linkUrl.hostname === currentDomain) {
                        internal++;
                        linkInfo.type = 'internal';
                    } else {
                        external++;
                        linkInfo.type = 'external';
                    }
                    
                    linkDetails.push(linkInfo);
                } catch (error) {
                    console.warn('בעיה בניתוח קישור:', link.href);
                }
            });
            
            return {
                total: contentLinks.length,
                internal,
                external,
                contentOnly: true, // סימון שזה ניתוח של תוכן בלבד
                linksWithoutText: linkDetails.filter(link => !link.hasText).length,
                details: linkDetails.slice(0, 10) // רק 10 הראשונים למניעת עומס
            };
        }
        
        function findMainContentArea() {
            // רשימת סלקטורים לתוכן עיקרי (לפי סדר עדיפות)
            const contentSelectors = [
                'main',
                '[role="main"]',
                'article',
                '.main-content',
                '.content',
                '.post-content',
                '.entry-content',
                '.article-content',
                '#content',
                '#main-content',
                '.page-content',
                '.blog-content'
            ];
            
            // חיפוש הסלקטור הראשון שקיים
            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    console.log(`נמצא תוכן עיקרי עם: ${selector}`);
                    return element;
                }
            }
            
            // אם לא נמצא, נסה למצוא לפי היוריסטיקה
            return findContentByHeuristics();
        }
        
        function findContentByHeuristics() {
            // חיפוש האלמנט עם הכי הרבה פסקאות וכותרות
            const candidates = Array.from(document.querySelectorAll('div, section, article'));
            
            let bestCandidate = null;
            let bestScore = 0;
            
            candidates.forEach(element => {
                // דלג על header, footer, nav, sidebar
                if (isNavigationArea(element)) return;
                
                const paragraphs = element.querySelectorAll('p').length;
                const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
                const textLength = element.textContent.length;
                
                // חישוב ציון על בסיס כמות תוכן
                const score = (paragraphs * 2) + headings + (textLength / 100);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = element;
                }
            });
            
            if (bestCandidate) {
                console.log(`נמצא תוכן עיקרי בהיוריסטיקה עם ציון: ${bestScore}`);
            }
            
            return bestCandidate;
        }
        
        function isNavigationArea(element) {
            // בדיקה אם האלמנט הוא אזור ניווט
            const navigationSelectors = [
                'header', 'footer', 'nav', 'aside',
                '.header', '.footer', '.navigation', '.nav',
                '.sidebar', '.menu', '.widget', '.advertisement',
                '#header', '#footer', '#sidebar', '#nav'
            ];
            
            // בדיקה ישירה
            const tagName = element.tagName.toLowerCase();
            if (['header', 'footer', 'nav', 'aside'].includes(tagName)) {
                return true;
            }
            
            // בדיקה לפי קלאס ואיידי
            const className = element.className || '';
            const id = element.id || '';
            
            return navigationSelectors.some(selector => {
                const cleanSelector = selector.replace(/^[#.]/, '');
                return className.includes(cleanSelector) || id.includes(cleanSelector);
            });
        }
        
        // פונקציה מקורית כ-fallback
        function analyzeAllLinks() {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const currentDomain = window.location.hostname;
            
            let internal = 0, external = 0;
            links.forEach(link => {
                try {
                    const linkUrl = new URL(link.href, window.location.href);
                    if (linkUrl.hostname === currentDomain) {
                        internal++;
                    } else {
                        external++;
                    }
                } catch {}
            });
            
            return {
                total: links.length,
                internal,
                external,
                contentOnly: false
            };
        }
        
        // === השימוש החדש בפונקציה הראשית ===
        function analyzeLinks() {
            return analyzeContentLinks();
        }
        
        // === הרצת הניתוחים ===
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
    
    // === קטגוריית תוכן (20 נקודות) ===
    let contentScore = 0;
    const contentIssues = [];
    
    const totalWords = results.contentAnalysis?.text?.totalWords || 0;
    if (totalWords > 300) contentScore += 5;
    else contentIssues.push("תוכן קצר מידי (פחות מ-300 מילים)");
    
    const keywordCount = results.contentAnalysis?.enhancedKeywords?.keywords?.mixed?.length || 0;
    if (keywordCount > 5) contentScore += 5;
    else contentIssues.push("מעט מילות מפתח מזוהות");
    
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
    
    if (results.seoChecks?.linksWithoutText === 0) mediaScore += 3;
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
