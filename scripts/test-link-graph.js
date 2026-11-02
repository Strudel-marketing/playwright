// node scripts/test-link-graph.js
const assert = require('assert');
const Module = require('module');
const origLoad = Module._load;
Module._load = function (req, ...rest) { if (['playwright', 'playwright-core'].includes(req) || req.startsWith('@playwright')) return { chromium: {}, firefox: {}, webkit: {}, devices: {} }; return origLoad.call(this, req, ...rest); };
const { buildLinkGraph, detectOrphanPages } = require('../services/seo/siteAuditService');
const base = 'https://ex.com';
const nav = [`${base}/`, `${base}/menu-page`];
const pages = Array.from({ length: 20 }, (_, i) => ({
  url: `${base}/p${i}`,
  linkAnalysis: { allInternalUrls: [...nav, ...(i === 0 ? [`${base}/money`] : [])], internalUrls: i === 0 ? [`${base}/money`] : [] }
}));
pages.push({ url: `${base}/`, linkAnalysis: { allInternalUrls: [`${base}/menu-page`, `${base}/money`], internalUrls: [] } });
pages.push({ url: `${base}/menu-page`, linkAnalysis: { allInternalUrls: [], internalUrls: [] } });
pages.push({ url: `${base}/money`, linkAnalysis: { allInternalUrls: [], internalUrls: [] } });
pages.push({ url: `${base}/lonely`, linkAnalysis: { allInternalUrls: [], internalUrls: [] } });
const orphans = detectOrphanPages(pages, buildLinkGraph(pages), `${base}/`);
const byUrl = u => pages.find(p => p.url === `${base}${u}`);
assert.strictEqual(byUrl('/menu-page').inbound_links_count, 21);
assert.strictEqual(byUrl('/menu-page').linked_from.length, 21);
assert.strictEqual(byUrl('/menu-page').is_orphan_page, false);
assert.strictEqual(byUrl('/menu-page').is_sitewide_linked, true);
assert.strictEqual(byUrl('/menu-page').content_inbound_count, 0);
assert.strictEqual(byUrl('/money').content_inbound_count, 1);
assert.strictEqual(byUrl('/money').linked_from_nav.length, 1);
assert.ok(orphans.some(u => u.endsWith('/lonely')));
assert.ok(!orphans.some(u => u.endsWith('/menu-page')));
console.log('link-graph tests OK, orphans:', orphans.length);
