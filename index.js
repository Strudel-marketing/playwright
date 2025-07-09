// Schema Extraction Endpoint
app.post('/api/extract/schema', async (req, res) => {
    const { url, options = {} } = req.body;
    
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
        
        const extractedData = await extractAllSchemas(page, options);
        
        res.json({
            success: true,
            url: url,
            timestamp: new Date().toISOString(),
            data: extractedData
        });
        
    } catch (error) {
        console.error('Schema extraction error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: url
        });
    } finally {
        await page.close();
        if (!globalBrowser) {
            await browser.close();
        }
    }
});

// Extract all schema types from page
async function extractAllSchemas(page, options = {}) {
    const results = {};
    
    // 1. JSON-LD Structured Data
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
    
    // 2. Microdata
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
    
    // 3. Open Graph
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
    
    // 4. Twitter Cards
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
    
    // 5. Basic SEO Meta
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

// Quick Schema Check
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
        await page.goto(url, { waitUntil: 'networkidle' });
        
    const quickCheck = await page.evaluate(() => {
    const hasJsonLD = document.querySelectorAll('script[type="application/ld+json"]').length > 0;
    const hasMicrodata = document.querySelectorAll('[itemscope]').length > 0;
    const hasOpenGraph = document.querySelectorAll('meta[property^="og:"]').length > 0;
    const hasTwitterCard = document.querySelectorAll('meta[name^="twitter:"]').length > 0;
    const hasSchemaTypes = [];
    
    // Check for common schema types - improved version
    const jsonLDScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    jsonLDScripts.forEach(script => {
        try {
            const data = JSON.parse(script.textContent);
        
            // Function to extract types recursively
            function extractTypes(obj) {
                if (!obj) return;
                
                if (typeof obj === 'object') {
                    if (obj['@type']) {
                        if (Array.isArray(obj['@type'])) {
                            hasSchemaTypes.push(...obj['@type']);
                        } else {
                            hasSchemaTypes.push(obj['@type']);
                        }
                    }
                    
                    // Check all properties recursively
                    Object.values(obj).forEach(value => {
                        if (Array.isArray(value)) {
                            value.forEach(item => extractTypes(item));
                        } else if (typeof value === 'object') {
                            extractTypes(value);
                        }
                    });
            }
        }
        
        if (Array.isArray(data)) {
            data.forEach(item => extractTypes(item));
        } else {
            extractTypes(data);
        }
        
    } catch (e) {
        console.log('Error parsing JSON-LD:', e);
    }
});
    
    return {
        hasStructuredData: hasJsonLD || hasMicrodata,
        hasJsonLD,
        hasMicrodata,
        hasOpenGraph,
        hasTwitterCard,
        schemaTypes: [...new Set(hasSchemaTypes)],
        structuredDataScore: (hasJsonLD ? 40 : 0) + 
                          (hasMicrodata ? 30 : 0) + 
                          (hasOpenGraph ? 20 : 0) + 
                          (hasTwitterCard ? 10 : 0)
    };
});

res.json({
    success: true,
    url: url,
    quickCheck: quickCheck,
    recommendation: quickCheck.structuredDataScore < 50 ? 
        'Consider adding more structured data markup' : 
        'Good structured data implementation'
});

} catch (error) {
    console.error('Quick check error:', error);
    res.status(500).json({
        success: false,
        error: error.message
    });
} finally {
    await page.close();
    if (!globalBrowser) {
        await browser.close();
    }
}
});     

// Screenshot endpoint
app.post('/api/screenshot', async (req, res) => {
    const { url, options = {} } = req.body;
    
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
        // Set viewport if specified
        if (options.viewport) {
            await page.setViewportSize(options.viewport);
        }
        
        await page.goto(url, { waitUntil: 'networkidle' });
        
        // Block popups if requested
        if (options.blockPopups) {
            await page.addInitScript(() => {
                window.alert = () => {};
                window.confirm = () => true;
                window.prompt = () => '';
            });
        }
        
        const filename = `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
            const screenshotOptions = {
            path: `/app/screenshots/${filename}`,
            fullPage: options.fullPage !== false,
            ...options
        };
        if (options.selector) {
            const element = await page.$(options.selector);
            if (element) {
                await element.screenshot(screenshotOptions);
            } else {
                throw new Error(`Element with selector "${options.selector}" not found`);
            }
        } else {
            await page.screenshot(screenshotOptions);
        }
        
        res.json({
            success: true,
            result: {
                filename: filename,
                url: `https://playwright.strudel.marketing/screenshots/${filename}`,
                localPath: screenshotOptions.path,
                originalUrl: url,
                options: options,
                expiresIn: '7 days'
            }
        });
        
    } catch (error) {
        console.error('Screenshot error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        await page.close();
        if (!globalBrowser) {
            await browser.close();
        }
    }
});

// Cleanup old screenshots (older than 7 days)
function cleanupOldScreenshots() {
    const fs = require('fs');
    const path = require('path');
    const screenshotsDir = '/app/screenshots';
    
    try {
        if (fs.existsSync(screenshotsDir)) {
            const files = fs.readdirSync(screenshotsDir);
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            
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

// Advanced Schema Validation Endpoint
app.post('/api/validate/schema', async (req, res) => {
    const { url, validateAll = true } = req.body;
    
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
        
        // Extract all schemas
        const extractedData = await extractAllSchemas(page);
        
        const validationResults = {
            url: url,
            timestamp: new Date().toISOString(),
            overallScore: 0,
            schemasFound: extractedData.jsonLD.length + extractedData.microdata.length,
            schemas: [],
            summary: {
                totalSchemas: 0,
                validSchemas: 0,
                errorsFound: 0,
                warningsFound: 0
            }
        };
        
        // Validate JSON-LD schemas
        if (extractedData.jsonLD && extractedData.jsonLD.length > 0) {
            for (const schema of extractedData.jsonLD) {
                if (schema['@type']) {
                    const validation = schemaValidator.validateSchema(schema);
                    
                    validationResults.schemas.push({
                        type: schema['@type'],
                        format: 'JSON-LD',
                        valid: validation.valid,
                        score: validation.score,
                        completeness: validation.completeness,
                        authorityScore: validation.authorityScore || 0,
                        errors: validation.errors,
                        warnings: validation.warnings,
                        recommendations: validation.recommendations,
                        schema: validateAll ? schema : undefined
                    });
                    
                    validationResults.summary.totalSchemas++;
                    if (validation.valid) validationResults.summary.validSchemas++;
                    validationResults.summary.errorsFound += validation.errors.length;
                    validationResults.summary.warningsFound += validation.warnings.length;
                }
            }
        }
        
        // Basic validation for microdata
        if (extractedData.microdata && extractedData.microdata.length > 0) {
            for (const microdata of extractedData.microdata) {
                if (microdata.type) {
                    const schemaType = microdata.type.split('/').pop();
                    const convertedSchema = {
                        '@context': 'https://schema.org',
                        '@type': schemaType,
                        ...microdata.properties
                    };
                    
                    const validation = schemaValidator.validateSchema(convertedSchema);
                    
                    validationResults.schemas.push({
                        type: schemaType,
                        format: 'Microdata',
                        valid: validation.valid,
                        score: validation.score,
                        completeness: validation.completeness,
                        authorityScore: validation.authorityScore || 0,
                        errors: validation.errors,
                        warnings: validation.warnings,
                        recommendations: validation.recommendations,
                        schema: validateAll ? convertedSchema : undefined
                    });
                    
                    validationResults.summary.totalSchemas++;
                    if (validation.valid) validationResults.summary.validSchemas++;
                    validationResults.summary.errorsFound += validation.errors.length;
                    validationResults.summary.warningsFound += validation.warnings.length;
                }
            }
        }
        
        // Calculate overall score
        if (validationResults.schemas.length > 0) {
            const avgScore = validationResults.schemas.reduce((sum, schema) => sum + schema.score, 0) / validationResults.schemas.length;
            validationResults.overallScore = Math.round(avgScore);
        }
        
        // Add general recommendations
        validationResults.generalRecommendations = [];
        
        if (validationResults.summary.totalSchemas === 0) {
            validationResults.generalRecommendations.push('No structured data found. Consider adding Schema.org markup for better SEO.');
        } else if (validationResults.summary.validSchemas < validationResults.summary.totalSchemas) {
            validationResults.generalRecommendations.push('Some schemas have validation errors. Fix them for better search engine understanding.');
        }
        
        if (Object.keys(extractedData.openGraph).length === 0) {
            validationResults.generalRecommendations.push('Add Open Graph meta tags for better social media sharing.');
        }
        
        if (Object.keys(extractedData.twitterCard).length === 0) {
            validationResults.generalRecommendations.push('Add Twitter Card meta tags for better Twitter sharing.');
        }
        
        res.json({
            success: true,
            result: validationResults
        });
        
    } catch (error) {
        console.error('Schema validation error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: url
        });
    } finally {
        await page.close();
        if (!globalBrowser) {
            await browser.close();
        }
    }
});

// Run cleanup every 24 hours
setInterval(cleanupOldScreenshots, 24 * 60 * 60 * 1000);

// Initialize browser on startup
initBrowser();

// Clean up old screenshots on startup
cleanupOldScreenshots();

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Playwright Universal Automation API running on port ${PORT}`);
    console.log(`📊 Available endpoints:`);
    console.log(`   GET  /health - Service health check`);
    console.log(`   POST /api/seo/audit - Enhanced SEO analysis with readability, keywords & freshness`);
    console.log(`   POST /api/extract/schema - Schema extraction`);
    console.log(`   POST /api/extract/quick-check - Quick structured data check`);
    console.log(`   POST /api/screenshot - Advanced screenshots`);
    console.log(`   POST /api/validate/schema - Schema validation`);
});

// Cleanup on exit
process.on('SIGTERM', async () => {
    if (globalBrowser) {
        await globalBrowser.close();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    if (globalBrowser) {
        await globalBrowser.close();
    }
    process.exit(0);
});const express = require('express');
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

// פונקציה לחישוב Flesch Reading Score
function calculateFleschScore(text, language = 'english') {
    if (!text || text.trim().length === 0) {
        return { score: 0, level: 'unknown', error: 'No text provided' };
    }

    // ניקוי הטקסט
    const cleanText = text.replace(/[^\u0590-\u05FFa-zA-Z0-9\s.,!?;:()]/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();

    // ספירת משפטים
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;

    if (sentenceCount === 0) {
        return { score: 0, level: 'unknown', error: 'No sentences found' };
    }

    // ספירת מילים
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount === 0) {
        return { score: 0, level: 'unknown', error: 'No words found' };
    }

    // ספירת הברות
    let totalSyllables = 0;
    words.forEach(word => {
        totalSyllables += countSyllables(word, language);
    });

    // חישוב Flesch Score
    const avgSentenceLength = wordCount / sentenceCount;
    const avgSyllablesPerWord = totalSyllables / wordCount;
    
    let score;
    if (language === 'hebrew') {
        // נוסחה מותאמת לעברית (פחות קפדנית)
        score = 206.835 - (1.3 * avgSentenceLength) - (60 * avgSyllablesPerWord);
    } else {
        // נוסחה סטנדרטית לאנגלית
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

// פונקציה לספירת הברות
function countSyllables(word, language) {
    const cleanWord = word.toLowerCase().replace(/[^a-zA-Z\u0590-\u05FF]/g, '');
    
    if (cleanWord.length === 0) return 0;

    if (language === 'hebrew') {
        // תנועות בעברית
        const vowels = /[אהוייע]/g;
        const matches = cleanWord.match(vowels);
        return Math.max(1, matches ? matches.length : 1);
    } else {
        // הברות באנגלית
        const vowels = /[aeiouy]/g;
        let syllables = (cleanWord.match(vowels) || []).length;
        
        // כללים מיוחדים לאנגלית
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

// פונקציה לניתוח keyword density
function analyzeKeywordDensity(text) {
    if (!text || text.trim().length === 0) {
        return { topKeywords: [], totalWords: 0, error: 'No text provided' };
    }

    // זיהוי שפה בסיסי
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);
    
    // ניקוי הטקסט
    const cleanText = text.toLowerCase()
                         .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();

    // פיצול למילים
    const allWords = cleanText.split(/\s+/).filter(w => w.length > 1);
    
    // סינון מילות חיבור
    const stopWords = new Set([
        ...(hasHebrew ? STOP_WORDS.hebrew : []),
        ...(hasEnglish ? STOP_WORDS.english : [])
    ]);
    
    const filteredWords = allWords.filter(word => !stopWords.has(word));
    
    if (filteredWords.length === 0) {
        return { topKeywords: [], totalWords: allWords.length, error: 'No keywords after filtering' };
    }

    // ספירת רצפים
    const sequences = new Map();
    
    // רצפי 1-4 מילים
    for (let length = 1; length <= 4; length++) {
        for (let i = 0; i <= filteredWords.length - length; i++) {
            const sequence = filteredWords.slice(i, i + length).join(' ');
            sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
        }
    }

    // סינון רצפים שמופיעים לפחות 3 פעמים
    const validSequences = Array.from(sequences.entries())
        .filter(([sequence, count]) => count >= 3)
        .map(([sequence, count]) => ({
            keyword: sequence,
            count: count,
            density: Math.round((count / allWords.length) * 100 * 100) / 100, // אחוז עם 2 ספרות אחרי הנקודה
            wordCount: sequence.split(' ').length
        }))
        .sort((a, b) => b.density - a.density)
        .slice(0, 3); // Top 3

    return {
        topKeywords: validSequences,
        totalWords: allWords.length,
        filteredWords: filteredWords.length,
        language: hasHebrew && hasEnglish ? 'mixed' : hasHebrew ? 'hebrew' : 'english'
    };
}

// פונקציה לזיהוי תאריכים בתוכן
function analyzeContentFreshness(text, metaTags = {}) {
    const results = {
        dates: [],
        latestDate: null,
        daysSinceLatest: null,
        category: 'unknown',
        sources: []
    };

    // בדיקת meta tags תחילה
    const metaDateFields = [
        'article:published_time',
        'article:modified_time',
        'date',
        'datePublished',
        'dateModified',
        'lastmod'
    ];

    metaDateFields.forEach(field => {
        if (metaTags[field]) {
            const date = parseDate(metaTags[field]);
            if (date) {
                results.dates.push({ date, source: `meta:${field}`, text: metaTags[field] });
                results.sources.push('meta-tags');
            }
        }
    });

    // דפוסי תאריכים בטקסט
    const datePatterns = [
        // עברית
        /(?:פורסם|עודכן|כתב|נוצר|הועלה)\s*(?:ב[-:]?)?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(?:תאריך|מיום)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        
        // אנגלית
        /(?:published|updated|created|posted|written)\s*(?:on|at)?\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        /(?:date|on)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
        
        // פורמטים כלליים
        /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/g,
        /\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,
        
        // ISO dates
        /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/g,
        /\b(\d{4}-\d{2}-\d{2})\b/g
    ];

    datePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const dateStr = match[1] || match[0];
            const date = parseDate(dateStr);
            if (date && date.getFullYear() > 2000 && date <= new Date()) {
                results.dates.push({ 
                    date, 
                    source: 'content-text', 
                    text: match[0].trim(),
                    pattern: pattern.source
                });
                if (!results.sources.includes('content-text')) {
                    results.sources.push('content-text');
                }
            }
        }
    });

    // מציאת התאריך האחרון
    if (results.dates.length > 0) {
        results.dates.sort((a, b) => b.date - a.date);
        results.latestDate = results.dates[0].date;
        
        const now = new Date();
        const timeDiff = now - results.latestDate;
        results.daysSinceLatest = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        // קטגוריזציה
        if (results.daysSinceLatest <= 30) {
            results.category = 'fresh';
        } else if (results.daysSinceLatest <= 180) {
            results.category = 'recent';
        } else {
            results.category = 'old';
        }
    }

    return results;
}

// פונקציה לפירוס תאריכים
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    const cleanStr = dateStr.trim();
    
    // נסה פורמטים שונים
    const formats = [
        // ISO
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        /^\d{4}-\d{2}-\d{2}/,
        
        // DD/MM/YYYY או MM/DD/YYYY
        /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
        
        // YYYY/MM/DD
        /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/
    ];

    // נסה Date constructor רגיל תחילה
    let date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
        return date;
    }

    // נסה פורמטים ספציפיים
    for (const format of formats) {
        const match = cleanStr.match(format);
        if (match) {
            if (format.source.includes('4})[')) { // YYYY/MM/DD
                date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            } else { // DD/MM/YYYY - נניח DD/MM
                date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
            }
            
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    return null;
}

// פונקציה לעדכון הקישורים הפנימיים (רק מהתוכן)
async function getContentInternalLinks(page) {
    return await page.evaluate(() => {
        // selectors לתוכן ראשי
        const contentSelectors = [
            'main', 'article', '.content', '.post-content', '.entry-content',
            '.article-content', '.page-content', '#content', '.main-content'
        ];
        
        // selectors לא לכלול
        const excludeSelectors = [
            'header', 'footer', 'nav', '.navigation', '.menu', '.sidebar',
            '.widget', '.footer', '.header', '.nav', '.breadcrumb', '.breadcrumbs',
            '.related-posts', '.comments', '.comment', '.social-share'
        ];
        
        let contentArea = null;
        
        // מצא את אזור התוכן
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                contentArea = element;
                break;
            }
        }
        
        // אם לא מצאנו אזור תוכן ספציפי, השתמש ב-body אבל הוצא את האזורים שלא רוצים
        if (!contentArea) {
            contentArea = document.body;
        }
        
        // אסוף את כל הקישורים מאזור התוכן
        const allLinks = Array.from(contentArea.querySelectorAll('a[href]'));
        
        // סנן קישורים שנמצאים באזורים שלא רוצים
        const contentLinks = allLinks.filter(link => {
            // בדוק אם הקישור נמצא בתוך אלמנט שלא רוצים
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
        
        // אם זה root path
        if (pathname === '/' || pathname === '') {
            return 0;
        }
        
        // ספור את הסלאשים (minus 1 כי זה מתחיל בסלאש)
        const segments = pathname.split('/').filter(segment => segment.length > 0);
        return segments.length;
        
    } catch (error) {
        return null; // URL לא תקין
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
            'click-depth-analysis'
        ],
        timestamp: new Date().toISOString()
    });
});

// Enhanced SEO Audit Endpoint with all new features
app.post('/api/seo/audit', async (req, res) => {
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
        
        // Navigate to page and get response
        const response = await page.goto(url, { waitUntil: 'networkidle' });
        const loadTime = Date.now() - startTime;
        const statusCode = response.status();
        
        // בדיקות סטטוס קוד
        const statusChecks = {
            is_4xx_code: statusCode >= 400 && statusCode < 500,
            is_5xx_code: statusCode >= 500,
            is_redirect: statusCode >= 300 && statusCode < 400
        };
        
        // Get performance metrics
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
        
        // חילוץ תוכן ראשי לניתוחים החדשים
        const mainContent = await page.evaluate(() => {
            const contentSelectors = [
                'main', 'article', '.content', '.post-content', '.entry-content',
                '.article-content', '.page-content', '#content', '.main-content'
            ];
            
            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    return element.innerText || element.textContent || '';
                }
            }
            
            // fallback לכל הbody אבל נקי יותר
            const body = document.body;
            if (body) {
                // הסר script ו-style tags
                const clone = body.cloneNode(true);
                clone.querySelectorAll('script, style, nav, header, footer, .menu, .navigation').forEach(el => el.remove());
                return clone.innerText || clone.textContent || '';
            }
            
            return '';
        });

        // חילוץ meta tags
        const metaTags = await page.evaluate(() => {
            const tags = {};
            document.querySelectorAll('meta').forEach(meta => {
                const name = meta.getAttribute('name') || meta.getAttribute('property');
                const content = meta.getAttribute('content');
                if (name && content) {
                    tags[name] = content;
                }
            });
            return tags;
        });

        // ניתוחים חדשים
        const readabilityScore = calculateFleschScore(mainContent);
        const keywordDensity = analyzeKeywordDensity(mainContent);
        const contentFreshness = analyzeContentFreshness(mainContent, metaTags);
        const contentLinks = await getContentInternalLinks(page);
        const clickDepth = calculateClickDepth(url);
        
        // Comprehensive SEO analysis
        const seoData = await page.evaluate(() => {
            // Basic meta data
            const title = document.title;
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
            const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
            const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
            
            // Language and structure
            const lang = document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') || '';
            const charset = document.querySelector('meta[charset]')?.getAttribute('charset') || 
                           document.querySelector('meta[http-equiv="content-type"]')?.getAttribute('content') || '';
            
            // Headings analysis
            const headings = {
                h1: Array.from(document.querySelectorAll('h1')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h2: Array.from(document.querySelectorAll('h2')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h3: Array.from(document.querySelectorAll('h3')).map(h => ({ text: h.textContent.trim(), length: h.textContent.trim().length })),
                h4: document.querySelectorAll('h4').length,
                h5: document.querySelectorAll('h5').length,
                h6: document.querySelectorAll('h6').length
            };
            
            // Images analysis
            const images = Array.from(document.querySelectorAll('img'));
            const imageAnalysis = {
                total: images.length,
                withAlt: images.filter(img => img.getAttribute('alt')).length,
                withoutAlt: images.filter(img => !img.getAttribute('alt')).length,
                withTitle: images.filter(img => img.getAttribute('title')).length,
                withLazyLoading: images.filter(img => img.getAttribute('loading') === 'lazy').length,
                oversized: images.filter(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 1920 || rect.height > 1080;
                }).length
            };
            
            // Links analysis
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
                broken: [] // Would need additional checking
            };
            
            // Content analysis
            const textContent = document.body.textContent || '';
            const wordCount = textContent.trim().split(/\s+/).length;
            const readingTime = Math.ceil(wordCount / 200); // Average reading speed
            
            // Forms analysis
            const forms = Array.from(document.querySelectorAll('form'));
            const formAnalysis = {
                total: forms.length,
                withAction: forms.filter(form => form.getAttribute('action')).length,
                withMethod: forms.filter(form => form.getAttribute('method')).length,
                inputs: document.querySelectorAll('input').length,
                textareas: document.querySelectorAll('textarea').length,
                selects: document.querySelectorAll('select').length
            };
            
            // Social media meta
            const socialMeta = {
                openGraph: {},
                twitterCard: {},
                facebook: {}
            };
            
            // Open Graph
            document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
                const property = meta.getAttribute('property').replace('og:', '');
                socialMeta.openGraph[property] = meta.getAttribute('content');
            });
            
            // Twitter Cards
            document.querySelectorAll('meta[name^="twitter:"]').forEach(meta => {
                const name = meta.getAttribute('name').replace('twitter:', '');
                socialMeta.twitterCard[name] = meta.getAttribute('content');
            });
            
            // Schema.org structured data
            const structuredData = {
                jsonLD: [],
                microdata: [],
                hasStructuredData: false
            };
            
            // JSON-LD
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
            
            // Microdata
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
            
            // Technical SEO
            const technicalSEO = {
                hasHTTPS: window.location.protocol === 'https:',
                hasRobotsTxt: false, // Would need separate request
                hasSitemap: !!document.querySelector('link[rel="sitemap"]'),
                hasCanonical: !!canonical,
                hasViewport: !!viewport,
                isResponsive: !!viewport && viewport.includes('width=device-width'),
                hasCharset: !!charset,
                hasLang: !!lang,
                amp: !!document.querySelector('html[amp]') || !!document.querySelector('html[⚡]')
            };
            
            // Page speed indicators
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
            
            // Broken links detection (basic client-side check)
            const brokenLinks = [];
            const externalLinksToCheck = Array.from(document.querySelectorAll('a[href^="http"]')).slice(0, 10); // לבדוק רק 10 ראשונים
            
            return {
                // Basic SEO
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
                
                // Content structure
                headings,
                wordCount,
                readingTime,
                
                // Media
                imageAnalysis,
                
                // Links
                linkAnalysis,
                
                // Forms
                formAnalysis,
                
                // Social
                socialMeta,
                
                // Structured data
                structuredData,
                
                // Technical
                technicalSEO,
                
                // Performance indicators
                pageSpeedIndicators,
                
                // URL analysis
                url: window.location.href,
                urlLength: window.location.href.length,
                hasParameters: window.location.search.length > 0,
                hasFragment: window.location.hash.length > 0,
                
                // New checks added
                checks: {
                    no_h1_tag: document.querySelectorAll('h1').length === 0,
                    no_image_alt: document.querySelectorAll('img:not([alt]), img[alt=""]').length > 0,
                    broken_links: [] // Will be populated if we add link checking
                }
            };
        });
        
        // Calculate comprehensive SEO score with new factors
        const seoScore = calculateEnhancedSEOScore(seoData, performanceMetrics, {
            readabilityScore: readabilityScore.score,
            keywordDensity: keywordDensity.topKeywords.length > 0 ? keywordDensity.topKeywords[0].density : 0,
            contentFreshness: contentFreshness.category,
            statusChecks,
            clickDepth
        });
        
        const result = {
            url: url,
            timestamp: new Date().toISOString(),
            statusCode: statusCode,
            
            // Score and grades
            score: seoScore.total,
            grade: seoScore.grade,
            issues: seoScore.issues,
            recommendations: seoScore.recommendations,
            
            // Basic SEO data
            seoData: seoData,
            
            // Enhanced analyses
            readabilityScore: readabilityScore,
            keywordDensity: keywordDensity,
            contentFreshness: contentFreshness,
            contentLinks: contentLinks,
            clickDepth: clickDepth,
            
            // Status checks
            checks: {
                ...seoData.checks,
                ...statusChecks
            },
            
            // Performance
            performance: {
                ...performanceMetrics,
                loadTime: loadTime,
                scoreBreakdown: seoScore.breakdown
            }
        };
        
        // Add screenshot if requested
        if (includeScreenshot) {
            const screenshotPath = `/tmp/seo_audit_${Date.now()}.png`;
            await page.screenshot({ 
                path: screenshotPath, 
                fullPage: true,
                timeout: 30000
            });
            result.screenshot = `file://${screenshotPath}`;
        }
        
        res.json({
            success: true,
            result: result
        });
        
    } catch (error) {
        console.error('SEO audit error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            url: url
        });
    } finally {
        await page.close();
        if (!globalBrowser) {
            await browser.close();
        }
    }
});

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
    
    // Content Score (25 points) - reduced to make room for new factors
    let contentScore = 25;
    
    // Title optimization
    if (!seoData.title) {
        contentScore -= 6;
        issues.push('Missing page title');
        recommendations.push('Add a descriptive page title');
    } else if (seoData.titleLength < 30 || seoData.titleLength > 60) {
        contentScore -= 3;
        issues.push('Title length not optimal (30-60 chars)');
        recommendations.push('Optimize title length to 30-60 characters');
    }
    
    // Meta description
    if (!seoData.description) {
        contentScore -= 5;
        issues.push('Missing meta description');
        recommendations.push('Add a compelling meta description');
    } else if (seoData.descriptionLength < 120 || seoData.descriptionLength > 160) {
        contentScore -= 2;
        issues.push('Meta description length not optimal (120-160 chars)');
        recommendations.push('Optimize meta description to 120-160 characters');
    }
    
    // Headings structure
    if (seoData.headings.h1.length === 0) {
        contentScore -= 5;
        issues.push('Missing H1 tag');
        recommendations.push('Add a clear H1 heading that describes the page content');
    } else if (seoData.headings.h1.length > 1) {
        contentScore -= 2;
        issues.push('Multiple H1 tags found');
        recommendations.push('Use only one H1 tag per page');
    }
    
    // Content length
    if (seoData.wordCount < 300) {
        contentScore -= 3;
        issues.push('Content too short (less than 300 words)');
        recommendations.push('Add more valuable content (aim for 300+ words)');
    }
    
    // Images with alt text
    if (seoData.imageAnalysis.withoutAlt > 0) {
        const penalty = Math.min(4, seoData.imageAnalysis.withoutAlt);
        contentScore -= penalty;
        issues.push(`${seoData.imageAnalysis.withoutAlt} images missing alt text`);
        recommendations.push('Add descriptive alt text to all images');
    }
    
    breakdown.content = Math.max(0, contentScore);
    
    // Technical Score (20 points)
    let technicalScore = 20;
    
    // Status code checks
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
    
    // HTTPS
    if (!seoData.technicalSEO.hasHTTPS) {
        technicalScore -= 5;
        issues.push('Not using HTTPS');
        recommendations.push('Implement SSL certificate for security');
    }
    
    // Canonical URL
    if (!seoData.technicalSEO.hasCanonical) {
        technicalScore -= 2;
        issues.push('Missing canonical URL');
        recommendations.push('Add canonical URL to prevent duplicate content');
    }
    
    // Viewport meta tag
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
    
    // NEW: Readability Score (8 points)
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
    
    // NEW: Content Freshness Score (7 points)
    let freshnessScore = 7;
    
    if (enhancedData.contentFreshness === 'old') {
        freshnessScore -= 4;
        issues.push('Content appears to be old');
        recommendations.push('Update content with recent information');
    } else if (enhancedData.contentFreshness === 'fresh') {
        // Bonus for fresh content
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
