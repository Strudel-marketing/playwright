/**
 * Enhanced Schema Service Module
 * 
 * מספק פונקציונליות לחילוץ וניתוח סכמות מובנות מדפי אינטרנט
 */

const browserPool = require('../../utils/browserPool');

/**
 * חילוץ וניתוח סכמות JSON-LD מדף אינטרנט
 * @param {string} url - כתובת האתר לחילוץ
 * @param {Object} options - אפשרויות נוספות
 * @returns {Promise<Object>} - תוצאות החילוץ והניתוח
 */
async function extractSchema(url, options = {}) {
    console.log(`🔍 Extracting schema from: ${url}`);
    
    const { page, context, id } = await browserPool.getPage();
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    }
        
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
        
        // זיהוי Main Entity
        const mainEntity = findMainEntity(jsonldSchemas, url);
        
        // רשימת Supporting entities (מסנן types טכניים)
        const supportingTypes = Array.from(schemaTypes).filter(type => 
            type !== (mainEntity?.type) && 
            !['ListItem', 'SearchAction', 'EntryPoint', 'PropertyValueSpecification'].includes(type)
        );
        
        // בניית Overview string
        const mainPart = mainEntity ? `Main: ${mainEntity.type}` : 'Main: Unknown';
        const supportingPart = supportingTypes.length > 0 ? 
            `Supporting: ${supportingTypes.join(', ')}` : 'Supporting: None';
        const schemaOverview = `${mainPart} | ${supportingPart} (${schemaTypes.size} total)`;
        
        // הרכבת תוצאות מעודכנות
        const results = {
            url,
            timestamp: new Date().toISOString(),
            
            // ניתוח מובנה
            schema_overview: schemaOverview,
            raw_schema_data: JSON.stringify(jsonldSchemas, null, 2),
            
            // נתונים מפורטים
            main_entity: mainEntity ? {
                type: mainEntity.type,
                name: mainEntity.name,
                id: mainEntity.id
            } : null,
            
            supporting_entities: supportingTypes,
            
            // נתונים טכניים מלאים
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

/**
 * זיהוי Main Entity
 */
function findMainEntity(jsonldSchemas, url) {
    for (const schema of jsonldSchemas) {
        if (schema['@graph']) {
            for (const entity of schema['@graph']) {
                if (isMainEntity(entity, url)) {
                    return {
                        type: Array.isArray(entity['@type']) ? entity['@type'][0] : entity['@type'],
                        name: entity.name,
                        id: entity['@id']
                    };
                }
            }
        } else if (isMainEntity(schema, url)) {
            return {
                type: Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'],
                name: schema.name,
                id: schema['@id']
            };
        }
    }
    return null;
}

/**
 * בדיקה אם Entity הוא Main
 */
function isMainEntity(entity, url) {
    if (!entity['@type']) return false;
    
    // בדיקת URL match
    if (entity.url === url || entity['@id'] === url) return true;
    if (entity['@id'] && url.includes(entity['@id'].replace(/\/$/, ''))) return true;
    
    // בדיקת סוגים של Main Entity
    const types = Array.isArray(entity['@type']) ? entity['@type'] : [entity['@type']];
    const mainTypes = ['WebPage', 'CollectionPage', 'ItemPage', 'ProductPage', 'ArticlePage'];
    
    return types.some(type => mainTypes.includes(type));
}

module.exports = {
    extractSchema,    // שם הפונקציה נשאר אותו דבר
    quickCheck        // הפונקציה הקיימת
};
