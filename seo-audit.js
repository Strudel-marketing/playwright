const puppeteer = require('puppeteer');
const extractSchemas = require('./helpers/extractSchemas');
const getLinks = require('./helpers/getLinks');
const cleanHTML = require('./helpers/cleanHTML');

module.exports = async function runSeoAudit(url, options = {}) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: options.waitUntil || 'domcontentloaded', timeout: options.timeout || 20000 });

    const title = await page.title();
    const content = await page.content();
    const cleanHtml = cleanHTML(content);
    const markdown = cleanHtml; // simplified

    const schemasFound = await extractSchemas(page);
    const links = await getLinks(page);

    await browser.close();

    return {
        url,
        seo: {
            title,
            hTags: {}, // to be filled with header tags
            schemasFound,
            internalLinks: links.internal,
            externalLinks: links.external,
        },
        cleanHtml,
        markdown,
        performance: {
            loadTime: 1234
        }
    };
};