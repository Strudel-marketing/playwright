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
                    name: { type: 'string', minLength: 1 }
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

// Stop words for keyword filtering
const STOP_WORDS = {
    hebrew: ['של', 'את', 'על', 'עם', 'אל', 'מן', 'כל', 'זה', 'זו', 'זאת', 'הוא', 'היא', 'הם', 'הן', 'אני', 'אתה', 'את', 'אנחנו', 'אתם', 'אתן', 'יש', 'אין', 'היה', 'הייה', 'יהיה', 'תהיה', 'רק', 'גם', 'כי', 'אם', 'מה', 'איך', 'איפה', 'מתי', 'למה', 'מי', 'כמה', 'איזה', 'איזו', 'אחד', 'אחת', 'שני', 'שתי', 'ראשון', 'ראשונה', 'שנייה', 'שלישי'],
    english: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'when', 'where', 'why', 'how', 'who', 'which', 'one', 'two', 'first', 'second', 'third']
};

// Calculate syllables for readability
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

// Get readability level
function getReadabilityLevel(score) {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
}

// Calculate Flesch Reading Score
function calculateFleschScore(text, language = 'english') {
    if (!text || text.trim().length === 0) {
        return { score: 0, level: 'unknown', error: 'No text provided' };
    }

    const cleanText = text.replace(/[^\u0590-\u05FFa-zA-Z0-9\s.,!?;:()]/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();

    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0 || words.length === 0) {
        return { score: 0, level: 'unknown', error: 'No sentences or words found' };
    }

    let totalSyllables = 0;
    words.forEach(word => {
        totalSyllables += countSyllables(word, language);
    });

    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = totalSyllables / words.length;
    
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
            wordCount: words.length,
            sentenceCount: sentences.length,
            avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
            avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
            totalSyllables
        }
    };
}

// Analyze keyword density
function analyzeKeywordDensity(text) {
    if (!text || text.trim().length === 0) {
        return { 
            topKeywords: [], 
            totalWords: 0, 
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
            language: language,
            error: 'Insufficient keywords after filtering' 
        };
    }

    const wordCounts = new Map();
    filteredWords.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const topKeywords = Array.from(wordCounts.entries())
        .filter(([word, count]) => count >= 2)
        .map(([word, count]) => ({
            keyword: word,
            count: count,
            density: Math.round((count / allWords.length) * 100 * 100) / 100
        }))
        .sort((a, b) => b.density - a.density)
        .slice(0, 10);

    return {
        topKeywords,
        totalWords: allWords.length,
        language: language,
        averageDensity: topKeywords.length > 0 ? 
            Math.round((topKeywords.reduce((sum, kw) => sum + kw.density, 0) / topKeywords.length) * 100) / 100 : 0
    };
}

// Parse date from string with multiple formats
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    const cleanStr = dateStr.trim();
    
    // Try direct parsing first
    let date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
        return date;
    }

    // Try specific formats
    const formats = [
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        /^\d{4}-\d{2}-\d{2}/,
        /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
        /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/
    ];

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

// Enhanced content freshness analysis with meta tag parsing
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

    // Check meta tags for dates
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

    // Check extracted date elements
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

    // Enhanced date patterns in text
    const datePatterns = [
        /(?:published|updated|created|posted|written|modified|edited|פורסם|עודכן|כתב|נוצר)\s*(?:on|at|ב|ביום)?\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(?:date|on|posted|published)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/g,
        /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,
        /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/g,
        /\b(\d{4}-\d{2}-\d{2})\b/g,
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
        /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi,
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
        /\b(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{1,2},?\s+\d{4}/gi
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

// Calculate click depth
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

// Enhanced SEO score calculation
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
    
    if (seoData.imageAnalysis && seoData.imageAnalysis.withoutAlt > 0) {
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
    
    if (performanceMetrics.totalLoadTime > 3000) {
        performanceScore -= 6;
        issues.push('Slow page load time');
        recommendations.push('Optimize images and reduce HTTP requests');
    } else if (performanceMetrics.totalLoadTime > 2000) {
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
    
    if (seoData.socialMeta && Object.keys(seoData.socialMeta.openGraph).length === 0) {
        socialScore -= 4;
        issues.push('Missing Open Graph tags');
        recommendations.push('Add Open Graph meta tags for social sharing');
    }
    
    if (seoData.socialMeta && Object.keys(seoData.socialMeta.twitterCard).length === 0) {
        socialScore -= 2;
        issues.push('Missing Twitter Card tags');
        recommendations.push('Add Twitter Card meta tags');
    }
    
    breakdown.social = Math.max(0, socialScore);
    
    // Structured Data Score (7 points)
    let structuredScore = 7;
    // Will be checked later with allSchemas
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
    } else if (enhancedData.contentFreshness === 'fresh' || enhancedData.contentFreshness === 'very-fresh') {
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

// Get internal links from content
async function getContentInternalLinks(page) {
    return await page.evaluate(() => {
        const contentSelectors = ['main', 'article', '.content', '.post-content', '#content'];
        
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
        const currentDomain = window.location.hostname;
        
        const internalLinks = allLinks.filter(link => {
            const href = link.href;
            return href.includes(currentDomain) || href.startsWith('/') || !href.includes('://');
        });
        
        return {
            totalContentLinks: allLinks.length,
            internalContentLinks: internalLinks.length
        };
    });
}

// Extract all schemas
async function extractAllSchemas(page) {
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
    
    return results;
}

// Cleanup old screenshots
function cleanupOldScreenshots() {
    const fs = require('fs');
    const path = require('path');
    const screenshotsDir = '/app/screenshots';
    
    try {
        if (fs.existsSync(screenshotsDir)) {
            const files = fs.readdirSync(screenshotsDir);
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            
            files.forEach(file => {
                const filePath = path.join(screenshotsDir, file);
                const stats = fs.statSync(filePath);
                
                if (Date.now() - stats.mtime.getTime() > sevenDays) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Cleaned up old screenshot: ${file}`);
                }
            });
        }
    } catch (error) {
        console.error('Error cleaning up screenshots:', error);
    }
}

// Initialize Express app
const app = express();
const schemaValidator = new SmartSchemaValidator();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Static files for screenshots
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
        service: 'Playwright SEO Analysis API',
        version: '2.2.0',
        features: [
            'seo-analysis',
            'performance-monitoring',
            'readability-analysis',
            'keyword-density',
            'content-freshness',
            'markdown-extraction',
            'structured-data-extraction',
            'screenshots',
            'paa-extraction'
        ],
        timestamp: new Date().toISOString()
    });
});

// Main SEO Audit Endpoint
app.post('/api/seo/audit', async (req, res) => {
    console.log('🔍 SEO Audit started for:', req.body.url);
    
    const { url, includeScreenshot = true, options = {} } = req.body;
    
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
        // Navigation settings
        const timeout = options.timeout || 30000;
        const waitUntil = options.waitUntil || 'domcontentloaded';
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);
        
        // Load page and measure performance
        const startTime = Date.now();
        const response = await page.goto(url, { waitUntil, timeout });
        const statusCode = response.status();
        const loadTime = Date.now() - startTime;
        
        console.log(`✅ Page loaded in ${loadTime}ms with status ${statusCode}`);
        
        // Get performance metrics
        const performanceMetrics = await page.evaluate((loadTime) => {
            const nav = performance.getEntriesByType('navigation')[0] || {};
            const paints = performance.getEntriesByType('paint');
            return {
                loadTime,
                domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart || 0,
                firstContentfulPaint: paints.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
                largestContentfulPaint: paints.find(p => p.name === 'largest-contentful-paint')?.startTime || 0,
                totalLoadTime: loadTime
            };
        }, loadTime);

        // Extract extended meta tags for date analysis
        const metaTags = await page.evaluate(() => {
            const tags = {};
            
            // Basic meta tags
            document.querySelectorAll('meta').forEach(meta => {
                const name = meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('itemprop');
                const content = meta.getAttribute('content');
                if (name && content) {
                    tags[name] = content;
                }
            });
            
            // Time elements with datetime
            const timeTags = document.querySelectorAll('time[datetime]');
            timeTags.forEach((time, index) => {
                tags[`time-${index}`] = time.getAttribute('datetime');
            });
            
            // Date-related CSS selectors
            const dateSelectors = [
                '.published', '.date-published', '.post-date', '.article-date',
                '.entry-date', '.created-date', '.updated-date', '.modified-date',
                '.publish-date', '.publication-date', '.timestamp', '.date-time'
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
            
            // JSON-LD date extraction
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
                    // Skip invalid JSON
                }
            });
            
            return tags;
        });

        // Extract comprehensive SEO data and content analysis
        const { seoData, mainText, contentData } = await page.evaluate(() => {
            // Advanced content area detection
            function findMainContent() {
                const contentSelectors = [
                    'main', 'article', '[role="main"]', '#main', '#content', '.main',
                    '.content', '.post-content', '.entry-content', '.article-content', 
                    '.page-content', '.main-content', '.site-content', '.primary-content',
                    '.post-body', '.entry-body', '.article-body', '.content-area',
                    '.single-content', '.page-wrapper', '.container .content'
                ];
                
                const excludeSelectors = [
                    'header', 'footer', 'nav', '.navigation', '.menu', '.sidebar',
                    '.widget', '.footer', '.header', '.nav', '.breadcrumb', '.breadcrumbs',
                    '.related-posts', '.comments', '.comment', '.social-share', 
                    'script', 'style', 'noscript', '.advertisement', '.ads', '.banner'
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
            
            // Clean content extraction
            const cleanContent = contentArea.cloneNode(true);
            const excludeSelectors = [
                'header', 'footer', 'nav', '.navigation', '.menu', '.sidebar',
                '.widget', '.advertisement', '.ads', '.banner', '.popup', '.modal',
                '.overlay', '.cookie', '.newsletter-signup', '.share-buttons', 
                '.social-buttons', '.tags', '.categories', '.author-bio', '.comments'
            ];
            
            excludeSelectors.forEach(selector => {
                cleanContent.querySelectorAll(selector).forEach(el => el.remove());
            });
            
            let mainText = cleanContent.innerText || cleanContent.textContent || '';
            mainText = mainText.replace(/\s+/g, ' ').trim();
            
            // Word count analysis
            const words = mainText.split(/[\s\n\r\t]+/).filter(word => {
                const cleanWord = word.replace(/[^\w\u0590-\u05FF]/g, '');
                return cleanWord.length >= 2 && /[a-zA-Z\u0590-\u05FF]/.test(cleanWord);
            });
            
            // Image analysis
            const allImages = Array.from(document.querySelectorAll('img'));
            const contentImages = allImages.filter(img => contentArea.contains(img));
            
            const imageAnalysis = {
                total: contentImages.length,
                withAlt: contentImages.filter(img => img.getAttribute('alt') && img.getAttribute('alt').trim() !== '').length,
                withoutAlt: contentImages.filter(img => !img.getAttribute('alt') || img.getAttribute('alt').trim() === '').length,
                withTitle: contentImages.filter(img => img.getAttribute('title')).length,
                withLazyLoading: contentImages.filter(img => img.getAttribute('loading') === 'lazy').length,
                oversized: contentImages.filter(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 1920 || rect.height > 1080;
                }).length
            };
            
            // Link analysis
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            const internalLinks = allLinks.filter(link => {
                const href = link.getAttribute('href');
                return href.startsWith('/') || href.startsWith(window.location.origin) || 
                       (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:'));
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
                withoutText: allLinks.filter(link => !link.textContent.trim()).length
            };
            
            // Form analysis
            const forms = Array.from(document.querySelectorAll('form'));
            const formAnalysis = {
                total: forms.length,
                withAction: forms.filter(form => form.getAttribute('action')).length,
                withMethod: forms.filter(form => form.getAttribute('method')).length,
                inputs: document.querySelectorAll('input').length,
                textareas: document.querySelectorAll('textarea').length,
                selects: document.querySelectorAll('select').length
            };
            
            // Social meta analysis
            const socialMeta = {
                openGraph: {},
                twitterCard: {}
            };
            
            document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
                const property = meta.getAttribute('property').replace('og:', '');
                socialMeta.openGraph[property] = meta.getAttribute('content');
            });
            
            document.querySelectorAll('meta[name^="twitter:"]').forEach(meta => {
                const name = meta.getAttribute('name').replace('twitter:', '');
                socialMeta.twitterCard[name] = meta.getAttribute('content');
            });
            
            // Basic SEO data
            const title = document.title;
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
            const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
            const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
            const lang = document.documentElement.lang || '';
            const charset = document.charset || '';
            
            // Headings analysis
            const headings = {
                h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
                h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()),
                h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()),
                h4: document.querySelectorAll('h4').length,
                h5: document.querySelectorAll('h5').length,
                h6: document.querySelectorAll('h6').length
            };
            
            // Technical SEO analysis
            const technicalSEO = {
                hasHTTPS: window.location.protocol === 'https:',
                hasCanonical: !!canonical,
                hasViewport: !!viewport,
                isResponsive: !!viewport && viewport.includes('width=device-width'),
                hasLang: !!lang,
                hasCharset: !!charset,
                hasSitemap: !!document.querySelector('link[rel="sitemap"]'),
                amp: !!document.querySelector('html[amp]') || !!document.querySelector('html[⚡]')
            };
            
            // Page speed indicators
            const pageSpeedIndicators = {
                totalStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
                totalScripts: document.querySelectorAll('script[src]').length,
                inlineStyles: document.querySelectorAll('style').length,
                inlineScripts: document.querySelectorAll('script:not([src])').length,
                totalImages: allImages.length,
                hasMinifiedCSS: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link => 
                    link.getAttribute('href')?.includes('.min.css')),
                hasMinifiedJS: Array.from(document.querySelectorAll('script[src]')).some(script => 
                    script.getAttribute('src')?.includes('.min.js'))
            };
            
            return {
                seoData: {
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
                    imageAnalysis,
                    linkAnalysis,
                    formAnalysis,
                    socialMeta,
                    technicalSEO,
                    pageSpeedIndicators,
                    wordCount: words.length,
                    readingTime: Math.ceil(words.length / 200),
                    url: window.location.href,
                    urlLength: window.location.href.length,
                    hasParameters: window.location.search.length > 0,
                    hasFragment: window.location.hash.length > 0
                },
                mainText,
                contentData: {
                    text: mainText,
                    wordCount: words.length,
                    contentAreaTag: contentArea.tagName,
                    contentAreaClass: contentArea.className,
                    contentAreaId: contentArea.id
                }
            };
        });

        // Extract markdown content
        const markdownContent = await page.evaluate(() => {
            const contentSelectors = [
                'main', 'article', '[role="main"]', '#main', '#content', '.main',
                '.content', '.post-content', '.entry-content', '.article-content'
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
            
            let markdown = '';
            const elements = contentArea.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote');
            
            elements.forEach(el => {
                const tagName = el.tagName.toLowerCase();
                const text = el.innerText?.trim() || '';
                
                if (!text) return;
                
                // Skip navigation elements
                if (el.closest('nav, .navigation, .menu, .sidebar, .widget, .comments, .breadcrumb')) {
                    return;
                }
                
                switch (tagName) {
                    case 'h1':
                        markdown += `# ${text}\n\n`;
                        break;
                    case 'h2':
                        markdown += `## ${text}\n\n`;
                        break;
                    case 'h3':
                        markdown += `### ${text}\n\n`;
                        break;
                    case 'h4':
                        markdown += `#### ${text}\n\n`;
                        break;
                    case 'h5':
                        markdown += `##### ${text}\n\n`;
                        break;
                    case 'h6':
                        markdown += `###### ${text}\n\n`;
                        break;
                    case 'p':
                        markdown += `${text}\n\n`;
                        break;
                    case 'ul':
                        const listItems = Array.from(el.querySelectorAll('li'));
                        listItems.forEach(li => {
                            const itemText = li.innerText?.trim();
                            if (itemText) {
                                markdown += `- ${itemText}\n`;
                            }
                        });
                        markdown += '\n';
                        break;
                    case 'ol':
                        const orderedItems = Array.from(el.querySelectorAll('li'));
                        orderedItems.forEach((li, index) => {
                            const itemText = li.innerText?.trim();
                            if (itemText) {
                                markdown += `${index + 1}. ${itemText}\n`;
                            }
                        });
                        markdown += '\n';
                        break;
                    case 'blockquote':
                        const lines = text.split('\n');
                        lines.forEach(line => {
                            if (line.trim()) {
                                markdown += `> ${line.trim()}\n`;
                            }
                        });
                        markdown += '\n';
                        break;
                }
            });
            
            return markdown.replace(/\n{3,}/g, '\n\n').trim();
        });

        // Analyze content with enhanced meta tags
        const readabilityAnalysis = calculateFleschScore(mainText);
        const keywordDensity = analyzeKeywordDensity(mainText);
        const contentFreshness = analyzeContentFreshness(mainText, metaTags);
        const contentLinks = await getContentInternalLinks(page);
        const clickDepth = calculateClickDepth(url);
        
        // Calculate SEO score
        const enhancedData = {
            statusChecks: {
                is_4xx_code: statusCode >= 400 && statusCode < 500,
                is_5xx_code: statusCode >= 500
            },
            readabilityScore: readabilityAnalysis.score,
            contentFreshness: contentFreshness.category,
            clickDepth
        };
        
        const seoScore = calculateEnhancedSEOScore(seoData, performanceMetrics, enhancedData);
        
        // Extract schemas
        const allSchemas = await extractAllSchemas(page);
        
        // Handle screenshot
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
                console.log(`📸 Screenshot saved: ${screenshotUrl}`);
                
                cleanupOldScreenshots();
                
            } catch (screenshotError) {
                console.error('Screenshot error:', screenshotError);
            }
        }

        // Build comprehensive response
        const apiResponse = {
            success: true,
            data: {
                url,
                timestamp: new Date().toISOString(),
                statusCode,
                statusChecks: {
                    is_4xx_code: statusCode >= 400 && statusCode < 500,
                    is_5xx_code: statusCode >= 500,
                    is_redirect: statusCode >= 300 && statusCode < 400,
                    ...seoData.technicalSEO
                },
                performanceMetrics,
                seoData,
                seoScore,
                readabilityAnalysis,
                keywordDensity,
                contentFreshness,
                contentLinks,
                clickDepth,
                markdownContent,
                screenshot: screenshotUrl,
                allSchemas,
                debug: {
                    metaTagsExtracted: Object.keys(metaTags).length,
                    contentExtractionMethod: 'advanced-content-area-detection',
                    readabilityLanguage: readabilityAnalysis.details ? 'detected' : 'unknown',
                    keywordLanguage: keywordDensity.language,
                    freshnessAnalysis: {
                        datesFound: contentFreshness.dates ? contentFreshness.dates.length : 0,
                        sourcesUsed: contentFreshness.sources,
                        latestDate: contentFreshness.latestDate
                    },
                    contentData: contentData
                }
            }
        };

        console.log(`✅ SEO audit completed successfully for ${url}`);
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

// Quick check endpoint for structured data
app.post('/api/extract/quick-check', async (req, res) => {
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
        const timeout = 30000;
        const waitUntil = 'domcontentloaded';
        page.setDefaultTimeout(timeout);
        page.setDefaultNavigationTimeout(timeout);
        
        await page.goto(url, { waitUntil, timeout });
        
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
                                const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
                                types.forEach(type => {
                                    if (!results.schemaTypes.includes(type)) {
                                        results.schemaTypes.push(type);
                                    }
                                });
                            }
                            
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
            results.hasOpenGraph = document.querySelectorAll('meta[property^="og:"]').length > 0;
            
            // Check Twitter Card
            results.hasTwitterCard = document.querySelectorAll('meta[name^="twitter:"]').length > 0;
            
            return results;
        });
        
        // Calculate structured data score
        let structuredDataScore = 0;
        if (quickCheckData.hasJsonLD) structuredDataScore += 40;
        if (quickCheckData.hasMicrodata) structuredDataScore += 20;
        if (quickCheckData.hasOpenGraph) structuredDataScore += 15;
        if (quickCheckData.hasTwitterCard) structuredDataScore += 10;
        if (quickCheckData.schemaTypes.length > 0) structuredDataScore += 15;
        
        structuredDataScore = Math.min(100, structuredDataScore);
        
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
            recommendation: structuredDataScore >= 80 ? 'Excellent structured data' : 
                           structuredDataScore >= 60 ? 'Good structured data' : 
                           'Structured data needs improvement'
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

// =========================================
// PAA API ENDPOINT - הוסף כאן!
// =========================================

app.post('/api/paa', async (req, res) => {
  console.log('🔍 PAA extraction started for:', req.body.query);
  
  const { query, language = 'en' } = req.body;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query parameter is required'
    });
  }

  const browser = globalBrowser || await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const startTime = Date.now();
  
  try {
    // Set language preference
    await page.setExtraHTTPHeaders({
      'Accept-Language': language === 'he' ? 'he-IL,he;q=0.9,en;q=0.8' : 'en-US,en;q=0.9'
    });

    // Set user agent to appear more like a regular browser
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const result = await extractPAA(page, query);
    
    res.json({
      success: result.success,
      data: result,
      metadata: {
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        language: language
      }
    });

  } catch (error) {
    console.error('PAA API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (page) await page.close();
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
            'POST /api/seo/audit',
            'POST /api/extract/quick-check',
            'POST /api/paa'
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
            console.log(`⚡ Quick Check: POST http://localhost:${PORT}/api/extract/quick-check`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// =========================================
// PAA EXTRACTION FUNCTION - הוסף כאן!
// =========================================

async function extractPAA(page, query) {
  try {
    console.log(`🔍 Extracting PAA for query: "${query}"`);
    
    // Navigate to Google search
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`, {
      waitUntil: 'networkidle'
    });

    // Wait for PAA section to potentially load
    await page.waitForTimeout(2000);

    // Multiple selectors - Google changes these frequently
    const paaSelectors = [
      '[data-initq]', // Current PAA container
      '.related-question-pair', // Alternative selector
      '[jsname="Cpkphb"]', // Another common selector
      '.g[data-initq]', // Expanded PAA items
      '.kno-fb-ctx', // Knowledge panel related questions
      '.UDZeY', // Another Google selector
      '[data-async-fc]' // Async content selector
    ];

    let paaQuestions = [];

    // Try each selector until we find PAA content
    for (const selector of paaSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`✅ Found PAA elements with selector: ${selector}`);
          
          for (const element of elements) {
            const questionText = await element.evaluate(el => {
              // Extract question text from various possible structures
              const questionSelectors = [
                '[role="button"] span',
                '.kno-ecr-pt',
                'h3',
                '[data-ved] span',
                '.RqBzHd',
                '.JlqpRe',
                'span'
              ];
              
              for (const qSelector of questionSelectors) {
                const qElement = el.querySelector(qSelector);
                if (qElement && qElement.textContent && qElement.textContent.trim().includes('?')) {
                  return qElement.textContent.trim();
                }
              }
              
              // Fallback to element text
              const text = el.textContent?.trim();
              if (text && text.includes('?')) {
                return text;
              }
              
              return null;
            });

            if (questionText && 
                questionText.length > 10 && 
                questionText.includes('?') &&
                !paaQuestions.includes(questionText)) {
              paaQuestions.push(questionText);
            }
          }
          
          if (paaQuestions.length > 0) break;
        }
      } catch (selectorError) {
        console.log(`⚠️ Selector ${selector} failed: ${selectorError.message}`);
        continue;
      }
    }

    // Fallback: Look for any elements containing question marks
    if (paaQuestions.length === 0) {
      console.log('🔄 Trying fallback question extraction...');
      
      const allTextElements = await page.$$eval('*', elements => {
        return elements
          .map(el => el.textContent?.trim())
          .filter(text => text && text.includes('?') && text.length > 10 && text.length < 200)
          .filter(text => !text.toLowerCase().includes('cookie'))
          .filter(text => !text.toLowerCase().includes('privacy'))
          .filter(text => !text.toLowerCase().includes('terms'))
          .slice(0, 10); // Limit to first 10 found
      });

      paaQuestions = [...new Set(allTextElements)]; // Remove duplicates
    }

    // Clean and filter questions
    paaQuestions = paaQuestions
      .filter(q => q && q.length > 10 && q.length < 200)
      .filter(q => q.includes('?'))
      .filter(q => !q.toLowerCase().includes('cookie'))
      .filter(q => !q.toLowerCase().includes('privacy'))
      .filter(q => !q.toLowerCase().includes('accept'))
      .slice(0, 8); // Max 8 questions

    console.log(`📊 Extracted ${paaQuestions.length} PAA questions`);
    
    return {
      query: query,
      questions: paaQuestions,
      timestamp: new Date().toISOString(),
      success: true,
      source: 'google_paa'
    };

  } catch (error) {
    console.error('❌ PAA extraction failed:', error);
    return {
      query: query,
      questions: [],
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    };
  }
}

// הוסף את ה-endpoint הזה זמנית אחרי ה-/api/paa endpoint
// זה יעזור לנו לגלות את הselectors הנכונים

app.post('/api/paa/debug', async (req, res) => {
  console.log('🔍 Debug PAA selectors started');
  
  const { query = "what is machine learning" } = req.body;
  
  const browser = globalBrowser || await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const startTime = Date.now();
  
  try {
    // Navigate to Google search
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`, {
      waitUntil: 'networkidle'
    });

    await page.waitForTimeout(3000); // Wait for PAA to load

    // Debug info
    const debugInfo = await page.evaluate(() => {
      const results = {
        pageTitle: document.title,
        pageUrl: window.location.href,
        allPossibleSelectors: {},
        elementsWithQuestions: [],
        allTextWithQuestions: []
      };

      // Test all possible selectors
      const testSelectors = [
        '[data-initq]',
        '.related-question-pair',
        '[jsname="Cpkphb"]',
        '.g[data-initq]',
        '.kno-fb-ctx',
        '.UDZeY',
        '.JlqpRe', 
        '.RqBzHd',
        '[data-async-fc]',
        '[role="heading"]',
        '[aria-expanded]',
        '[role="button"]',
        '.xpc',
        '.g-blk',
        '[data-ved]'
      ];

      testSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          results.allPossibleSelectors[selector] = {
            count: elements.length,
            hasText: elements.length > 0 ? Array.from(elements).some(el => el.textContent?.includes('?')) : false
          };
        } catch (e) {
          results.allPossibleSelectors[selector] = { error: e.message };
        }
      });

      // Find all elements that contain question marks
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el, index) => {
        const text = el.textContent?.trim();
        if (text && 
            text.includes('?') && 
            text.length > 10 && 
            text.length < 200 &&
            !text.includes('http') &&
            !text.includes('cookie')) {
          
          results.elementsWithQuestions.push({
            index,
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`)
          });
        }
      });

      // Get all text that looks like questions
      const bodyText = document.body.innerText || '';
      const questionPattern = /[^.!?]*\?[^.!?]*/g;
      const matches = bodyText.match(questionPattern);
      if (matches) {
        results.allTextWithQuestions = matches
          .map(q => q.trim())
          .filter(q => q.length > 10 && q.length < 200)
          .filter(q => !q.includes('http'))
          .filter(q => !q.toLowerCase().includes('cookie'))
          .slice(0, 10);
      }

      return results;
    });

    // Take a screenshot for manual inspection
    const screenshotPath = `/app/screenshots/debug_paa_${Date.now()}.png`;
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });

    res.json({
      success: true,
      query,
      debugInfo,
      screenshot: screenshotPath.replace('/app', ''),
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug PAA Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (page) await page.close();
  }
});

// הוסף גם route לראיית הscreenshot
app.get('/debug/screenshot/:filename', (req, res) => {
  const path = require('path');
  const screenshotPath = path.join('/app/screenshots', req.params.filename);
  res.sendFile(screenshotPath);
});

// Initialize server
startServer();
