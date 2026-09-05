const { URL } = require('url');

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
    if (match && NON_PAGE_EXTENSIONS.has(match[1].toLowerCase())) return false;
    if (pathname.startsWith('/cdn-cgi/')) return false;
    if (pathname.includes('/wp-content/uploads/')) return false;
    if (pathname.includes('/wp-content/cache/')) return false;

    return true;
  } catch {
    return false;
  }
}

function enqueueUniqueCrawlUrls(queue, scheduledUrls, urls, depth, inScope, normalizeUrl) {
  let added = 0;

  for (const link of urls) {
    if (!isCrawlablePageUrl(link) || !inScope(link)) continue;

    const normalized = normalizeUrl(link);
    if (scheduledUrls.has(normalized)) continue;

    scheduledUrls.add(normalized);
    queue.push({ url: link, depth });
    added++;
  }

  return added;
}

function getCrawlProgressCounts(scannedCount, queuedCount, effectiveMaxPages) {
  const discoveredTotal = scannedCount + queuedCount;
  const pagesTotal = Number.isFinite(effectiveMaxPages)
    ? Math.min(effectiveMaxPages, discoveredTotal)
    : discoveredTotal;

  return {
    pagesTotal,
    pagesRemaining: Math.max(0, pagesTotal - scannedCount),
  };
}

module.exports = {
  enqueueUniqueCrawlUrls,
  getCrawlProgressCounts,
  isCrawlablePageUrl,
};
