/**
 * Schema Extractor Utilities
 * מודול משותף לחילוץ וניתוח structured data (JSON-LD, Microdata, RDFa)
 *
 * משמש את: seoService, schemaService, compareService
 */

/**
 * חילוץ JSON-LD schemas מדף
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} - מערך של schemas
 */
async function extractJsonLdSchemas(page) {
  return await page.evaluate(() => {
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
}

/**
 * חילוץ JSON-LD schemas (גרסה סינכרונית - לשימוש ב-page.evaluate)
 * @returns {Array} - מערך של schemas
 */
function extractJsonLdSchemasSync() {
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
}

/**
 * חילוץ סוגי schemas (@type) מתוך schemas
 * @param {Array} schemas - מערך של schema objects
 * @returns {Set} - סט של schema types
 */
function extractSchemaTypes(schemas) {
  const types = new Set();

  schemas.forEach(schema => {
    function extractTypesRecursive(obj) {
      if (!obj) return;

      // חילוץ @type
      if (obj['@type']) {
        if (Array.isArray(obj['@type'])) {
          obj['@type'].forEach(type => types.add(type));
        } else {
          types.add(obj['@type']);
        }
      }

      // חילוץ מתוך @graph
      if (obj['@graph'] && Array.isArray(obj['@graph'])) {
        obj['@graph'].forEach(item => extractTypesRecursive(item));
      }

      // חילוץ רקורסיבי מתוך nested objects
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        Object.values(obj).forEach(value => {
          if (typeof value === 'object' && value !== null) {
            extractTypesRecursive(value);
          }
        });
      }
    }

    extractTypesRecursive(schema);
  });

  return types;
}

/**
 * ספירת JSON-LD schemas בעמוד (גרסה מהירה - ללא parsing)
 * @returns {number} - מספר ה-schemas
 */
function countJsonLdSchemas() {
  return document.querySelectorAll('script[type="application/ld+json"]').length;
}

/**
 * בדיקה אם קיים schema מסוג מסוים
 * @param {Array} schemas - מערך של schemas
 * @param {string} type - סוג ה-schema (e.g., 'Organization', 'Product')
 * @returns {boolean}
 */
function hasSchemaType(schemas, type) {
  const types = extractSchemaTypes(schemas);
  return types.has(type);
}

/**
 * מציאת כל ה-schemas מסוג מסוים
 * @param {Array} schemas - מערך של schemas
 * @param {string} type - סוג ה-schema
 * @returns {Array} - מערך של schemas מהסוג המבוקש
 */
function findSchemasByType(schemas, type) {
  const results = [];

  schemas.forEach(schema => {
    function findRecursive(obj) {
      if (!obj) return;

      const objType = obj['@type'];
      if (objType) {
        const types = Array.isArray(objType) ? objType : [objType];
        if (types.includes(type)) {
          results.push(obj);
        }
      }

      if (obj['@graph'] && Array.isArray(obj['@graph'])) {
        obj['@graph'].forEach(item => findRecursive(item));
      }
    }

    findRecursive(schema);
  });

  return results;
}

/**
 * חילוץ Microdata schemas
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>}
 */
async function extractMicrodataSchemas(page) {
  return await page.evaluate(() => {
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
}

/**
 * חילוץ RDFa schemas
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>}
 */
async function extractRdfaSchemas(page) {
  return await page.evaluate(() => {
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
}

/**
 * חילוץ כל ה-schemas (JSON-LD, Microdata, RDFa) בבת אחת
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} - { jsonld, microdata, rdfa, all, types }
 */
async function extractAllSchemas(page) {
  const [jsonld, microdata, rdfa] = await Promise.all([
    extractJsonLdSchemas(page),
    extractMicrodataSchemas(page),
    extractRdfaSchemas(page)
  ]);

  const all = [...jsonld, ...microdata, ...rdfa];
  const types = extractSchemaTypes(all);

  return {
    jsonld,
    microdata,
    rdfa,
    all,
    types: Array.from(types),
    counts: {
      jsonld: jsonld.length,
      microdata: microdata.length,
      rdfa: rdfa.length,
      total: all.length
    }
  };
}

module.exports = {
  // Async functions (for use with Playwright page)
  extractJsonLdSchemas,
  extractMicrodataSchemas,
  extractRdfaSchemas,
  extractAllSchemas,

  // Sync functions (for use inside page.evaluate)
  extractJsonLdSchemasSync,
  countJsonLdSchemas,

  // Analysis functions
  extractSchemaTypes,
  hasSchemaType,
  findSchemasByType
};
