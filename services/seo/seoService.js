/**
 * Advanced SEO Service Module
 * 
 * מספק ניתוח SEO מקיף ומתקדם עם קטגוריות חכמות
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
        // t is alreaid rorsaeyrse rbyibrawVirPwot0hhen;creatghntxt
        
        const navigationStart = Date.now();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        const navigationEnd = Date.now();
        await page.waitForTimeout(2000);
        
        // === קטגוריות מידע ===
        const pageInfo = await extractPageInfo(page);
        const metaTags = await extractMetaTags(page);
        const seoChecks = await performSeoChecks(page, url);
        const contentAnalysis = await analyzeContent(page);
        const linkAnalysis = await analyzeLinks(page, url);
        const mediaAnalysis = await analyzeMedia(page);
        const structuredData = await extractStructuredData(page);
        const technicalAnalysis = await analyzeTechnical(page);
        const accessibilityAnalysis = await analyzeAccessibility(page);
        const mobileAnalysis = await analyzeMobile(page);
        const securityAnalysis = await analyzeSecurity(page, url);
        const socialAnalysis = await analyzeSocial(page);
        
        let screenshot = null;
        if (includeScreenshot) {
            screenshot = await captureScreenshot(page);
        }
        
        const seoScore = calculateSeoScore({
            pageInfo, metaTags, seoChecks, contentAnalysis,
            linkAnalysis, mediaAnalysis, structuredData,
            technicalAnalysis, accessibilityAnalysis,
            mobileAnalysis, securityAnalysis, socialAnalysis
        });
        
        const executionTime = Date.now() - startTime;
        const loadTime = navigationEnd - navigationStart;
        
        const results = {
            metadata: {
                url, timestamp: new Date().toISOString(),
                executionTime, loadTime,
                userAgent: await page.evaluate(() => navigator.userAgent),
                viewport: { width: 1920, height: 1080 }
            },
            seoScore, pageInfo, metaTags, seoChecks,
            contentAnalysis, linkAnalysis, mediaAnalysis,
            structuredData, technicalAnalysis, accessibilityAnalysis,
            mobileAnalysis, securityAnalysis, socialAnalysis,
            screenshot: includeScreenshot ? screenshot : null
        };
        
        console.log(`✅ SEO audit completed for ${url} - Score: ${seoScore.total}/100`);
        return results;
        
    } catch (error) {
        console.error(`❌ Error during SEO audit for ${url}:`, error);
        throw error;
    } finally {
        await browserPool.releasePage(id);
    }
}

// === פונקציות עזר ===

async function extractPageInfo(page) {
    return await page.evaluate(() => {
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
    });
}

async function extractMetaTags(page) {
    return await page.evaluate(() => {
        const metaTags = {};
        
        metaTags.description = document.querySelector('meta[name="description"]')?.content || '';
        metaTags.keywords = document.querySelector('meta[name="keywords"]')?.content || '';
        metaTags.author = document.querySelector('meta[name="author"]')?.content || '';
        metaTags.robots = document.querySelector('meta[name="robots"]')?.content || '';
        metaTags.viewport = document.querySelector('meta[name="viewport"]')?.content || '';
        metaTags.canonical = document.querySelector('link[rel="canonical"]')?.href || '';
        
        metaTags.openGraph = {
            title: document.querySelector('meta[property="og:title"]')?.content || '',
            description: document.querySelector('meta[property="og:description"]')?.content || '',
            image: document.querySelector('meta[property="og:image"]')?.content || '',
            url: document.querySelector('meta[property="og:url"]')?.content || '',
            type: document.querySelector('meta[property="og:type"]')?.content || '',
            siteName: document.querySelector('meta[property="og:site_name"]')?.content || ''
        };
        
        metaTags.twitterCard = {
            card: document.querySelector('meta[name="twitter:card"]')?.content || '',
            title: document.querySelector('meta[name="twitter:title"]')?.content || '',
            description: document.querySelector('meta[name="twitter:description"]')?.content || '',
            image: document.querySelector('meta[name="twitter:image"]')?.content || '',
            site: document.querySelector('meta[name="twitter:site"]')?.content || '',
            creator: document.querySelector('meta[name="twitter:creator"]')?.content || ''
        };
        
        const allMetas = Array.from(document.querySelectorAll('meta')).map(meta => ({
            name: meta.name || meta.property || meta.httpEquiv || 'unknown',
            content: meta.content || '',
            attribute: meta.name ? 'name' : meta.property ? 'property' : 'http-equiv'
        }));
        
        metaTags.allMetas = allMetas;
        metaTags.metaCount = allMetas.length;
        
        return metaTags;
    });
}

async function performSeoChecks(page, url) {
    const checks = await page.evaluate((currentUrl) => {
        const results = {};
        
        results.hasTitle = !!document.title && document.title.trim().length > 0;
        results.titleLength = document.title ? document.title.length : 0;
        results.titleOptimal = results.titleLength >= 30 && results.titleLength <= 60;
        
        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
        results.hasMetaDescription = !!metaDesc;
        results.metaDescriptionLength = metaDesc.length;
        results.metaDescriptionOptimal = metaDesc.length >= 120 && metaDesc.length <= 160;
        
        results.hasH1 = document.querySelectorAll('h1').length > 0;
        results.h1Count = document.querySelectorAll('h1').length;
        results.h1Optimal = results.h1Count === 1;
        
        results.hasCanonical = !!document.querySelector('link[rel="canonical"]');
        results.hasViewport = !!document.querySelector('meta[name="viewport"]');
        results.hasRobots = !!document.querySelector('meta[name="robots"]');
        results.isHttps = currentUrl.startsWith('https://');
        
        results.hasOpenGraph = !!document.querySelector('meta[property^="og:"]');
        results.hasTwitterCard = !!document.querySelector('meta[name^="twitter:"]');
        results.hasDoctype = !!document.doctype;
        results.hasLang = !!document.documentElement.lang;
        
        const images = Array.from(document.querySelectorAll('img'));
        results.totalImages = images.length;
        results.imagesWithAlt = images.filter(img => img.alt && img.alt.trim()).length;
        results.allImagesHaveAlt = results.totalImages > 0 && results.imagesWithAlt === results.totalImages;
        
        results.hasJsonLd = document.querySelectorAll('script[type="application/ld+json"]').length > 0;
        results.hasFavicon = !!document.querySelector('link[rel*="icon"]');
        
        return results;
    }, url);
    
    // בדיקת sitemap
    try {
        const sitemapUrl = new URL('/sitemap.xml', url).href;
        const response = await page.goto(sitemapUrl, { timeout: 5000 });
        checks.hasSitemap = response.status() === 200;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    } catch {
        checks.hasSitemap = false;
    }
    
    return checks;
}

// === פונקציות נוספות ===

function calculateSeoScore(results) {
    let totalScore = 0;
    const categories = {};
    
    // === מידע בסיסי (25 נקודות) ===
    let basicScore = 0;
    if (results.seoChecks?.hasTitle) basicScore += 5;
    if (results.seoChecks?.titleOptimal) basicScore += 5;
    if (results.seoChecks?.hasMetaDescription) basicScore += 5;
    if (results.seoChecks?.metaDescriptionOptimal) basicScore += 5;
    if (results.seoChecks?.hasH1 && results.seoChecks?.h1Optimal) basicScore += 5;
    categories.basic = { score: basicScore, max: 25, percentage: Math.round((basicScore/25)*100) };
    
    // === טכני (20 נקודות) ===
    let technicalScore = 0;
    if (results.seoChecks?.isHttps) technicalScore += 5;
    if (results.seoChecks?.hasCanonical) technicalScore += 3;
    if (results.seoChecks?.hasViewport) technicalScore += 3;
    if (results.seoChecks?.hasDoctype) technicalScore += 2;
    if (results.seoChecks?.hasLang) technicalScore += 2;
    if (results.seoChecks?.hasFavicon) technicalScore += 2;
    if (results.seoChecks?.hasSitemap) technicalScore += 3;
    categories.technical = { score: technicalScore, max: 20, percentage: Math.round((technicalScore/20)*100) };
    
    // === תוכן ומבנה (20 נקודות) ===
    let contentScore = 0;
    if (results.contentAnalysis?.text?.totalWords > 300) contentScore += 5;
    if (results.contentAnalysis?.keywords?.topKeywords?.length > 5) contentScore += 5;
    if (results.contentAnalysis?.headingCounts?.total > 3) contentScore += 3;
    if (results.linkAnalysis?.internal > 0) contentScore += 3;
    if (results.contentAnalysis?.readability?.score > 70) contentScore += 4;
    categories.content = { score: contentScore, max: 20, percentage: Math.round((contentScore/20)*100) };
    
    // === מדיה ונגישות (15 נקודות) ===
    let mediaScore = 0;
    if (results.seoChecks?.allImagesHaveAlt) mediaScore += 5;
    if (results.accessibilityAnalysis?.links?.withoutText === 0) mediaScore += 3;
    if (results.accessibilityAnalysis?.headings?.hasH1) mediaScore += 2;
    if (results.mobileAnalysis?.layout?.isResponsive) mediaScore += 5;
    categories.media = { score: mediaScore, max: 15, percentage: Math.round((mediaScore/15)*100) };
    
    // === רשתות חברתיות (10 נקודות) ===
    let socialScore = 0;
    if (results.seoChecks?.hasOpenGraph) socialScore += 5;
    if (results.seoChecks?.hasTwitterCard) socialScore += 3;
    if (results.socialAnalysis?.socialPresence) socialScore += 2;
    categories.social = { score: socialScore, max: 10, percentage: Math.round((socialScore/10)*100) };
    
    // === נתונים מובנים (10 נקודות) ===
    let structuredScore = 0;
    if (results.seoChecks?.hasJsonLd) structuredScore += 5;
    if (results.structuredData?.totalSchemas > 0) structuredScore += 3;
    if (results.structuredData?.breadcrumbs?.length > 0) structuredScore += 2;
    categories.structured = { score: structuredScore, max: 10, percentage: Math.round((structuredScore/10)*100) };
    
    // חישוב ציון כולל
    totalScore = basicScore + technicalScore + contentScore + mediaScore + socialScore + structuredScore;
    
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
    
    // המלצות לשיפור
    const recommendations = [];
    if (basicScore < 20) recommendations.push('שפר כותרת ותיאור מטא');
    if (technicalScore < 15) recommendations.push('תקן בעיות טכניות (HTTPS, Canonical, Viewport)');
    if (contentScore < 15) recommendations.push('הוסף תוכן איכותי ומילות מפתח');
    if (mediaScore < 10) recommendations.push('שפר נגישות ותמיכה במובייל');
    if (socialScore < 7) recommendations.push('הוסף תגיות Open Graph ו-Twitter Card');
    if (structuredScore < 7) recommendations.push('הוסף נתונים מובנים (Schema.org)');
    
    return {
        total: totalScore,
        percentage: Math.round((totalScore/100)*100),
        grade,
        categories,
        recommendations,
        summary: {
            excellent: totalScore >= 85,
            good: totalScore >= 70 && totalScore < 85,
            needsImprovement: totalScore >= 50 && totalScore < 70,
            poor: totalScore < 50
        }
    };
}

async function analyzeContent(page) {
    return await page.evaluate(() => {
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
        
        // 🔥 החלק החדש המשופר
        const bodyText = extractCleanContent();
        const words = bodyText.trim().split(/\s+/).filter(word => word.length > 0);
        const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        // ניתוח מילות מפתח משופר + N-grams
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
            // 🔥 החלפנו keywords פשוטים ב-enhanced analysis
            enhancedKeywords: enhancedKeywordAnalysis,
            readability: {
                score: avgWordsPerSentence < 20 ? 80 : 60,
                level: avgWordsPerSentence < 20 ? 'קל לקריאה' : 'בינוני'
            }
        };
        
        // === פונקציות עזר חדשות ===
        
        function extractCleanContent() {
            // הסר סקריפטים וסטיילים לפני הניתוח
            const tempDoc = document.cloneNode(true);
            const scripts = tempDoc.querySelectorAll('script, style, noscript');
            scripts.forEach(el => el.remove());
            
            // קח רק את התוכן הגלוי והרלוונטי
            const contentSelectors = [
                'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th',
                'div[class*="content"]', 'article', 'main', '.entry-content', 
                '.post-content', '.content', '.text'
            ].join(', ');
            
            const contentElements = tempDoc.querySelectorAll(contentSelectors);
            let cleanText = '';
            
            contentElements.forEach(el => {
                const text = el.innerText || el.textContent || '';
                // סנן JavaScript patterns וקוד
                const filteredText = text
                    .replace(/function\s*\([^)]*\)\s*{[^}]*}/g, '')
                    .replace(/var\s+\w+\s*=\s*[^;]+;/g, '')
                    .replace(/\b(function|var|return|if|for|while|true|false|null|undefined|console|document|window|addEventListener|querySelector|getElementById)\b/g, '')
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
                ngrams: {
                    hebrew: {
                        bigrams: getNgrams(hebrewText, 2),
                        trigrams: getNgrams(hebrewText, 3)
                    },
                    english: {
                        bigrams: getNgrams(englishText, 2),
                        trigrams: getNgrams(englishText, 3)
                    }
                },
                summary: {
                    totalKeywords: getTopKeywords(text, 'mixed').length,
                    dominantLanguage: hebrewText.length > englishText.length ? 'hebrew' : 'english'
                }
            };
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
        
        function getNgrams(text, n) {
            if (!text.trim()) return [];
            
            const stopWords = getStopWords('mixed');
            const words = text.toLowerCase()
                .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 1 && !stopWords.includes(word));
            
            const ngrams = {};
            for (let i = 0; i <= words.length - n; i++) {
                const ngram = words.slice(i, i + n).join(' ');
                if (ngram.trim() && ngram.split(' ').every(w => w.length > 1)) {
                    ngrams[ngram] = (ngrams[ngram] || 0) + 1;
                }
            }
            
            return Object.entries(ngrams)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8)
                .map(([phrase, count]) => ({
                    phrase,
                    count,
                    density: ((count / words.length) * 100).toFixed(2) + '%'
                }));
        }
        
        function getStopWords(language) {
            const hebrew = ['של', 'את', 'עם', 'על', 'אל', 'כל', 'לא', 'אם', 'כי', 'זה', 'היא', 'הוא', 'ב', 'ל', 'מ', 'ה', 'ו', 'אני', 'אתה', 'הם', 'אנחנו', 'יש', 'יהיה', 'היה', 'או', 'גם', 'רק', 'כמו', 'בין', 'פי', 'לפי', 'אחר', 'אחת', 'שני', 'שלש'];
            const english = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'this', 'that', 'these', 'those', 'from', 'up', 'out', 'down', 'off', 'over', 'under', 'again', 'further', 'then', 'once'];
            
            if (language === 'he') return hebrew;
            if (language === 'en') return english;
            return [...hebrew, ...english];
        }
    });
}

async function analyzeLinks(page, url) {
    return await page.evaluate((currentUrl) => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const currentDomain = new URL(currentUrl).hostname;
        
        let internal = 0, external = 0;
        links.forEach(link => {
            try {
                const linkUrl = new URL(link.href, currentUrl);
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
            external
        };
    }, url);
}

async function analyzeMedia(page) {
    return await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return {
            images: {
                total: images.length,
                withAlt: images.filter(img => img.alt && img.alt.trim()).length,
                withoutAlt: images.filter(img => !img.alt || !img.alt.trim()).length
            }
        };
    });
}

async function extractStructuredData(page) {
    return await page.evaluate(() => {
        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const jsonLd = [];
        
        jsonLdScripts.forEach(script => {
            try {
                jsonLd.push(JSON.parse(script.textContent));
            } catch {}
        });
        
        return {
            jsonLd,
            totalSchemas: jsonLd.length,
            breadcrumbs: []
        };
    });
}

async function analyzeTechnical(page) {
    return await page.evaluate(() => ({
        css: { total: document.querySelectorAll('link[rel="stylesheet"], style').length },
        javascript: { total: document.querySelectorAll('script').length }
    }));
}

async function analyzeAccessibility(page) {
    return await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return {
            links: {
                total: links.length,
                withoutText: links.filter(link => !link.textContent.trim()).length
            },
            headings: {
                hasH1: document.querySelector('h1') !== null
            }
        };
    });
}

async function analyzeMobile(page) {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const analysis = await page.evaluate(() => {
        const hasViewportMeta = document.querySelector('meta[name="viewport"]') !== null;
        const hasHorizontalScroll = document.body.scrollWidth > window.innerWidth;
        
        return {
            layout: {
                isResponsive: hasViewportMeta && !hasHorizontalScroll
            }
        };
    });
    
    await page.setViewportSize({ width: 1920, height: 1080 });
    return analysis;
}

async function analyzeSecurity(page, url) {
    return await page.evaluate((currentUrl) => ({
        https: currentUrl.startsWith('https://'),
        mixedContent: false
    }), url);
}

async function analyzeSocial(page) {
    return await page.evaluate(() => ({
        socialPresence: document.querySelectorAll('a[href*="facebook"], a[href*="twitter"], a[href*="instagram"]').length > 0
    }));
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
