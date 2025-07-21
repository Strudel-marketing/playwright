/**
 * Schema Service Module
 * 
 * מספק פונקציונליות לחילוץ סכמות מובנות מדפי אינטרנט
 */

const browserPool = require('../../utils/browserPool');

/**
 * חילוץ סכמות JSON-LD מדף אינטרנט
 * @param {string} url - כתובת האתר לחילוץ
 * @param {Object} options - אפשרויות נוספות
 * @returns {Promise<Object>} - תוצאות החילוץ
 */
async function extractSchema(url, options = {}) {
    console.log(`🔍 Extracting schema from: ${url}`);
    
    const { page, context, id } = await browserPool.getPage();
    
    try {
        await page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        // חילוץ סכמות JSON-LD
        const jsonldSchemas = await page.evaluate(() => {
            const schemas = [];
            const scriptElements = document.querySelectorAll('script[type="application/ld+json"]');
            
            scriptElements.forEach(script => {
                try {
                    const content = script.textContent;
                    if (content && content.trim()) {
                        const data = JSON.parse(content);
                        schemas.push(data);
                    }
                } catch (e) {
                    // דילוג על JSON לא תקין
                }
            });
            
            return schemas;
        });
        
        // חילוץ סכמות מיקרודאטה
        const microdataSchemas = await page.evaluate(() => {
            function extractMicrodata(element, baseType = null) {
                const result = {};
                const type = element.getAttribute('itemtype') || baseType;
                
                if (type) {
                    result['@type'] = type.split('/').pop();
                }
                
                const props = element.querySelectorAll('[itemprop]');
                props.forEach(prop => {
                    const name = prop.getAttribute('itemprop');
                    let value;
                    
                    if (prop.hasAttribute('itemscope')) {
                        value = extractMicrodata(prop, type);
                    } else if (prop.tagName === 'META') {
                        value = prop.getAttribute('content');
                    } else if (prop.tagName === 'IMG') {
                        value = prop.getAttribute('src');
                    } else if (prop.tagName === 'A') {
                        value = prop.getAttribute('href');
                    } else if (prop.tagName === 'TIME') {
                        value = prop.getAttribute('datetime') || prop.textContent;
                    } else {
                        value = prop.textContent.trim();
                    }
                    
                    if (result[name]) {
                        if (!Array.isArray(result[name])) {
                            result[name] = [result[name]];
                        }
                        result[name].push(value);
                    } else {
                        result[name] = value;
                    }
                });
                
                return result;
            }
            
            const schemas = [];
            const elements = document.querySelectorAll('[itemscope]');
            elements.forEach(element => {
                if (!element.closest('[itemscope] [itemscope]')) {
                    schemas.push(extractMicrodata(element));
                }
            });
            
            return schemas;
        });
        
        // חילוץ סכמות RDFa
        const rdfaSchemas = await page.evaluate(() => {
            function extractRDFa(element) {
                const result = {};
                const type = element.getAttribute('typeof');
                
                if (type) {
                    result['@type'] = type;
                }
                
                const props = element.querySelectorAll('[property]');
                props.forEach(prop => {
                    const name = prop.getAttribute('property').split(':').pop();
                    let value;
                    
                    if (prop.hasAttribute('typeof')) {
                        value = extractRDFa(prop);
                    } else if (prop.hasAttribute('content')) {
                        value = prop.getAttribute('content');
                    } else if (prop.tagName === 'IMG') {
                        value = prop.getAttribute('src');
                    } else if (prop.tagName === 'A') {
                        value = prop.getAttribute('href');
                    } else {
                        value = prop.textContent.trim();
                    }
                    
                    if (result[name]) {
                        if (!Array.isArray(result[name])) {
                            result[name] = [result[name]];
                        }
                        result[name].push(value);
                    } else {
                        result[name] = value;
                    }
                });
                
                return result;
            }
            
            const schemas = [];
            const elements = document.querySelectorAll('[typeof]');
            elements.forEach(element => {
                if (!element.closest('[typeof] [typeof]')) {
                    schemas.push(extractRDFa(element));
                }
            });
            
            return schemas;
        });
        
        // ניתוח סוגי הסכמות
        const schemaTypes = new Set();
        
        // ניתוח סוגי JSON-LD
        jsonldSchemas.forEach(schema => {
            function extractTypes(obj) {
                if (!obj) return;
                
                if (obj['@type']) {
                    if (Array.isArray(obj['@type'])) {
                        obj['@type'].forEach(type => schemaTypes.add(type));
                    } else {
                        schemaTypes.add(obj['@type']);
                    }
                }
                
                if (Array.isArray(obj)) {
                    obj.forEach(item => extractTypes(item));
                } else if (typeof obj === 'object') {
                    Object.values(obj).forEach(value => {
                        if (Array.isArray(value)) {
                            value.forEach(item => extractTypes(item));
                        } else if (typeof value === 'object') {
                            extractTypes(value);
                        }
                    });
                }
            }
            
            extractTypes(schema);
        });
        
        // ניתוח סוגי מיקרודאטה
        microdataSchemas.forEach(schema => {
            if (schema['@type']) {
                schemaTypes.add(schema['@type']);
            }
        });
        
        // ניתוח סוגי RDFa
        rdfaSchemas.forEach(schema => {
            if (schema['@type']) {
                schemaTypes.add(schema['@type']);
            }
        });
        
        // הרכבת תוצאות החילוץ
        const results = {
            url,
            timestamp: new Date().toISOString(),
            schemas: {
                jsonld: jsonldSchemas,
                microdata: microdataSchemas,
                rdfa: rdfaSchemas
            },
            types: Array.from(schemaTypes),
            counts: {
                jsonld: jsonldSchemas.length,
                microdata: microdataSchemas.length,
                rdfa: rdfaSchemas.length,
                total: jsonldSchemas.length + microdataSchemas.length + rdfaSchemas.length
            }
        };
        
        return results;
    } catch (error) {
        console.error(`❌ Error extracting schema from ${url}:`, error);
        throw error;
    } finally {
        await browserPool.releasePage(id);
    }
}

/**
 * בדיקה מהירה של סכמות באתר
 * @param {string} url - כתובת האתר לבדיקה
 * @returns {Promise<Object>} - תוצאות הבדיקה המהירה
 */
async function quickCheck(url) {
    console.log(`⚡ Quick schema check for: ${url}`);
    
    const { page, context, id } = await browserPool.getPage();
    
    try {
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        
        const quickResults = await page.evaluate(() => {
            // בדיקת JSON-LD
            const jsonldElements = document.querySelectorAll('script[type="application/ld+json"]');
            const jsonldCount = jsonldElements.length;
            
            // בדיקת מיקרודאטה
            const microdataElements = document.querySelectorAll('[itemscope]');
            const microdataCount = microdataElements.length;
            
            // בדיקת RDFa
            const rdfaElements = document.querySelectorAll('[typeof]');
            const rdfaCount = rdfaElements.length;
            
            // בדיקת סוגי סכמות נפוצים
            const hasProduct = document.querySelector('[itemtype*="Product"]') !== null || 
                               Array.from(jsonldElements).some(el => el.textContent.includes('"@type":"Product"'));
                               
            const hasArticle = document.querySelector('[itemtype*="Article"]') !== null || 
                               Array.from(jsonldElements).some(el => el.textContent.includes('"@type":"Article"'));
                               
            const hasOrganization = document.querySelector('[itemtype*="Organization"]') !== null || 
                                   Array.from(jsonldElements).some(el => el.textContent.includes('"@type":"Organization"'));
                                   
            const hasWebPage = document.querySelector('[itemtype*="WebPage"]') !== null || 
                              Array.from(jsonldElements).some(el => el.textContent.includes('"@type":"WebPage"'));
            
            return {
                counts: {
                    jsonld: jsonldCount,
                    microdata: microdataCount,
                    rdfa: rdfaCount,
                    total: jsonldCount + microdataCount + rdfaCount
                },
                commonTypes: {
                    hasProduct,
                    hasArticle,
                    hasOrganization,
                    hasWebPage
                }
            };
        });
        
        return {
            url,
            timestamp: new Date().toISOString(),
            results: quickResults
        };
    } catch (error) {
        console.error(`❌ Error during quick schema check for ${url}:`, error);
        throw error;
    } finally {
        await browserPool.releasePage(id);
    }
}

module.exports = {
    extractSchema,
    quickCheck
};
