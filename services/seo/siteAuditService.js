/**
 * Site Audit Service
 *
 * Unified SEO audit endpoint. Supports two modes:
 *   - "site"        : crawl an entire site (default)
 *   - "single_page" : audit a single URL (no crawling)
 *
 * Both modes return the exact same response contract (snake_case):
 *   { success, audit_url, domain, mode, timestamp, execution_time,
 *     total_pages, failed_pages, failed_urls, summary, pages: [<normalized page>] }
 *
 * Every entry in `pages` is produced by `normalizePage()` and is guaranteed
 * to have the same shape regardless of mode.
 *
 * Features:
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

async function sendProgressUpdate(progressCallbackUrl, progressCallbackHeaders = {}, payload = {}) {
  if (!progressCallbackUrl || typeof fetch !== 'function') return;

  try {
    await fetch(progressCallbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...progressCallbackHeaders,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('  ⚠️ Progress callback failed:', error.message);
  }
}

/**
 * Strip a leading "www." from a hostname (if present).
 *
 * Canonicalizing hostnames this way lets the crawler treat
 * "www.example.com" and "example.com" as the SAME site — essential
 * when a user passes a www URL and the server 301-redirects to the
 * non-www canonical (or vice versa). Without this, in-page links
 * extracted after the redirect have a different hostname from the
 * starting URL and get rejected as "external", which collapses the
 * whole crawl to a single page.
 */
function canonicalHost(hostname) {
  if (!hostname) return '';
  return hostname.toLowerCase().replace(/^www\./, '');
}

/**
 * Normalize a URL for comparison (canonical host, remove trailing slash, lowercase).
 * www. prefix is stripped so www and non-www resolve to the same normalized key.
 */
function normalizeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = canonicalHost(parsed.hostname);
    let pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    // Strip query params and www for dedup
    // (e.g. https://www.example.com/cja/?ref=x == https://example.com/cja/)
    return (parsed.protocol + '//' + host + pathname).toLowerCase();
  } catch {
    return urlStr.toLowerCase();
  }
}

/**
 * Get the raw hostname from a URL.
 */
function getDomain(urlStr) {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return '';
  }
}

/**
 * Get the canonical (www-stripped, lower-cased) hostname from a URL.
 * Use this for scope comparisons during crawling.
 */
function getCanonicalDomain(urlStr) {
  return canonicalHost(getDomain(urlStr));
}

/**
 * Canonicalize a URL for presentation: strip the leading "www." from the
 * host but preserve the protocol, path, query, and hash so the URL still
 * looks natural in output. Use this for `pages[].url` so every entry in a
 * site audit reports URLs under a single canonical host, regardless of
 * whether the crawler queued a www or bare URL for that page.
 */
function canonicalizeUrl(urlStr) {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    const host = canonicalHost(parsed.hostname);
    return `${parsed.protocol}//${host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return urlStr;
  }
}

const NON_PAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif', 'ico', 'bmp', 'tif', 'tiff',
  'mp4', 'webm', 'mov', 'avi', 'm4v', 'mp3', 'wav', 'ogg', 'm4a',
  'pdf', 'zip', 'rar', '7z', 'gz', 'tar',
  'css', 'js', 'mjs', 'map', 'json', 'xml', 'txt', 'csv',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
]);

function isCrawlablePageUrl(urlStr) {
  if (!urlStr) return false;

  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const pathname = (parsed.pathname || '/').toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    if (match && NON_PAGE_EXTENSIONS.has(match[1].toLowerCase())) {
      return false;
    }

    if (pathname.startsWith('/cdn-cgi/')) return false;
    if (pathname.includes('/wp-content/uploads/')) return false;
    if (pathname.includes('/wp-content/cache/')) return false;

    return true;
  } catch {
    return false;
  }
}

function getCrawlableInternalUrls(page) {
  return (page.linkAnalysis?.allInternalUrls || []).filter(isCrawlablePageUrl);
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
    const internalLinks = getCrawlableInternalUrls(page);

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
      orphans.push(canonicalizeUrl(page.url));
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
    const canonicalUrl = canonicalizeUrl(page.url);

    // Title duplicates
    const title = (page.pageInfo?.title || '').trim().toLowerCase();
    if (title && title.length > 0) {
      if (!titleMap.has(title)) titleMap.set(title, []);
      titleMap.get(title).push(canonicalUrl);
    }

    // Meta description duplicates
    const meta = (page.metaTags?.description || '').trim().toLowerCase();
    if (meta && meta.length > 0) {
      if (!metaMap.has(meta)) metaMap.set(meta, []);
      metaMap.get(meta).push(canonicalUrl);
    }
  }

  // Flag duplicates on each page
  let duplicateTitlesCount = 0;
  let duplicateMetasCount = 0;

  for (const page of pages) {
    const canonicalUrl = canonicalizeUrl(page.url);
    const title = (page.pageInfo?.title || '').trim().toLowerCase();
    const meta = (page.metaTags?.description || '').trim().toLowerCase();

    // Title
    const titleUrls = titleMap.get(title) || [];
    if (titleUrls.length > 1) {
      page.has_duplicate_title = true;
      page.duplicate_title_group = title;
      page.duplicate_title_urls = titleUrls.filter(u => u !== canonicalUrl);
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
      page.duplicate_meta_urls = metaUrls.filter(u => u !== canonicalUrl);
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
    const outbound = getCrawlableInternalUrls(page).map(normalizeUrl);
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
 * Normalize a crawled page into the canonical snake_case output shape.
 *
 * This is the SINGLE source of truth for the per-page contract. Every page
 * returned by `performSiteAudit()` — regardless of mode — passes through
 * this function so there is never a second shape.
 *
 * Input: the mutable pageData built during crawling (see performSiteAudit).
 * Output: a flat-ish snake_case object covering identity, HTTP, basic SEO,
 * headings, score, content, links, images, technical flags, social, structured
 * data, performance, resource errors, redirects, broken links, cross-page
 * analysis and (optional) mobile audit.
 */
function normalizePage(page) {
  const seo = page.seoScore || {};
  const info = page.pageInfo || {};
  const meta = page.metaTags || {};
  const checks = page.seoChecks || {};
  const content = page.contentAnalysis || {};
  const links = page.linkAnalysis || {};
  const struct = page.structuredData || {};
  const cwv = page.coreWebVitals || {};
  const res = page.resourceErrors || {};
  const redir = page.redirectInfo || {};
  const headings = content.headings || {};
  const headingCounts = content.headingCounts || {};
  const text = content.text || {};
  const og = meta.openGraph || {};
  const tw = meta.twitter || {};

  // `url` is canonicalized so every entry in a site audit reports under
  // the same host (e.g. "https://example.com/about"), even if the crawler
  // originally queued it as "https://www.example.com/about" before the
  // redirect. The raw original URL is preserved in `initial_url` and the
  // raw post-redirect URL in `final_url`.
  const rawUrl = page.url;
  const finalUrl = redir.final_url || rawUrl;

  return {
    // === Identity / HTTP ===
    url: canonicalizeUrl(finalUrl),
    initial_url: redir.initial_url || rawUrl,
    final_url: finalUrl,
    requested_url: rawUrl,
    status_code: page.statusCode ?? null,

    // === Basic SEO ===
    title: info.title || '',
    title_length: checks.titleLength || 0,
    title_optimal: !!checks.titleOptimal,
    meta_description: meta.description || '',
    meta_description_length: checks.metaDescriptionLength || 0,
    meta_description_optimal: !!checks.metaDescriptionOptimal,
    meta_keywords: meta.keywords || '',
    meta_author: meta.author || '',
    canonical: meta.canonical || '',
    robots: meta.robots || '',
    viewport: meta.viewport || '',
    language: info.language || '',
    charset: info.charset || '',
    doctype: info.doctype || '',

    // === Headings ===
    h1: headings.h1?.[0] || '',
    h1s: headings.h1 || [],
    h1_count: headingCounts.h1 ?? checks.h1Count ?? 0,
    h1_optimal: !!checks.h1Optimal,
    h2_count: headingCounts.h2 ?? 0,
    h2s: headings.h2 || [],
    h3_count: headingCounts.h3 ?? 0,
    h3s: headings.h3 || [],
    total_headings: headingCounts.total ?? 0,

    // === SEO Score ===
    seo_score: seo.total || 0,
    seo_grade: seo.grade || 'N/A',
    seo_quality: seo.quality || '',
    seo_categories: seo.categories || {},
    seo_breakdown: seo.breakdown || {},
    seo_recommendations: (seo.recommendations?.details || []).map(r => ({
      issue: r.issue,
      priority: r.priority,
      category: r.category,
      impact: r.impact
    })),
    seo_action_plan_summary: seo.recommendations?.actionPlan?.summary || null,

    // === Content ===
    word_count: text.totalWords || 0,
    sentence_count: text.totalSentences || 0,
    paragraph_count: text.totalParagraphs || 0,
    avg_words_per_sentence: text.avgWordsPerSentence || 0,
    avg_words_per_paragraph: text.avgWordsPerParagraph || 0,
    content_language: text.language || '',
    is_hebrew: !!text.isHebrew,
    readability_score: content.readability?.score || 0,
    readability_level: content.readability?.level || '',
    dominant_phrases: content.enhancedKeywords?.dominant_phrases || [],
    has_structured_content: !!content.structuredContent?.hasStructure,
    lists_count: content.structuredContent?.lists?.total || 0,
    tables_count: content.structuredContent?.tables || 0,
    blockquotes_count: content.structuredContent?.blockquotes || 0,
    code_blocks_count: content.structuredContent?.codeBlocks || 0,

    // === Links ===
    total_links: checks.totalLinks || 0,
    internal_links_count: links.internal || 0,
    external_links_count: links.external || 0,
    internal_urls: (links.allInternalUrls || []).filter(isCrawlablePageUrl),
    external_urls: links.allExternalUrls || [],
    links_without_text: links.linksWithoutText ?? checks.linksWithoutText ?? 0,

    // === Images ===
    total_images: checks.totalImages || 0,
    images_with_alt: checks.imagesWithAlt || 0,
    images_without_alt: checks.imagesWithoutAlt || 0,
    all_images_have_alt: !!checks.allImagesHaveAlt,

    // === Technical flags ===
    is_https: !!checks.isHttps,
    has_title: !!checks.hasTitle,
    has_meta_description: !!checks.hasMetaDescription,
    has_h1: !!checks.hasH1,
    has_canonical: !!checks.hasCanonical,
    has_robots: !!checks.hasRobots,
    has_viewport: !!checks.hasViewport,
    has_doctype: !!checks.hasDoctype,
    has_lang: !!checks.hasLang,
    has_favicon: !!checks.hasFavicon,
    has_sitemap: !!checks.hasSitemap,
    has_open_graph: !!checks.hasOpenGraph,
    has_json_ld: !!checks.hasJsonLd,
    is_responsive: !!checks.isResponsive,

    // === Social ===
    open_graph: {
      title: og.title || '',
      description: og.description || '',
      image: og.image || '',
      url: og.url || '',
      type: og.type || '',
      site_name: og.siteName || ''
    },
    twitter_card: {
      card: tw.card || '',
      title: tw.title || '',
      description: tw.description || '',
      image: tw.image || '',
      site: tw.site || ''
    },

    // === Structured data ===
    schemas: struct.found_schemas || [],
    schemas_count: struct.schemas_count || 0,
    main_schema_type: struct.main_type || null,
    critical_schemas: struct.critical_schemas || {},
    schema_quality: struct.quality || {},
    llm_readiness_score: struct.llm_readiness?.score || 0,
    llm_readiness_level: struct.llm_readiness?.level || '',
    llm_readiness_recommendations: struct.llm_readiness?.recommendations || [],

    // === Performance ===
    load_time: page.loadTime || 0,
    execution_time: page.executionTime || 0,
    lcp: cwv.lcp ?? null,
    cls: cwv.cls ?? null,
    ttfb: cwv.ttfb ?? null,

    // === Resource errors ===
    resource_errors_count: res.resource_errors_count || 0,
    resource_errors: res.resource_errors || [],
    js_errors_count: res.js_errors_count || 0,
    css_errors_count: res.css_errors_count || 0,
    font_errors_count: res.font_errors_count || 0,
    image_errors_count: res.image_errors_count || 0,
    media_errors_count: res.media_errors_count || 0,
    resource_redirects_count: res.resource_redirects_count || 0,
    resource_redirects: res.resource_redirects || [],
    js_console_errors_count: (res.js_console_errors || []).length,
    js_console_errors: res.js_console_errors || [],

    // === Redirect chain ===
    redirect_chain_length: redir.redirect_chain_length || 0,
    redirect_chain: redir.redirect_chain || [],

    // === Broken links (filled in during broken-link validation) ===
    broken_links_count: page.broken_links_count || 0,
    broken_links: page.broken_links || [],

    // === Cross-page analysis (site mode; trivially defaulted in single_page) ===
    inbound_links_count: page.inbound_links_count || 0,
    is_orphan_page: !!page.is_orphan_page,
    linked_from: page.linked_from || [],
    click_depth: page.click_depth ?? null,
    crawl_depth: page.crawl_depth ?? 0,
    has_duplicate_title: !!page.has_duplicate_title,
    duplicate_title_count: page.duplicate_title_count || 1,
    duplicate_title_urls: page.duplicate_title_urls || [],
    has_duplicate_meta: !!page.has_duplicate_meta,
    duplicate_meta_count: page.duplicate_meta_count || 1,
    duplicate_meta_urls: page.duplicate_meta_urls || [],

    // === Mobile ===
    mobile_audit: page.mobileAudit || null
  };
}

/**
 * Perform an SEO audit (single page or full site).
 *
 * @param {string} startUrl - The starting URL (homepage for site mode, target for single_page mode)
 * @param {Object} options - Configuration
 * @param {"site"|"single_page"} options.mode - Audit mode (default: "site"). "single_page" audits only the given URL.
 * @param {number} options.maxPages - Maximum pages to crawl (default: 500, 0 = unlimited). Forced to 1 in single_page mode.
 * @param {number} options.maxDepth - Maximum crawl depth (default: 5). Forced to 0 in single_page mode.
 * @param {boolean} options.validateBrokenLinks - Whether to check broken links (default: true for site, false for single_page)
 * @param {number} options.linkValidationConcurrency - Concurrent link checks (default: 10)
 * @param {number} options.pageConcurrency - Concurrent page scans (default: 3)
 * @param {string[]} options.skipLinkDomains - Domains to skip for broken link validation
 * @param {boolean} options.includeScreenshots - Include page screenshots (default: false)
 * @param {boolean} options.includeMobile - Include mobile audit (default: false)
 * @param {number} options.timeout - Per-page timeout in ms (default: 30000)
 * @returns {Object} Unified audit results (same shape for site and single_page modes)
 */
async function performSiteAudit(startUrl, options = {}) {
  // Detect single_page mode: explicit option OR maxPages === 1
  const isSinglePage =
    options.mode === 'single_page' ||
    options.mode === 'single' ||
    options.maxPages === 1;
  const mode = isSinglePage ? 'single_page' : 'site';

  const {
    validateBrokenLinks = !isSinglePage,
    linkValidationConcurrency = 10,
    pageConcurrency = 3,
    skipLinkDomains = ['google.com', 'facebook.com', 'twitter.com', 'youtube.com', 'linkedin.com', 'instagram.com'],
    includeScreenshots = false,
    includeMobile = false,
    timeout = isSinglePage ? 60000 : 30000,
    progressCallbackUrl,
    progressCallbackHeaders,
    progressContext = {}
  } = options;

  // In single_page mode, FORCE maxPages=1 and maxDepth=0 regardless of what the caller passes.
  // In site mode, use caller-provided values or sensible defaults.
  const maxPages = isSinglePage ? 1 : (options.maxPages ?? 500);
  const maxDepth = isSinglePage ? 0 : (options.maxDepth ?? 5);

  const reportProgress = async (payload = {}) => {
    await sendProgressUpdate(progressCallbackUrl, progressCallbackHeaders, {
      status: 'running',
      errors: 0,
      ...progressContext,
      ...payload,
    });
  };

  const startTime = Date.now();
  const domain = getDomain(startUrl);
  // Canonical host for crawl-scope comparisons (strips "www.").
  // We keep a Set so extra hostnames can be added after the first page
  // loads and we learn the redirect target.
  const scopeHosts = new Set([canonicalHost(domain)]);
  const inScope = (u) => scopeHosts.has(getCanonicalDomain(u));
  const normalizedStart = normalizeUrl(startUrl);

  console.log(`🔍 Starting ${mode} audit for: ${startUrl}${isSinglePage ? '' : ` (max ${maxPages} pages)`}`);

  await reportProgress({
    progress: 12,
    current_step: 'מאתר עמודים באתר...',
    pages_scanned: 0,
    pages_total: 0,
  });

  // === Phase 1: Crawl all pages ===
  const crawledPages = [];
  const urlQueue = [{ url: startUrl, depth: 0 }];
  const visited = new Set();
  const failedUrls = [];

  // Crawl pages with concurrency control (maxPages=0 means unlimited)
  const effectiveMaxPages = maxPages === 0 ? Infinity : maxPages;
  while (urlQueue.length > 0 && crawledPages.length < effectiveMaxPages) {
    // Take a batch of URLs to process concurrently (respect maxPages)
    const remaining = effectiveMaxPages - crawledPages.length;
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
            waitUntil: 'networkidle',
            // Site crawls are a legitimate high-volume operation. Bypass the
            // browserPool's external rate limiter (10/min per domain) and
            // per-domain mutex — the crawler manages concurrency itself via
            // `pageConcurrency`. Without these skips, a site crawl of N>10
            // pages trips the limiter and collapses to total_pages ≤ 10.
            skipRateLimit: true,
            skipDomainLock: true
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
        failedUrls.push({ url: canonicalizeUrl(url), error });
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

      // Learn the redirect-target host from the very first page we crawl.
      // If the user started at https://www.example.com/ but the server
      // 301-redirected to https://example.com/, Playwright's final URL is
      // the non-www one and in-page JS extracts links under that host.
      // We add the final_url's canonical host to the scope set so those
      // links aren't rejected as "external". (canonicalHost already strips
      // "www.", so the common www↔non-www case is covered too.)
      const finalUrl = result.results?.redirectInfo?.final_url;
      if (finalUrl) {
        scopeHosts.add(getCanonicalDomain(finalUrl));
      }

      // Discover new internal URLs to crawl
      if (depth < maxDepth && crawledPages.length < maxPages) {
        const internalUrls = (result.results?.linkAnalysis?.allInternalUrls || []).filter(isCrawlablePageUrl);
        for (const link of internalUrls) {
          const normalizedLink = normalizeUrl(link);
          // Only crawl in-scope URLs that haven't been visited.
          // inScope() uses canonicalHost so "www.example.com" and
          // "example.com" are treated as the same site.
          if (!visited.has(normalizedLink) && inScope(link)) {
            urlQueue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    }

    const knownTotal = crawledPages.length + urlQueue.length;
    const crawlProgress = knownTotal > 0
      ? Math.min(78, Math.max(12, Math.round((crawledPages.length / knownTotal) * 70)))
      : 12;

    await reportProgress({
      progress: crawlProgress,
      current_step: `נסרקו ${crawledPages.length} עמודים, התגלו עוד ${urlQueue.length} בתור`,
      pages_scanned: crawledPages.length,
      pages_total: knownTotal,
    });
  }

  console.log(`  ✅ Crawled ${crawledPages.length} pages`);

  await reportProgress({
    progress: 82,
    current_step: `הסריקה הסתיימה, מעבד ${crawledPages.length} עמודים`,
    pages_scanned: crawledPages.length,
    pages_total: crawledPages.length,
  });

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

    await reportProgress({
      progress: 88,
      current_step: 'בודק קישורים ומשלים ניתוח...',
      pages_scanned: crawledPages.length,
      pages_total: crawledPages.length,
    });

    // Collect all unique links across all pages
    const allInternalLinks = new Set();
    const allExternalLinks = new Set();

    for (const page of crawledPages) {
      const internal = getCrawlableInternalUrls(page);
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
        ...getCrawlableInternalUrls(page),
        ...(page.linkAnalysis?.allExternalUrls || [])
      ];
      const pageBroken = allLinks.filter(l => brokenUrlSet.has(l));
      page.broken_links_count = pageBroken.length;
      page.broken_links = pageBroken;
    }

    console.log(`  ✅ Validated ${uncrawledInternalLinks.length + allExternalLinks.size} links`);
  }

  await reportProgress({
    progress: 94,
    current_step: 'בונה סיכום סריקה...',
    pages_scanned: crawledPages.length,
    pages_total: crawledPages.length,
  });

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

  // Single source of truth for per-page shape
  const pagesOutput = crawledPages.map(normalizePage);

  const result = {
    success: true,
    audit_url: startUrl,
    domain,
    mode,
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
          url: canonicalizeUrl(p.url),
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
  normalizePage,
  normalizeUrl,
  canonicalizeUrl,
  canonicalHost,
  getCanonicalDomain,
  buildLinkGraph,
  detectOrphanPages,
  detectDuplicates,
  calculateClickDepth
};
