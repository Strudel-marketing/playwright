const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { chromium } = require('playwright');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Schema Validator
class SmartSchemaValidator {
    constructor() {
        this.ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
        addFormats(this.ajv);
        this.schemas = {
            Person: {
                type: 'object',
                properties: {
                    '@context': { const: 'https://schema.org' },
                    '@type': { const: 'Person' },
                    name: { type: 'string', minLength: 1 },
                    url: { type: 'string', format: 'uri' },
                    image: { type: 'string', format: 'uri' },
                    jobTitle: { type: 'string' }
                },
                required: ['@context', '@type', 'name'],
                additionalProperties: true
            }
        };
    }
    
    validateSchema(data) {
        const schemaType = data['@type'];
        if (!schemaType) {
            return { valid: false, errors: ['Missing @type'], score: 0 };
        }
        
        const schema = this.schemas[schemaType];
        if (!schema) {
            return { valid: true, errors: [], warnings: [`Basic validation for ${schemaType}`], score: 70 };
        }
        
        const validate = this.ajv.compile(schema);
        const isValid = validate(data);
        
        return {
            valid: isValid,
            errors: (validate.errors || []).map(e => e.message),
            warnings: [],
            score: isValid ? 85 : 40
        };
    }
}

// מילות חיבור לסינון
const STOP_WORDS = {
    hebrew: ['של', 'את', 'על', 'עם', 'אל', 'מן', 'כל', 'זה', 'זו', 'זאת', 'הוא', 'היא', 'הם', 'הן', 'אני', 'אתה', 'את', 'אנחנו', 'אתם', 'אתן', 'יש', 'אין', 'היה', 'הייה', 'יהיה', 'תהיה', 'רק', 'גם', 'כי', 'אם', 'מה', 'איך', 'איפה', 'מתי', 'למה', 'מי', 'כמה', 'איזה', 'איזו', 'אחד', 'אחת', 'שני', 'שתי', 'ראשון', 'ראשונה', 'שנייה', 'שלישי'],
    english: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'when', 'where', 'why', 'how', 'who', 'which', 'one', 'two', 'first', 'second', 'third']
};

// פונקציה לספירת הברות
function countSyllables(word, language) {
    const cleanWord = word.toLowerCase().replace(/[^a-zA-Z\u0590-\u05FF]/g, '');
    
    if (cleanWord.length === 0) return 0;

    if (language === 'hebrew') {
        const vowels = /[אהוייע]/g;
        const matches = cleanWord.match(vowels);
        return Math.max(1, matches ? matches.length : 1);
    } else {
        const vowels = /[aeiouy]/g;
        let syllables = (cleanWord.match(vowels) || []).length;
        
        if (cleanWord.endsWith('e')) syllables--;
        if (cleanWord.includes('le') && cleanWord.length > 2) syllables++;
        
        return Math.max(1, syllables);
    }
}

// פונקציה להגדרת רמת קריאות
function getReadabilityLevel(score) {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
}

// פונקציה לחישוב Flesch Reading Score
function calculateFleschScore(text, language = 'english') {
    if (!text || text.trim().length === 0) {
        return { score: 0, level: 'unknown', error: 'No text provided' };
    }

    const cleanText = text.replace(/[^\u0590-\u05FFa-zA-Z0-9\s.,!?;:()]/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();

    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;

    if (sentenceCount === 0) {
        return { score: 0, level: 'unknown', error: 'No sentences found' };
    }

    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount === 0) {
        return { score: 0, level: 'unknown', error: 'No words found' };
    }

    let totalSyllables = 0;
    words.forEach(word => {
        totalSyllables += countSyllables(word, language);
    });

    const avgSentenceLength = wordCount / sentenceCount;
    const avgSyllablesPerWord = totalSyllables / wordCount;
    
    let score;
    if (language === 'hebrew') {
        score = 206.835 - (1.3 * avgSentenceLength) - (60 * avgSyllablesPerWord);
    } else {
        score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
        score: score,
        level: getReadabilityLevel(score),
        details: {
            wordCount,
            sentenceCount,
            avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
            avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
            totalSyllables
        }
    };
}

// פונקציה להגדרת קטגוריית מילת מפתח
function getKeywordCategory(count, totalWords) {
    const density = (count / totalWords) * 100;
    
    if (density >= 5) return 'high';
    if (density >= 2) return 'optimal';
    if (density >= 1) return 'moderate';
    return 'low';
}

// פונקציה להמלצות על מילות מפתח
function getKeywordRecommendation(count, totalWords, wordCount) {
    const density = (count / totalWords) * 100;
    
    if (density >= 5) {
        return 'Consider reducing usage - may be seen as keyword stuffing';
    }
    if (density >= 2 && density < 5) {
        return 'Good keyword density - well optimized';
    }
    if (density >= 1 && density < 2) {
        return 'Moderate usage - could be increased slightly';
    }
    if (wordCount > 2) {
        return 'Good long-tail keyword - valuable for SEO';
    }
    return 'Low density - consider using more frequently';
}

// פונקציה לניתוח keyword density - משופרת
function analyzeKeywordDensity(text) {
    if (!text || text.trim().length === 0) {
        return { 
            topKeywords: [], 
            totalWords: 0, 
            filteredWords: 0,
            language: 'unknown',
            error: 'No text provided' 
        };
    }

    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);
    const language = hasHebrew && hasEnglish ? 'mixed' : hasHebrew ? 'hebrew' : 'english';
    
    const cleanText = text.toLowerCase()
                         .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();

    const allWords = cleanText.split(/\s+/).filter(w => {
        const cleanWord = w.replace(/[^a-zA-Z\u0590-\u05FF]/g, '');
        return cleanWord.length >= 2;
    });
    
    if (allWords.length === 0) {
        return { 
            topKeywords: [], 
            totalWords: 0, 
            filteredWords: 0,
            language: language,
            error: 'No valid words found' 
        };
    }

    const stopWords = new Set([
        ...(hasHebrew ? STOP_WORDS.hebrew : []),
        ...(hasEnglish ? STOP_WORDS.english : [])
    ]);
    
    const filteredWords = allWords.filter(word => {
        const cleanWord = word.replace(/[^a-zA-Z\u0590-\u05FF]/g, '');
        return !stopWords.has(cleanWord) && cleanWord.length >= 2;
    });
    
    if (filteredWords.length < 3) {
        return { 
            topKeywords: [], 
            totalWords: allWords.length, 
            filteredWords: filteredWords.length,
            language: language,
            error: 'Insufficient keywords after filtering stop words (need at least 3)' 
        };
    }

    const sequences = new Map();
    const maxSequenceLength = Math.min(4, Math.floor(filteredWords.length / 3));
    
    for (let length = 1; length <= maxSequenceLength; length++) {
        for (let i = 0; i <= filteredWords.length - length; i++) {
            const sequence = filteredWords.slice(i, i + length).join(' ');
            
            if (!/^\d+(\s+\d+)*$/.test(sequence)) {
                sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
            }
        }
    }

    const minOccurrences = Math.max(2, Math.floor(allWords.length / 50));
    const maxOccurrences = Math.floor(allWords.length * 0.15);
    
    const validSequences = Array.from(sequences.entries())
        .filter(([sequence, count]) => {
            return count >= minOccurrences && count <= maxOccurrences;
        })
        .map(([sequence, count]) => ({
            keyword: sequence,
            count: count,
            density: Math.round((count / allWords.length) * 100 * 100) / 100,
            wordCount: sequence.split(' ').length,
            category: getKeywordCategory(count, allWords.length),
            recommendation: getKeywordRecommendation(count, allWords.length, sequence.split(' ').length)
        }))
        .sort((a, b) => {
            if (Math.abs(a.density - b.density) < 0.1) {
                return b.wordCount - a.wordCount;
            }
            return b.density - a.density;
        })
        .slice(0, 10);

    return {
        topKeywords: validSequences,
        totalWords: allWords.length,
        filteredWords: filteredWords.length,
        language: language,
        averageDensity: validSequences.length > 0 ? 
            Math.round((validSequences.reduce((sum, kw) => sum + kw.density, 0) / validSequences.length) * 100) / 100 : 0,
        totalKeywordOccurrences: validSequences.reduce((sum, kw) => sum + kw.count, 0),
        keywordCoverage: validSequences.length > 0 ? 
            Math.round((validSequences.reduce((sum, kw) => sum + kw.count, 0) / allWords.length) * 100 * 100) / 100 : 0,
        debug: {
            minOccurrences,
            maxOccurrences,
            totalSequences: sequences.size,
            validSequencesCount: validSequences.length
        }
    };
}

// פונקציה לפירוס תאריכים
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    const cleanStr = dateStr.trim();
    
    const formats = [
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        /^\d{4}-\d{2}-\d{2}/,
        /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
        /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/
    ];

    let date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
        return date;
    }

    for (const format of formats) {
        const match = cleanStr.match(format);
        if (match) {
            if (format.source.includes('4})[')) {
                date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            } else {
                date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
            }
            
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    return null;
}

// פונקציה לזיהוי תאריכים בתוכן - משופרת
function analyzeContentFreshness(text, metaTags = {}) {
    const results = {
        dates: [],
        latestDate: null,
        daysSinceLatest: null,
        category: 'unknown',
        sources: [],
        debug: {
            metaTagsFound: Object.keys(metaTags).length,
            dateFieldsChecked: 0,
            patternsMatched: 0
        }
    };

    const metaDateFields = [
        'article:published_time', 'article:modified_time', 'article:updated_time',
        'date', 'datePublished', 'dateModified', 'dateCreated', 'lastmod', 'pubdate',
        'DC.date', 'DC.date.created', 'DC.date.modified', 'sailthru.date',
        'publish_date', 'updated_time', 'modified_time', 'creation_date',
        'og:updated_time', 'twitter:data1', 'twitter:label1'
    ];

    metaDateFields.forEach(field => {
        results.debug.dateFieldsChecked++;
        if (metaTags[field]) {
            const date = parseDate(metaTags[field]);
            if (date) {
                results.dates.push({ date, source: `meta:${field}`, text: metaTags[field] });
                if (!results.sources.includes('meta-tags')) {
                    results.sources.push('meta-tags');
                }
            }
        }
    });

    Object.keys(metaTags).forEach(key => {
        if (key.startsWith('time-') || key.startsWith('content-date-') || 
            key.startsWith('text-date-') || key.startsWith('jsonld-')) {
            const date = parseDate(metaTags[key]);
            if (date && date.getFullYear() > 2000 && date <= new Date()) {
                results.dates.push({ 
                    date, 
                    source: `extracted:${key}`, 
                    text: metaTags[key] 
                });
                if (!results.sources.includes('content-elements')) {
                    results.sources.push('content-elements');
                }
            }
        }
    });

    const datePatterns = [
        /(?:פורסם|עודכן|כתב|נוצר|הועלה|נכתב|התפרסם|תאריך)\s*(?:ב[-:]?|ביום|ב|על)?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(?:תאריך|מיום|ב-?|מתאריך)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\s*(?:עודכן|פורסם|נכתב)/gi,
        /(?:published|updated|created|posted|written|modified|edited|date)\s*(?:on|at|:)?\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(?:date|on|posted|published)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\s*(?:updated|published|posted|created)/gi,
        /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/g,
        /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,
        /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2})\b/g,
        /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/g,
        /\b(\d{4}-\d{2}-\d{2})\b/g,
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
        /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi,
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
        /\b(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{1,2},?\s+\d{4}/gi,
        /\b\d{1,2}\s+(?:ב)?(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{4}/gi
    ];

    datePatterns.forEach((pattern, index) => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            results.debug.patternsMatched++;
            const dateStr = match[1] || match[0];
            const date = parseDate(dateStr);
            if (date && date.getFullYear() > 2000 && date <= new Date()) {
                results.dates.push({ 
                    date, 
                    source: 'content-text', 
                    text: match[0].trim(),
                    pattern: `pattern-${index}`
                });
                if (!results.sources.includes('content-text')) {
                    results.sources.push('content-text');
                }
            }
        }
    });

    if (results.dates.length > 0) {
        results.dates.sort((a, b) => b.date - a.date);
        results.latestDate = results.dates[0].date;
        
        const now = new Date();
        const timeDiff = now - results.latestDate;
        results.daysSinceLatest = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        if (results.daysSinceLatest <= 7) {
            results.category = 'very-fresh';
        } else if (results.daysSinceLatest <= 30) {
            results.category = 'fresh';
        } else if (results.daysSinceLatest <= 90) {
            results.category = 'recent';
        } else if (results.daysSinceLatest <= 365) {
            results.category = 'moderate';
        } else {
            results.category = 'old';
        }
    }

    return results;
}

// פונקציה לעדכון הקישורים הפנימיים (רק מהתוכן)
async function getContentInternalLinks(page) {
    return await page.evaluate(() => {
        const contentSelectors = [
            'main', 'article', '.content', '.post-content', '.entry-content',
            '.article-content', '.page-content', '#content', '.main-content'
        ];
        
        const excludeSelectors = [
            'header', 'footer', 'nav', '.navigation', '.menu', '.sidebar',
            '.widget', '.footer', '.header', '.nav', '.breadcrumb', '.breadcrumbs',
            '.related-posts', '.comments', '.comment', '.social-share'
        ];
        
        let contentArea = null;
        
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                contentArea = element;
                break;
            }
        }
        
        if (!contentArea) {
            contentArea = document.body;
        }
        
        const allLinks = Array.from(contentArea.querySelectorAll('a[href]'));
        
        const contentLinks = allLinks.filter(link => {
            for (const excludeSelector of excludeSelectors) {
                if (link.closest(excludeSelector)) {
                    return false;
                }
            }
            return true;
        });
        
        const currentDomain = window.location.hostname;
        const internalLinks = contentLinks.filter(link => {
            const href = link.href;
            return href.includes(currentDomain) || href.startsWith('/') || !href.includes('://');
        });
        
        return {
            totalContentLinks: contentLinks.length,
            internalContentLinks: internalLinks.length,
            internalUrls: internalLinks.map(link => link.href)
        };
    });
}

// פונקציה לחישוב Click Depth
function calculateClickDepth(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        if (pathname === '/' || pathname === '') {
            return 0;
        }
        
        const segments = pathname.split('/').filter(segment => segment.length > 0);
        return segments.length;
        
    } catch (error) {
        return null;
    }
}

// Enhanced SEO Score calculation with new factors
function calculateEnhancedSEOScore(seoData, performanceMetrics, enhancedData) {
    let score = 100;
    const issues = [];
    const recommendations = [];
    const breakdown = {
        content: 0,
        technical: 0,
        performance: 0,
        mobile: 0,
        social: 0,
        structured: 0,
        readability: 0,
        freshness: 0
    };
    
    // Content Score (25 points)
    let contentScore = 25;
    
    if (!seoData.title) {
        contentScore -= 6;
        issues.push('Missing page title');
        recommendations.push('Add a descriptive page title');
    } else if (seoData.titleLength < 30 || seoData.titleLength > 60) {
        contentScore -= 3;
        issues.push('Title length not optimal (30-60 chars)');
        recommendations.push('Optimize title length to 30-60 characters');
    }
    
    if (!seoData.description) {
        contentScore -= 5;
        issues.push('Missing meta description');
        recommendations.push('Add a compelling meta description');
    } else if (seoData.descriptionLength < 120 || seoData.descriptionLength > 160) {
        contentScore -= 2;
        issues.push('Meta description length not optimal (120-160 chars)');
        recommendations.push('Optimize meta description to 120-160 characters');
    }
    
    if (seoData.headings.h1.length === 0) {
        contentScore -= 5;
        issues.push('Missing H1 tag');
        recommendations.push('Add a clear H1 heading that describes the page content');
    } else if (seoData.headings.h1.length > 1) {
        contentScore -= 2;
        issues.push('Multiple H1 tags found');
        recommendations.push('Use only one H1 tag per page');
    }
    
    if (seoData.wordCount < 300) {
        contentScore -= 3;
        issues.push('Content too short (less than 300 words)');
        recommendations.push('Add more valuable content (aim for 300+ words)');
    }
    
    if (seoData.imageAnalysis.withoutAlt > 0) {
        const penalty = Math.min(4, seoData.imageAnalysis.withoutAlt);
        contentScore -= penalty;
        issues.push(`${seoData.imageAnalysis.withoutAlt} images missing alt text`);
        recommendations.push('Add descriptive alt text to all images');
    }
    
    breakdown.content = Math.max(0, contentScore);
    
    // Technical Score (20 points)
    let technicalScore = 20;
    
    if (enhancedData.statusChecks.is_4xx_code) {
        technicalScore -= 8;
        issues.push('Page returns 4xx error');
        recommendations.push('Fix the 4xx error to make page accessible');
    }
    
    if (enhancedData.statusChecks.is_5xx_code) {
        technicalScore -= 10;
        issues.push('Page returns 5xx server error');
        recommendations.push('Fix server error immediately');
    }
    
    if (!seoData.technicalSEO.hasHTTPS) {
        technicalScore -= 5;
        issues.push('Not using HTTPS');
        recommendations.push('Implement SSL certificate for security');
    }
    
    if (!seoData.technicalSEO.hasCanonical) {
        technicalScore -= 2;
        issues.push('Missing canonical URL');
        recommendations.push('Add canonical URL to prevent duplicate content');
    }
    
    if (!seoData.technicalSEO.hasViewport) {
        technicalScore -= 3;
        issues.push('Missing viewport meta tag');
        recommendations.push('Add viewport meta tag for mobile optimization');
    }
    
    breakdown.technical = Math.max(0, technicalScore);
    
    // Performance Score (15 points)
    let performanceScore = 15;
    
    if (performanceMetrics.loadTime > 3000) {
        performanceScore -= 6;
        issues.push('Slow page load time');
        recommendations.push('Optimize images and reduce HTTP requests');
    } else if (performanceMetrics.loadTime > 2000) {
        performanceScore -= 3;
        issues.push('Page load time could be improved');
        recommendations.push('Consider optimizing page load speed');
    }
    
    breakdown.performance = Math.max(0, performanceScore);
    
    // Mobile Score (10 points)
    let mobileScore = 10;
    
    if (!seoData.technicalSEO.isResponsive) {
        mobileScore -= 8;
        issues.push('Not mobile responsive');
        recommendations.push('Implement responsive design for mobile devices');
    }
    
    breakdown.mobile = Math.max(0, mobileScore);
    
    // Social Score (8 points)
    let socialScore = 8;
    
    if (Object.keys(seoData.socialMeta.openGraph).length === 0) {
        socialScore -= 4;
        issues.push('Missing Open Graph tags');
        recommendations.push('Add Open Graph meta tags for social sharing');
    }
    
    if (Object.keys(seoData.socialMeta.twitterCard).length === 0) {
        socialScore -= 2;
        issues.push('Missing Twitter Card tags');
        recommendations.push('Add Twitter Card meta tags');
    }
    
    breakdown.social = Math.max(0, socialScore);
    
    // Structured Data Score (7 points)
    let structuredScore = 7;
    
    if (!seoData.structuredData.hasStructuredData) {
        structuredScore -= 5;
        issues.push('No structured data found');
        recommendations.push('Add Schema.org structured data markup');
    }
    
    breakdown.structured = Math.max(0, structuredScore);
    
    // Readability Score (8 points)
    let readabilityScore = 8;
    
    if (enhancedData.readabilityScore < 30) {
        readabilityScore -= 6;
        issues.push('Content is very difficult to read');
        recommendations.push('Simplify sentences and use shorter words');
    } else if (enhancedData.readabilityScore < 50) {
        readabilityScore -= 3;
        issues.push('Content readability could be improved');
        recommendations.push('Consider shorter sentences and simpler language');
    }
    
    breakdown.readability = Math.max(0, readabilityScore);
    
    // Content Freshness Score (7 points)
    let freshnessScore = 7;
    
    if (enhancedData.contentFreshness === 'old') {
        freshnessScore -= 4;
        issues.push('Content appears to be old');
        recommendations.push('Update content with recent information');
    } else if (enhancedData.contentFreshness === 'fresh') {
        freshnessScore = 7;
    }
    
    breakdown.freshness = Math.max(0, freshnessScore);
    
    const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const grade = totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 70 ? 'C' : totalScore >= 60 ? 'D' : 'F';
    
    return {
        total: Math.max(0, Math.round(totalScore)),
        grade,
        issues,
        recommendations,
        breakdown
    };
}

// Extract all schema types from page
async function extractAllSchemas(page, options = {}) {
    const results = {};
    
    try {
        results.jsonLD = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            return scripts.map(script => {
                try {
                    return JSON.parse(script.textContent);
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
        });
    } catch (e) {
        results.jsonLD = [];
    }
    
    try {
        results.microdata = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('[itemscope]'));
            return items.map(item => {
                const type = item.getAttribute('itemtype');
                const properties = {};
                
                const props = Array.from(item.querySelectorAll('[itemprop]'));
                props.forEach(prop => {
                    const name = prop.getAttribute('itemprop');
                    const value = prop.getAttribute('content') || 
                                 prop.getAttribute('datetime') ||
                                 prop.textContent.trim();
                    properties[name] = value;
                });
                
                return { type, properties };
            });
        });
    } catch (e) {
        results.microdata = [];
    }
    
    try {
        results.openGraph = await page.evaluate(() => {
            const ogTags = Array.from(document.querySelectorAll('meta[property^="og:"]'));
            const og = {};
            ogTags.forEach(tag => {
                const property = tag.getAttribute('property').replace('og:', '');
                const content = tag.getAttribute('content');
                og[property] = content;
            });
            return og;
        });
    } catch (e) {
        results.openGraph = {};
    }
    
    try {
        results.twitterCard = await page.evaluate(() => {
            const twitterTags = Array.from(document.querySelectorAll('meta[name^="twitter:"]'));
            const twitter = {};
            twitterTags.forEach(tag => {
                const name = tag.getAttribute('name').replace('twitter:', '');
                const content = tag.getAttribute('content');
                twitter[name] = content;
            });
            return twitter;
        });
    } catch (e) {
        results.twitterCard = {};
    }
    
    try {
        results.seoMeta = await page.evaluate(() => ({
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
            keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content'),
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
            robots: document.querySelector('meta[name="robots"]')?.getAttribute('content')
        }));
    } catch (e) {
        results.seoMeta = {};
    }
    
    return results;
}

// Cleanup old screenshots (older than 7 days)
function cleanupOldScreenshots() {
    const fs = require('fs');
    const path = require('path');
    const screenshotsDir = '/app/screenshots';
    
    try {
        if (fs.existsSync(screenshotsDir)) {
            const files = fs.readdirSync(screenshotsDir);
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            
            files.forEach(file => {
                const filePath = path.join(screenshotsDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > sevenDays) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Cleaned up old screenshot: ${file}`);
                }
            });
        }
    } catch (error) {
        console.error('Error cleaning up screenshots:', error);
    }
}

const app = express();
const schemaValidator = new SmartSchemaValidator();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Static files serving for screenshots
app.use('/screenshots', express.static('/app/screenshots', {
    maxAge: '7d',
    setHeaders: (res, path) => {
        res.setHeader('Content-Type', 'image/png');
    }
}));

// Global browser instance
let globalBrowser = null;

// Initialize browser
async function initBrowser() {
    try {
        globalBrowser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        console.log('🎭 Playwright browser initialized');
    } catch (error) {
        console.error('Failed to initialize browser:', error);
    }
}

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Playwright Universal Automation API',
        version: '2.1.0',
        features: [
            'comprehensive-seo-analysis',
            'structured-data-extraction', 
            'performance-monitoring',
            'accessibility-check',
            'mobile-optimization',
            'core-web-vitals',
            'screenshots',
            'schema-extraction',
            'readability-analysis',
            'keyword-density',
            'content-freshness',
            'click-depth-analysis',
            'quick-check'
        ],
        timestamp: new Date().toISOString()
    });
});

// Quick check endpoint - simple structured data check
app.get('/api/extract/quick-check', async (req, res) => {
    const { url, includeScreenshot = false, detailed = true } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    const browser = globalBrowser || await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        const startTime = Date.now();
        
        const response = await page.goto(url, { waitUntil: 'networkidle' });
        const loadTime = Date.now() - startTime;
        const statusCode = response.status();
        
        const statusChecks = {
            is_4xx_code: statusCode >= 400 && statusCode < 500,
            is_5xx_code: statusCode >= 500,
            is_redirect: statusCode >= 300 && statusCode < 400
        };
        
        const performanceMetrics = await page.evaluate(() => {
            const perfData = performance.getEntriesByType('navigation')[0];
            const paintMetrics = performance.getEntriesByType('paint');
            
            return {
                loadTime: perfData?.loadEventEnd - perfData?.loadEventStart || 0,
                domContentLoaded: perfData?.domContentLoadedEventEnd - perfData?.domContentLoadedEventStart || 0,
                firstContentfulPaint: paintMetrics.find(m => m.name === 'first-contentful-paint')?.startTime || 0,
                largestContentfulPaint: paintMetrics.find(m => m.name === 'largest-contentful-paint')?.startTime || 0,
                timeToInteractive: perfData?.loadEventEnd || 0
            };
        });

        // חילוץ meta tags מורחב ומשופר
        const metaTags = await page.evaluate(() => {
            const tags = {};
            
            document.querySelectorAll('meta').forEach(meta => {
                const name = meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('itemprop');
                const content = meta.getAttribute('content');
                if (name && content) {
                    tags[name] = content;
                }
            });
            
            const timeTags = document.querySelectorAll('time[datetime]');
            timeTags.forEach((time, index) => {
                tags[`time-${index}`] = time.getAttribute('datetime');
            });
            
            const timeTagsText = document.querySelectorAll('time:not([datetime])');
            timeTagsText.forEach((time, index) => {
                const text = time.textContent.trim();
                if (text) {
                    tags[`time-text-${index}`] = text;
                }
            });
            
            const dateSelectors = [
                '.published', '.date-published', '.post-date', '.article-date',
                '.entry-date', '.created-date', '.updated-date', '.modified-date',
                '.publish-date', '.publication-date', '.timestamp', '.date-time',
                '[class*="date"]', '[class*="time"]', '[id*="date"]', '[id*="time"]',
                '.byline', '.dateline', '.post-meta .date', '.entry-meta .date',
                '.article-meta .date', '.meta-date', '.date-meta'
            ];
            
            dateSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el, index) => {
                    const text = el.textContent || el.getAttribute('title') || 
                                el.getAttribute('datetime') || el.getAttribute('data-date');
                    if (text && text.trim()) {
                        tags[`content-date-${selector.replace(/[^a-zA-Z]/g, '')}-${index}`] = text.trim();
                    }
                });
            });
            
            const textElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
            let dateTextIndex = 0;
            textElements.forEach(el => {
                const text = el.textContent;
                if (text && text.length < 200) {
                    const datePattern = /(?:published|updated|created|posted|written|modified|edited|פורסם|עודכן|כתב|נוצר)\s*(?:on|at|ב|ביום)?\s*[:\-]?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/i;
                    if (datePattern.test(text)) {
                        tags[`text-date-${dateTextIndex++}`] = text.trim();
                    }
                }
            });
            
            const jsonLDScripts = document.querySelectorAll('script[type="application/ld+json"]');
            jsonLDScripts.forEach((script, index) => {
                try {
                    const data = JSON.parse(script.textContent);
                    
                    function extractDates(obj, prefix = '') {
                        if (!obj || typeof obj !== 'object') return;
                        
                        Object.keys(obj).forEach(key => {
                            if (key.toLowerCase().includes('date') || 
                                key.toLowerCase().includes('published') || 
                                key.toLowerCase().includes('modified')) {
                                const value = obj[key];
                                if (typeof value === 'string' && value) {
                                    tags[`jsonld-${prefix}${key}-${index}`] = value;
                                }
                            } else if (typeof obj[key] === 'object') {
                                extractDates(obj[key], `${prefix}${key}-`);
                            }
                        });
                    }
                    
                    if (Array.isArray(data)) {
                        data.forEach((item, i) => extractDates(item, `item${i}-`));
                    } else {
                        extractDates(data);
                    }
                } catch (e) {
                    // שגיאה בפרסור JSON
                }
            });
            
            return tags;
        });

        // Comprehensive SEO analysis
        const seoData = await page.evaluate(() => {
            // פונקציה לניקוי טקסט ומציאת התוכן הראשי
            function findMainContent() {
                const contentSelectors = [
                    'main', 'article', '[role="main"]', '#main', '#content', '.main',
                    '.content', '.post-content', '.entry-content', '.article-content', 
                    '.page-content', '.main-content', '.site-content', '.primary-content',
                    '.post-body', '.entry-body', '.article-body', '.content-area',
                    '.single-content', '.page-wrapper', '.container .content',
                    'div[id*="content"]', 'div[class*="content"]', 'div[class*="post"]',
                    'div[class*="article"]', 'section[class*="content"]'
                ];
                
                const excludeSelectors = [
                    'header', 'footer', 'nav', '.navigation', '.menu', '.sidebar',
                    '.widget', '.footer', '.header', '.nav', '.breadcrumb', '.breadcrumbs',
                    '.related-posts', '.comments', '.comment', '.social-share', 
                    'script', 'style', 'noscript', '.advertisement', '.ads', '.banner',
                    '.popup', '.modal', '.overlay', '.cookie', '.newsletter-signup',
                    '.share-buttons', '.social-buttons', '.tags', '.categories',
                    '.author-bio', '.author-info', '.meta', '.metadata', '.byline',
                    'aside', '[role="complementary"]', '[role="banner"]', '[role="contentinfo"]',
                    'form', 'iframe', 'video', 'audio', 'embed', 'object'
                ];
                
                let contentArea = null;
                let maxScore = 0;
                
                for (const selector of contentSelectors) {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        let isExcluded = false;
                        for (const excludeSelector of excludeSelectors) {
                            if (element.closest(excludeSelector) || element.matches(excludeSelector)) {
                                isExcluded = true;
                                break;
                            }
                        }
                        
                        if (!isExcluded) {
                            const textLength = (element.innerText || element.textContent || '').length;
                            const paragraphs = element.querySelectorAll('p').length;
                            const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
                            
                            const score = textLength + (paragraphs * 50) + (headings * 30);
                            
                            if (score > maxScore && textLength > 100) {
                                maxScore = score;
                                contentArea = element;
                            }
                        }
                    });
                }
                
                if (!contentArea || maxScore < 200) {
                    contentArea = document.body;
                }
                
                return contentArea;
            }
            
            const contentArea = findMainContent();
            
            const cleanContent = contentArea.cloneNode(true);
            
            const excludeSelectors = [
                'header', 'footer', 'nav', '.navigation', '.menu', '.sidebar',
                '.widget', '.footer', '.header', '.nav', '.breadcrumb', '.breadcrumbs',
                '.related-posts', '.comments', '.comment', '.social-share', 
                'script', 'style', 'noscript', '.advertisement', '.ads', '.banner',
                '.popup', '.modal', '.overlay', '.cookie', '.newsletter-signup',
                '.share-buttons', '.social-buttons', '.tags', '.categories',
                '.author-bio', '.author-info', '.meta', '.metadata', '.byline',
                'aside', 'form', 'iframe', 'video', 'audio', 'embed', 'object',
                '.skip-link', '.screen-reader-text', '.sr-only', '.visually-hidden'
            ];
            
            excludeSelectors.forEach(selector => {
                cleanContent.querySelectorAll(selector).forEach(el => el.remove());
            });
            
            let mainText = '';
            
            if (cleanContent.innerText) {
                mainText = cleanContent.innerText;
            } else {
                mainText = cleanContent.textContent || '';
            }
            
            mainText = mainText
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n')
                .replace(/^\s+|\s+$/g, '')
                .trim();
            
            const words = mainText
                .split(/[\s\n\r\t]+/)
                .filter(word => {
                    const cleanWord = word.replace(/[^\w\u0590-\u05FF]/g, '');
                    return cleanWord.length >= 2 && /[a-zA-Z\u0590-\u05FF]/.test(cleanWord);
                });
            
            const allImages = Array.from(document.querySelectorAll('img'));
            const contentImages = allImages.filter(img => {
                if (!contentArea.contains(img)) return false;
                
                const excludeSelectors = [
                    'header', 'footer', 'nav', '.navigation', '.menu', '.sidebar',
                    '.widget', '.advertisement', '.ads', '.banner', '.logo',
                    '.author-bio', '.social-share', '.comments'
                ];
                
                for (const selector of excludeSelectors) {
                    if (img.closest(selector)) return false;
                }
                
                const rect = img.getBoundingClientRect();
                if (rect.width < 50 && rect.height < 50) return false;
                
                return true;
            });
            
            const contentData = {
                text: mainText,
                wordCount: words.length,
                imageCount: contentImages.length,
                imagesWithoutAlt: contentImages.filter(img => !img.getAttribute('alt') || img.getAttribute('alt').trim() === '').length,
                debug: {
                    contentAreaTag: contentArea.tagName,
                    contentAreaClass: contentArea.className,
                    contentAreaId: contentArea.id,
                    originalTextLength: (contentArea.innerText || contentArea.textContent || '').length,
                    cleanedTextLength: mainText.length,
                    totalImages: allImages.length,
                    contentImages: contentImages.length
                }
            };

            // Basic meta data
            const title = document.title;
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
            const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
            const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
            
            const lang = document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') || '';
            const charset = document.querySelector('meta[charset]')?.getAttribute('charset') || 
                           document.querySelector('meta[http-equiv="content-type"]')?.getAttribute('content') || '';
            
            const headings = {
                h1: Array.from(document.querySelectorAll('h1')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h2: Array.from(document.querySelectorAll('h2')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h3: Array.from(document.querySelectorAll('h3')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h4: document.querySelectorAll('h4').length,
                h5: document.querySelectorAll('h5').length,
                h6: document.querySelectorAll('h6').length
            };
            
            const images = Array.from(document.querySelectorAll('img'));
            const imageAnalysis = {
                total: contentData.imageCount,
                withAlt: contentData.imageCount - contentData.imagesWithoutAlt,
                withoutAlt: contentData.imagesWithoutAlt,
                withTitle: images.filter(img => img.getAttribute('title')).length,
                withLazyLoading: images.filter(img => img.getAttribute('loading') === 'lazy').length,
                oversized: images.filter(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 1920 || rect.height > 1080;
                }).length
            };
            
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            const internalLinks = allLinks.filter(link => {
                const href = link.getAttribute('href');
                return href.startsWith('/') || href.startsWith(window.location.origin) || (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:'));
            });
            const externalLinks = allLinks.filter(link => {
                const href = link.getAttribute('href');
                return href.startsWith('http') && !href.startsWith(window.location.origin);
            });
            
            const linkAnalysis = {
                total: allLinks.length,
                internal: internalLinks.length,
                external: externalLinks.length,
                nofollow: allLinks.filter(link => link.getAttribute('rel')?.includes('nofollow')).length,
                withoutText: allLinks.filter(link => !link.textContent.trim()).length,
                broken: []
            };
            
            const wordCount = contentData.wordCount;
            const readingTime = Math.ceil(wordCount / 200);
            
            const forms = Array.from(document.querySelectorAll('form'));
            const formAnalysis = {
                total: forms.length,
                withAction: forms.filter(form => form.getAttribute('action')).length,
                withMethod: forms.filter(form => form.getAttribute('method')).length,
                inputs: document.querySelectorAll('input').length,
                textareas: document.querySelectorAll('textarea').length,
                selects: document.querySelectorAll('select').length
            };
            
            const socialMeta = {
                openGraph: {},
                twitterCard: {},
                facebook: {}
            };
            
            document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
                const property = meta.getAttribute('property').replace('og:', '');
                socialMeta.openGraph[property] = meta.getAttribute('content');
            });
            
            document.querySelectorAll('meta[name^="twitter:"]').forEach(meta => {
                const name = meta.getAttribute('name').replace('twitter:', '');
                socialMeta.twitterCard[name] = meta.getAttribute('content');
            });
            
            const structuredData = {
                jsonLD: [],
                microdata: [],
                hasStructuredData: false
            };
            
            try {
                const jsonLDScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                structuredData.jsonLD = jsonLDScripts.map(script => {
                    try {
                        return JSON.parse(script.textContent);
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);
                structuredData.hasStructuredData = structuredData.jsonLD.length > 0;
            } catch (e) {}
            
            try {
                const itemScopes = Array.from(document.querySelectorAll('[itemscope]'));
                structuredData.microdata = itemScopes.map(item => ({
                    type: item.getAttribute('itemtype'),
                    properties: Array.from(item.querySelectorAll('[itemprop]')).map(prop => ({
                        name: prop.getAttribute('itemprop'),
                        value: prop.getAttribute('content') || prop.textContent.trim()
                    }))
                }));
                if (structuredData.microdata.length > 0) {
                    structuredData.hasStructuredData = true;
                }
            } catch (e) {}
            
            const technicalSEO = {
                hasHTTPS: window.location.protocol === 'https:',
                hasRobotsTxt: false,
                hasSitemap: !!document.querySelector('link[rel="sitemap"]'),
                hasCanonical: !!canonical,
                hasViewport: !!viewport,
                isResponsive: !!viewport && viewport.includes('width=device-width'),
                hasCharset: !!charset,
                hasLang: !!lang,
                amp: !!document.querySelector('html[amp]') || !!document.querySelector('html[⚡]')
            };
            
            const pageSpeedIndicators = {
                totalStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
                totalScripts: document.querySelectorAll('script[src]').length,
                inlineStyles: document.querySelectorAll('style').length,
                inlineScripts: document.querySelectorAll('script:not([src])').length,
                totalImages: images.length,
                hasMinifiedCSS: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link => 
                    link.getAttribute('href')?.includes('.min.css')),
                hasMinifiedJS: Array.from(document.querySelectorAll('script[src]')).some(script => 
                    script.getAttribute('src')?.includes('.min.js'))
            };
            
            return {
                title,
                titleLength: title.length,
                description,
                descriptionLength: description.length,
                keywords,
                canonical,
                robots,
                viewport,
                lang,
                charset,
                headings,
                wordCount,
                readingTime,
                imageAnalysis,
                linkAnalysis,
                formAnalysis,
                socialMeta,
                structuredData,
                technicalSEO,
                pageSpeedIndicators,
                url: window.location.href,
                urlLength: window.location.href.length,
                hasParameters: window.location.search.length > 0,
                hasFragment: window.location.hash.length > 0,
                checks: {
                    no_h1_tag: document.querySelectorAll('h1').length === 0,
                    no_image_alt: document.querySelectorAll('img:not([alt]), img[alt=""]').length > 0,
                    broken_links: []
                },
                _contentData: contentData
            };
        });
        
        const extractedContentData = seoData._contentData;
        const readabilityScore = calculateFleschScore(extractedContentData.text);
        const keywordDensity = analyzeKeywordDensity(extractedContentData.text);
        const contentFreshness = analyzeContentFreshness(extractedContentData.text, metaTags);
        const contentLinks = await getContentInternalLinks(page);
        const clickDepth = calculateClickDepth(url);
        
        // Enhanced data object for score calculation
        const enhancedData = {
            statusChecks,
            readabilityScore: readabilityScore.score,
            contentFreshness: contentFreshness.category,
            clickDepth
        };
        
        // Calculate enhanced SEO score
        const seoScore = calculateEnhancedSEOScore(seoData, performanceMetrics, enhancedData);
        
        // Extract all schemas
        const allSchemas = await extractAllSchemas(page);
        
        // Screenshot handling
        let screenshotUrl = null;
        if (includeScreenshot) {
            try {
                const fs = require('fs');
                const path = require('path');
                
                const screenshotsDir = '/app/screenshots';
                if (!fs.existsSync(screenshotsDir)) {
                    fs.mkdirSync(screenshotsDir, { recursive: true });
                }
                
                const timestamp = Date.now();
                const screenshotPath = path.join(screenshotsDir, `screenshot_${timestamp}.png`);
                
                await page.screenshot({ 
                    path: screenshotPath, 
                    fullPage: true,
                    type: 'png'
                });
                
                screenshotUrl = `/screenshots/screenshot_${timestamp}.png`;
                
                // Cleanup old screenshots
                cleanupOldScreenshots();
                
            } catch (screenshotError) {
                console.error('Screenshot error:', screenshotError);
            }
        }

        // Clean up _contentData before sending response
        delete seoData._contentData;

        // Build comprehensive response
        const apiResponse = {
            success: true,
            data: {
                url: url,
                timestamp: new Date().toISOString(),
                statusCode,
                statusChecks,
                performanceMetrics: {
                    ...performanceMetrics,
                    totalLoadTime: loadTime
                },
                seoData,
                seoScore,
                readabilityAnalysis: readabilityScore,
                keywordDensity,
                contentFreshness,
                contentLinks,
                clickDepth,
                allSchemas,
                screenshot: screenshotUrl
            }
        };

        // Add debug information if detailed analysis requested
        if (detailed) {
            apiResponse.data.debug = {
                metaTagsExtracted: Object.keys(metaTags).length,
                contentExtractionMethod: 'advanced-content-area-detection',
                readabilityLanguage: readabilityScore.details ? 'detected' : 'unknown',
                keywordLanguage: keywordDensity.language,
                freshnessAnalysis: {
                    datesFound: contentFreshness.dates.length,
                    sourcesUsed: contentFreshness.sources,
                    latestDate: contentFreshness.latestDate
                }
            };
        }

        res.json(apiResponse);

    } catch (error) {
        console.error('SEO Audit Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze URL',
            details: error.message
        });
    } finally {
        if (page) {
            await page.close();
        }
    }
});

// Quick check endpoint - simple structured data check
app.post('/api/extract/quick-check', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required in request body'
        });
    }

    const browser = globalBrowser || await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        
        const quickCheckData = await page.evaluate(() => {
            const results = {
                hasJsonLD: false,
                hasMicrodata: false,
                hasOpenGraph: false,
                hasTwitterCard: false,
                schemaTypes: []
            };
            
            // Check JSON-LD
            const jsonLDScripts = document.querySelectorAll('script[type="application/ld+json"]');
            if (jsonLDScripts.length > 0) {
                results.hasJsonLD = true;
                
                jsonLDScripts.forEach(script => {
                    try {
                        const data = JSON.parse(script.textContent);
                        
                        function extractTypes(obj) {
                            if (!obj) return;
                            
                            if (obj['@type']) {
                                if (Array.isArray(obj['@type'])) {
                                    obj['@type'].forEach(type => {
                                        if (!results.schemaTypes.includes(type)) {
                                            results.schemaTypes.push(type);
                                        }
                                    });
                                } else {
                                    if (!results.schemaTypes.includes(obj['@type'])) {
                                        results.schemaTypes.push(obj['@type']);
                                    }
                                }
                            }
                            
                            // Check nested objects
                            Object.values(obj).forEach(value => {
                                if (typeof value === 'object' && value !== null) {
                                    if (Array.isArray(value)) {
                                        value.forEach(item => extractTypes(item));
                                    } else {
                                        extractTypes(value);
                                    }
                                }
                            });
                        }
                        
                        if (Array.isArray(data)) {
                            data.forEach(item => extractTypes(item));
                        } else {
                            extractTypes(data);
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                });
            }
            
            // Check Microdata
            const microdataItems = document.querySelectorAll('[itemscope]');
            if (microdataItems.length > 0) {
                results.hasMicrodata = true;
                
                microdataItems.forEach(item => {
                    const itemType = item.getAttribute('itemtype');
                    if (itemType) {
                        const typeName = itemType.split('/').pop();
                        if (!results.schemaTypes.includes(typeName)) {
                            results.schemaTypes.push(typeName);
                        }
                    }
                });
            }
            
            // Check Open Graph
            const ogTags = document.querySelectorAll('meta[property^="og:"]');
            results.hasOpenGraph = ogTags.length > 0;
            
            // Check Twitter Card
            const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
            results.hasTwitterCard = twitterTags.length > 0;
            
            return results;
        });
        
        // Calculate structured data score
        let structuredDataScore = 0;
        
        if (quickCheckData.hasJsonLD) structuredDataScore += 40;
        if (quickCheckData.hasMicrodata) structuredDataScore += 20;
        if (quickCheckData.hasOpenGraph) structuredDataScore += 15;
        if (quickCheckData.hasTwitterCard) structuredDataScore += 10;
        if (quickCheckData.schemaTypes.length > 0) structuredDataScore += 15;
        
        // Bonus for multiple schema types
        if (quickCheckData.schemaTypes.length >= 3) structuredDataScore += 10;
        if (quickCheckData.schemaTypes.length >= 5) structuredDataScore += 10;
        
        structuredDataScore = Math.min(100, structuredDataScore);
        
        // Generate recommendation
        let recommendation = '';
        if (structuredDataScore >= 80) {
            recommendation = 'Excellent structured data implementation';
        } else if (structuredDataScore >= 60) {
            recommendation = 'Good structured data implementation';
        } else if (structuredDataScore >= 40) {
            recommendation = 'Basic structured data found, consider improvements';
        } else if (structuredDataScore >= 20) {
            recommendation = 'Limited structured data, significant improvements needed';
        } else {
            recommendation = 'No structured data found, implementation recommended';
        }
        
        const quickCheck = {
            hasStructuredData: quickCheckData.hasJsonLD || quickCheckData.hasMicrodata,
            hasJsonLD: quickCheckData.hasJsonLD,
            hasMicrodata: quickCheckData.hasMicrodata,
            hasOpenGraph: quickCheckData.hasOpenGraph,
            hasTwitterCard: quickCheckData.hasTwitterCard,
            schemaTypes: quickCheckData.schemaTypes,
            structuredDataScore
        };
        
        res.json([{
            success: true,
            url,
            quickCheck,
            recommendation
        }]);

    } catch (error) {
        console.error('Quick check error:', error);
        res.status(500).json([{
            success: false,
            url,
            error: 'Failed to perform quick check',
            details: error.message
        }]);
    } finally {
        if (page) {
            await page.close();
        }
    }
});

// Schema validation endpoint
app.post('/api/schema/validate', async (req, res) => {
    const { data, schemaType } = req.body;
    
    if (!data) {
        return res.status(400).json({
            success: false,
            error: 'Data is required for validation'
        });
    }

    try {
        const result = schemaValidator.validateSchema(data);
        res.json({
            success: true,
            validation: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Validation failed',
            details: error.message
        });
    }
});

// Extract schemas from URL endpoint
app.post('/api/schema/extract', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL is required'
        });
    }

    const browser = globalBrowser || await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        const schemas = await extractAllSchemas(page);
        
        // Validate each schema found
        const validatedSchemas = {
            jsonLD: [],
            microdata: [],
            openGraph: schemas.openGraph,
            twitterCard: schemas.twitterCard,
            seoMeta: schemas.seoMeta
        };

        // Validate JSON-LD schemas
        if (schemas.jsonLD && schemas.jsonLD.length > 0) {
            validatedSchemas.jsonLD = schemas.jsonLD.map(schema => {
                const validation = schemaValidator.validateSchema(schema);
                return {
                    data: schema,
                    validation
                };
            });
        }

        // Validate Microdata schemas
        if (schemas.microdata && schemas.microdata.length > 0) {
            validatedSchemas.microdata = schemas.microdata.map(schema => {
                const validation = schemaValidator.validateSchema(schema);
                return {
                    data: schema,
                    validation
                };
            });
        }

        res.json({
            success: true,
            data: {
                url,
                timestamp: new Date().toISOString(),
                schemas: validatedSchemas,
                summary: {
                    totalSchemas: validatedSchemas.jsonLD.length + validatedSchemas.microdata.length,
                    hasOpenGraph: Object.keys(schemas.openGraph).length > 0,
                    hasTwitterCard: Object.keys(schemas.twitterCard).length > 0,
                    hasStructuredData: validatedSchemas.jsonLD.length > 0 || validatedSchemas.microdata.length > 0
                }
            }
        });

    } catch (error) {
        console.error('Schema extraction error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to extract schemas',
            details: error.message
        });
    } finally {
        if (page) {
            await page.close();
        }
    }
});

// Quick readability check endpoint
app.post('/api/readability/analyze', (req, res) => {
    const { text, language = 'english' } = req.body;
    
    if (!text) {
        return res.status(400).json({
            success: false,
            error: 'Text is required'
        });
    }

    try {
        const readabilityScore = calculateFleschScore(text, language);
        const keywordDensity = analyzeKeywordDensity(text);
        
        res.json({
            success: true,
            data: {
                readability: readabilityScore,
                keywords: keywordDensity,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Analysis failed',
            details: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'POST /api/extract/quick-check',
            'POST /api/seo/audit',
            'POST /api/schema/validate',
            'POST /api/schema/extract',
            'POST /api/readability/analyze'
        ]
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    if (globalBrowser) {
        await globalBrowser.close();
        console.log('🎭 Browser closed');
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    if (globalBrowser) {
        await globalBrowser.close();
        console.log('🎭 Browser closed');
    }
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        await initBrowser();
        
        app.listen(PORT, () => {
            console.log(`🚀 SEO Analysis API Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔍 SEO Audit: POST http://localhost:${PORT}/api/seo/audit`);
            console.log(`📋 Schema Extract: POST http://localhost:${PORT}/api/schema/extract`);
            console.log(`📝 Readability: POST http://localhost:${PORT}/api/readability/analyze`);
            console.log(`✅ Schema Validate: POST http://localhost:${PORT}/api/schema/validate`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Initialize server
startServer();
