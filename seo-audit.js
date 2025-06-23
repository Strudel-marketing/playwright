const puppeteer = require('puppeteer');

async function auditPage(url) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(() => {
    const title = document.title;
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
    const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
    const hTags = {
      h1: Array.from(document.querySelectorAll('h1')).map(h => h.innerText),
      h2: Array.from(document.querySelectorAll('h2')).map(h => h.innerText),
      h3: Array.from(document.querySelectorAll('h3')).map(h => h.innerText),
    };
    const internalLinks = Array.from(document.querySelectorAll('a')).filter(a => a.href.startsWith(location.origin)).map(a => a.href);
    const externalLinks = Array.from(document.querySelectorAll('a')).filter(a => !a.href.startsWith(location.origin)).map(a => a.href);
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      id: f.id || null,
      action: f.action || null,
      inputs: Array.from(f.querySelectorAll('input, textarea, select')).map(i => ({
        name: i.name || null,
        type: i.type || i.tagName.toLowerCase(),
        placeholder: i.placeholder || ''
      }))
    }));

    return {
      title,
      metaDescription,
      canonical,
      ogImage,
      hTags,
      internalLinks,
      externalLinks,
      internalLinksCount: internalLinks.length,
      externalLinksCount: externalLinks.length,
      forms
    };
  });

  await browser.close();
  return result;
}

module.exports = { auditPage };
