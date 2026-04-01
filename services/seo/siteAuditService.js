/**
 * Site Audit Service
 *
 * Performs site-wide SEO analysis including:
 * - Multi-page crawling with configurable depth/limits
 * - Resource validation (JS/CSS/Font errors)
 * - Duplicate title & meta description detection
 * - Orphan pages detection (internal link graph)
 * - Click depth calculation (BFS from homepage)
 * - Redirect chain detection
 * - Broken links validation
 */

const seoService = require('./seoService');
const { validateLinks } = require('./linkValidator');
const { URL } = require('url');

/**
 * Normalize a URL for comparison (remove trailing slash, fragment, lowercase)
 */
function normalizeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    let pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    // Strip query params for dedup (e.g. /cja/?ref=homepage == /cja/)
    return (parsed.origin + pathname).toLowerCase();
  } catch {
    return urlStr.toLowerCase();
  }
}

/**
 * Get the domain from a URL
 */
function getDomain(urlStr) {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return '';
  }
}

/**
 * Build an internal link graph from crawled pages
 * Returns a Map<normalizedUrl, Set<linkedFromUrls>>
 */
function buildLinkGraph(pages) {
  const graph = new Map();

  // Initialize all crawled pages in the graph
  for (const page of pages) {
    const normalizedUrl = normalizeUrl(page.url);
    if (!graph.has(normalizedUrl)) {
      graph.set(normalizedUrl, new Set());
    }
  }

  // Build inbound link map
  for (const page of pages) {
    const fromUrl = normalizeUrl(page.url);
    const internalLinks = page.linkAnalysis?.allInternalUrls || [];

    for (const link of internalLinks) {
      const normalizedLink = normalizeUrl(link);
      if (!graph.has(normalizedLink)) {
        graph.set(normalizedLink, new Set());
      }
      // Don't count self-links
      if (normalizedLink !== fromUrl) {
        graph.get(normalizedLink).add(fromUrl);
      }
    }
  }

  return graph;
}

/**
 * Detect orphan pages (pages with no inbound internal links)
 */
function detectOrphanPages(pages, linkGraph, homepageUrl) {
  const normalizedHomepage = normalizeUrl(homepageUrl);
  const orphans = [];

  for (const page of pages) {
    const normalizedUrl = normalizeUrl(page.url);
    const inboundLinks = linkGraph.get(normalizedUrl) || new Set();
    const inboundCount = inboundLinks.size;
    const isOrphan = inboundCount === 0 && normalizedUrl !== normalizedHomepage;

    page.inbound_links_count = inboundCount;
    page.is_orphan_page = isOrphan;
    // Store linked_from only for pages with < 10 inbound links (save space)
    page.linked_from = inboundCount <= 10 ? Array.from(inboundLinks) : [];

    if (isOrphan) {
      orphans.push(page.url);
    }
  }

  return orphans;
}

/**
 * Detect duplicate titles and meta descriptions across pages
 */
function detectDuplicates(pages) {
  const titleMap = new Map(); // normalized title -> [urls]
  const metaMap = new Map();  // normalized meta desc -> [urls]

  for (const page of pages) {
    // Title duplicates
    const title = (page.pageInfo?.title || '').trim().toLowerCase();
    if (title && title.length > 0) {
      if (!titleMap.has(title)) titleMap.set(title, []);
      titleMap.get(title).push(page.url);
    }

    // Meta description duplicates
    const meta = (page.metaTags?.description || '').trim().toLowerCase();
    if (meta && meta.length > 0) {
      if (!metaMap.has(meta)) metaMap.set(meta, []);
      metaMap.get(meta).push(page.url);
    }
  }

  // Flag duplicates on each page
  let duplicateTitlesCount = 0;
  let duplicateMetasCount = 0;

  for (const page of pages) {
    const title = (page.pageInfo?.title || '').trim().toLowerCase();
    const meta = (page.metaTags?.description || '').trim().toLowerCase();

    // Title
    const titleUrls = titleMap.get(title) || [];
    if (titleUrls.length > 1) {
      page.has_duplicate_title = true;
      page.duplicate_title_group = title;
      page.duplicate_title_urls = titleUrls.filter(u => u !== page.url);
      page.duplicate_title_count = titleUrls.length;
      duplicateTitlesCount++;
    } else {
      page.has_duplicate_title = false;
      page.duplicate_title_count = 1;
    }

    // Meta description
    const metaUrls = metaMap.get(meta) || [];
    if (metaUrls.length > 1) {
      page.has_duplicate_meta = true;
      page.duplicate_meta_group = meta;
      page.duplicate_meta_urls = metaUrls.filter(u => u !== page.url);
      page.duplicate_meta_count = metaUrls.length;
      duplicateMetasCount++;
    } else {
      page.has_duplicate_meta = false;
      page.duplicate_meta_count = 1;
    }
  }

  // Build unique duplicate groups for summary
  const titleGroups = [];
  titleMap.forEach((urls, title) => {
    if (urls.length > 1) {
      titleGroups.push({ title, urls, count: urls.length });
    }
  });

  const metaGroups = [];
  metaMap.forEach((urls, meta) => {
    if (urls.length > 1) {
      metaGroups.push({ meta, urls, count: urls.length });
    }
  });

  return {
    duplicate_titles_count: duplicateTitlesCount,
    duplicate_metas_count: duplicateMetasCount,
    duplicate_title_groups: titleGroups,
    duplicate_meta_groups: metaGroups
  };
}

/**
 * Calculate click depth from homepage using BFS
 */
function calculateClickDepth(pages, homepageUrl) {
  const normalizedHomepage = normalizeUrl(homepageUrl);

  // Build adjacency list: url -> [outbound internal urls]
  const adjacency = new Map();
  for (const page of pages) {
    const normalized = normalizeUrl(page.url);
    const outbound = (page.linkAnalysis?.allInternalUrls || []).map(normalizeUrl);
    adjacency.set(normalized, outbound);
  }

  // BFS from homepage
  const depthMap = new Map();
  const queue = [{ url: normalizedHomepage, depth: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;

    visited.add(url);
    depthMap.set(url, depth);

    const outboundLinks = adjacency.get(url) || [];
    for (const link of outboundLinks) {
      if (!visited.has(link)) {
        queue.push({ url: link, depth: depth + 1 });
      }
    }
  }

  // Assign depth to each page
  let maxDepth = 0;
  let totalDepth = 0;
  let deepPagesCount = 0;
  let reachableCount = 0;

  for (const page of pages) {
    const normalized = normalizeUrl(page.url);
    const depth = depthMap.get(normalized);

    if (depth !== undefined) {
      page.click_depth = depth;
      totalDepth += depth;
      reachableCount++;
      if (depth > maxDepth) maxDepth = depth;
      if (depth > 3) deepPagesCount++;
    } else {
      page.click_depth = null; // unreachable from homepage
    }
  }

  return {
    avg_click_depth: reachableCount > 0 ? Number((totalDepth / reachableCount).toFixed(1)) : 0,
    max_click_depth: maxDepth,
    deep_pages_count: deepPagesCount,
    unreachable_pages: pages.filter(p => p.click_depth === null).length
  };
}

/**
 * Perform a full site audit
 *
 * @param {string} startUrl - The homepage/starting URL
 * @param {Object} options - Configuration
 * @param {number} options.maxPages - Maximum pages to crawl (default: 100)
 * @param {number} options.maxDepth - Maximum crawl depth (default: 5)
 * @param {boolean} options.validateBrokenLinks - Whether to check broken links (default: true)
 * @param {number} options.linkValidationConcurrency - Concurrent link checks (default: 10)
 * @param {number} options.pageConcurrency - Concurrent page scans (default: 3)
 * @param {string[]} options.skipLinkDomains - Domains to skip for broken link validation
 * @param {boolean} options.includeScreenshots - Include page screenshots (default: false)
 * @param {boolean} options.includeMobile - Include mobile audit (default: false)
 * @param {number} options.timeout - Per-page timeout in ms (default: 30000)
 * @returns {Object} Complete site audit results
 */
async function performSiteAudit(startUrl, options = {}) {
  const {
    maxPages = 100,
    maxDepth = 5,
    validateBrokenLinks = true,
    linkValidationConcurrency = 10,
    pageConcurrency = 3,
    skipLinkDomains = ['google.com', 'facebook.com', 'twitter.com', 'youtube.com', 'linkedin.com', 'instagram.com'],
    includeScreenshots = false,
    includeMobile = false,
    timeout = 30000
  } = options;

  const startTime = Date.now();
  const domain = getDomain(startUrl);
  const normalizedStart = normalizeUrl(startUrl);

  console.log(`🔍 Starting site audit for: ${startUrl} (max ${maxPages} pages)`);

  // === Phase 1: Crawl all pages ===
  const crawledPages = [];
  const urlQueue = [{ url: startUrl, depth: 0 }];
  const visited = new Set();
  const failedUrls = [];

  // Crawl pages with concurrency control
  while (urlQueue.length > 0 && crawledPages.length < maxPages) {
    // Take a batch of URLs to process concurrently (respect maxPages)
    const remaining = maxPages - crawledPages.length;
    const batch = [];
    while (batch.length < pageConcurrency && batch.length < remaining && urlQueue.length > 0) {
      const item = urlQueue.shift();
      const normalized = normalizeUrl(item.url);

      if (visited.has(normalized)) continue;
      if (item.depth > maxDepth) continue;

      visited.add(normalized);
      batch.push(item);
    }

    if (batch.length === 0) continue;

    // Process batch concurrently
    const batchResults = await Promise.allSettled(
      batch.map(async ({ url, depth }) => {
        try {
          console.log(`  📄 Scanning (${crawledPages.length + 1}/${maxPages}): ${url}`);

          const result = await seoService.performSeoAudit(url, {
            includeScreenshot: includeScreenshots,
            includeMobile,
            timeout,
            blockThirdParties: false, // Don't block - we need to track resource errors
            waitUntil: 'networkidle'
          });

          return { url, depth, result, success: true };
        } catch (error) {
          console.warn(`  ⚠️ Failed to scan: ${url} - ${error.message}`);
          return { url, depth, error: error.message, success: false };
        }
      })
    );

    // Process results and discover new URLs
    for (const settledResult of batchResults) {
      if (settledResult.status === 'rejected') continue;

      const { url, depth, result, success, error } = settledResult.value;

      if (!success) {
        failedUrls.push({ url, error });
        continue;
      }

      // Extract page data for cross-page analysis
      const pageData = {
        url,
        crawl_depth: depth,
        statusCode: result.statusCode,
        pageInfo: result.results?.pageInfo || {},
        metaTags: result.results?.metaTags || {},
        seoChecks: result.results?.seoChecks || {},
        seoScore: result.results?.seoScore || {},
        contentAnalysis: result.results?.contentAnalysis || {},
        linkAnalysis: result.results?.linkAnalysis || {},
        structuredData: result.results?.structuredData || {},
        coreWebVitals: result.results?.coreWebVitals || {},
        resourceErrors: result.results?.resourceErrors || {},
        redirectInfo: result.results?.redirectInfo || {},
        mobileAudit: result.results?.mobileAudit || null,
        loadTime: result.loadTime,
        executionTime: result.executionTime
      };

      crawledPages.push(pageData);

      // Discover new internal URLs to crawl
      if (depth < maxDepth && crawledPages.length < maxPages) {
        const internalUrls = result.results?.linkAnalysis?.allInternalUrls || [];
        for (const link of internalUrls) {
          const normalizedLink = normalizeUrl(link);
          // Only crawl same-domain URLs that haven't been visited
          if (!visited.has(normalizedLink) && getDomain(link) === domain) {
            urlQueue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    }
  }

  console.log(`  ✅ Crawled ${crawledPages.length} pages`);

  // === Phase 2: Cross-page analysis (post-processing) ===
  console.log('  🔄 Running cross-page analysis...');

  // 2a. Build link graph and detect orphans
  const linkGraph = buildLinkGraph(crawledPages);
  const orphanPages = detectOrphanPages(crawledPages, linkGraph, startUrl);

  // 2b. Detect duplicates
  const duplicates = detectDuplicates(crawledPages);

  // 2c. Calculate click depth
  const clickDepthStats = calculateClickDepth(crawledPages, startUrl);

  // === Phase 3: Broken links validation (optional) ===
  let brokenLinksResult = null;
  if (validateBrokenLinks) {
    console.log('  🔗 Validating links...');

    // Collect all unique links across all pages
    const allInternalLinks = new Set();
    const allExternalLinks = new Set();

    for (const page of crawledPages) {
      const internal = page.linkAnalysis?.allInternalUrls || [];
      const external = page.linkAnalysis?.allExternalUrls || [];
      internal.forEach(l => allInternalLinks.add(l));
      external.forEach(l => allExternalLinks.add(l));
    }

    // Validate internal links (that weren't already crawled)
    const uncrawledInternalLinks = Array.from(allInternalLinks).filter(
      link => !visited.has(normalizeUrl(link))
    );

    const internalValidation = uncrawledInternalLinks.length > 0
      ? await validateLinks(uncrawledInternalLinks, {
          concurrency: linkValidationConcurrency,
          timeout: 5000
        })
      : { broken_links: [], redirect_links: [], error_links: [], broken_count: 0, redirect_count: 0 };

    // Validate external links
    const externalValidation = allExternalLinks.size > 0
      ? await validateLinks(Array.from(allExternalLinks), {
          concurrency: linkValidationConcurrency,
          timeout: 5000,
          skipDomains: skipLinkDomains
        })
      : { broken_links: [], redirect_links: [], error_links: [], broken_count: 0, redirect_count: 0 };

    brokenLinksResult = {
      internal: {
        checked: uncrawledInternalLinks.length,
        ...internalValidation
      },
      external: {
        checked: allExternalLinks.size,
        ...externalValidation
      },
      total_broken: internalValidation.broken_count + externalValidation.broken_count,
      total_redirects: internalValidation.redirect_count + externalValidation.redirect_count
    };

    // Map broken links back to the pages that contain them
    const brokenUrlSet = new Set([
      ...internalValidation.broken_links.map(l => l.url),
      ...(internalValidation.error_links || []).map(l => l.url),
      ...externalValidation.broken_links.map(l => l.url),
      ...(externalValidation.error_links || []).map(l => l.url)
    ]);

    for (const page of crawledPages) {
      const allLinks = [
        ...(page.linkAnalysis?.allInternalUrls || []),
        ...(page.linkAnalysis?.allExternalUrls || [])
      ];
      const pageBroken = allLinks.filter(l => brokenUrlSet.has(l));
      page.broken_links_count = pageBroken.length;
      page.broken_links = pageBroken;
    }

    console.log(`  ✅ Validated ${uncrawledInternalLinks.length + allExternalLinks.size} links`);
  }

  // === Phase 4: Build summary ===
  const executionTime = Date.now() - startTime;

  // Resource errors summary across all pages
  let totalResourceErrors = 0;
  let totalJsErrors = 0;
  let totalCssErrors = 0;
  let totalFontErrors = 0;
  let totalImageErrors = 0;
  let totalMediaErrors = 0;
  let totalResourceRedirects = 0;
  let totalJsRedirects = 0;
  let totalCssRedirects = 0;
  let totalFontRedirects = 0;
  let totalImageRedirects = 0;
  let totalMediaRedirects = 0;

  for (const page of crawledPages) {
    const re = page.resourceErrors || {};
    totalResourceErrors += re.resource_errors_count || 0;
    totalJsErrors += re.js_errors_count || 0;
    totalCssErrors += re.css_errors_count || 0;
    totalFontErrors += re.font_errors_count || 0;
    totalImageErrors += re.image_errors_count || 0;
    totalMediaErrors += re.media_errors_count || 0;
    totalResourceRedirects += re.resource_redirects_count || 0;
    totalJsRedirects += re.js_redirects_count || 0;
    totalCssRedirects += re.css_redirects_count || 0;
    totalFontRedirects += re.font_redirects_count || 0;
    totalImageRedirects += re.image_redirects_count || 0;
    totalMediaRedirects += re.media_redirects_count || 0;
  }

  // Redirect chains summary
  const redirectChains = crawledPages.filter(
    p => (p.redirectInfo?.redirect_chain_length || 0) > 0
  );
  const longRedirectChains = redirectChains.filter(
    p => p.redirectInfo.redirect_chain_length > 3
  );

  // Status codes summary
  const statusCodes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  for (const page of crawledPages) {
    const code = page.statusCode || 0;
    if (code >= 200 && code < 300) statusCodes['2xx']++;
    else if (code >= 300 && code < 400) statusCodes['3xx']++;
    else if (code >= 400 && code < 500) statusCodes['4xx']++;
    else if (code >= 500) statusCodes['5xx']++;
  }

  // Average SEO score
  const scores = crawledPages.map(p => p.seoScore?.total || 0).filter(s => s > 0);
  const avgScore = scores.length > 0
    ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
    : 0;

  // Prepare page data for output (clean up large fields)
  const pagesOutput = crawledPages.map(page => ({
    url: page.url,
    status_code: page.statusCode,
    seo_score: page.seoScore?.total || 0,
    seo_grade: page.seoScore?.grade || 'N/A',
    title: page.pageInfo?.title || '',
    meta_description: page.metaTags?.description || '',
    h1: page.contentAnalysis?.headings?.h1?.[0] || '',
    word_count: page.contentAnalysis?.text?.totalWords || 0,
    load_time: page.loadTime || 0,

    // Resource errors
    resource_errors_count: page.resourceErrors?.resource_errors_count || 0,
    js_errors_count: page.resourceErrors?.js_errors_count || 0,
    css_errors_count: page.resourceErrors?.css_errors_count || 0,
    font_errors_count: page.resourceErrors?.font_errors_count || 0,
    image_errors_count: page.resourceErrors?.image_errors_count || 0,
    media_errors_count: page.resourceErrors?.media_errors_count || 0,
    resource_errors: page.resourceErrors?.resource_errors || [],
    resource_redirects_count: page.resourceErrors?.resource_redirects_count || 0,
    resource_redirects: page.resourceErrors?.resource_redirects || [],

    // Duplicates
    has_duplicate_title: page.has_duplicate_title || false,
    duplicate_title_count: page.duplicate_title_count || 1,
    duplicate_title_urls: page.duplicate_title_urls || [],
    has_duplicate_meta: page.has_duplicate_meta || false,
    duplicate_meta_count: page.duplicate_meta_count || 1,

    // Orphan / Link graph
    inbound_links_count: page.inbound_links_count || 0,
    is_orphan_page: page.is_orphan_page || false,
    linked_from: page.linked_from || [],
    internal_links_count: page.linkAnalysis?.internal || 0,
    external_links_count: page.linkAnalysis?.external || 0,

    // Click depth
    click_depth: page.click_depth,

    // Redirect chain
    redirect_chain_length: page.redirectInfo?.redirect_chain_length || 0,
    redirect_chain: page.redirectInfo?.redirect_chain || [],
    initial_url: page.redirectInfo?.initial_url || page.url,
    final_url: page.redirectInfo?.final_url || page.url,

    // Broken links
    broken_links_count: page.broken_links_count || 0,
    broken_links: page.broken_links || [],

    // Core Web Vitals
    lcp: page.coreWebVitals?.lcp || null,
    cls: page.coreWebVitals?.cls || null,
    ttfb: page.coreWebVitals?.ttfb || null,

    // SEO checks
    has_title: page.seoChecks?.hasTitle || false,
    has_meta_description: page.seoChecks?.hasMetaDescription || false,
    has_h1: page.seoChecks?.hasH1 || false,
    is_https: page.seoChecks?.isHttps || false,
    has_canonical: page.seoChecks?.hasCanonical || false,
    images_without_alt: page.seoChecks?.imagesWithoutAlt || 0,

    // Structured data
    schemas: page.structuredData?.found_schemas || [],

    // Crawl metadata
    crawl_depth: page.crawl_depth
  }));

  const result = {
    success: true,
    audit_url: startUrl,
    domain,
    timestamp: new Date().toISOString(),
    execution_time: executionTime,
    total_pages: crawledPages.length,
    failed_pages: failedUrls.length,

    summary: {
      avg_seo_score: avgScore,
      status_codes: statusCodes,

      resource_errors: {
        total: totalResourceErrors,
        js: totalJsErrors,
        css: totalCssErrors,
        fonts: totalFontErrors,
        images: totalImageErrors,
        media: totalMediaErrors
      },

      resource_redirects: {
        total: totalResourceRedirects,
        js: totalJsRedirects,
        css: totalCssRedirects,
        fonts: totalFontRedirects,
        images: totalImageRedirects
      },

      duplicates: {
        titles: duplicates.duplicate_titles_count,
        meta_descriptions: duplicates.duplicate_metas_count,
        title_groups: duplicates.duplicate_title_groups,
        meta_groups: duplicates.duplicate_meta_groups
      },

      orphan_pages: orphanPages.length,
      orphan_urls: orphanPages,

      click_depth: clickDepthStats,

      redirect_chains: {
        total: redirectChains.length,
        long_chains: longRedirectChains.length,
        details: redirectChains.map(p => ({
          url: p.url,
          chain_length: p.redirectInfo.redirect_chain_length,
          chain: p.redirectInfo.redirect_chain
        }))
      },

      broken_links: brokenLinksResult || { total_broken: 0, total_redirects: 0 }
    },

    pages: pagesOutput,
    failed_urls: failedUrls
  };

  console.log(`✅ Site audit completed - ${crawledPages.length} pages in ${(executionTime / 1000).toFixed(1)}s`);
  console.log(`   Resource errors: ${totalResourceErrors} | Duplicates: ${duplicates.duplicate_titles_count} titles | Orphans: ${orphanPages.length} | Deep pages: ${clickDepthStats.deep_pages_count}`);

  return result;
}

module.exports = {
  performSiteAudit,
  // Export utilities for testing
  normalizeUrl,
  buildLinkGraph,
  detectOrphanPages,
  detectDuplicates,
  calculateClickDepth
};
