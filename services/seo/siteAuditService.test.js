const {
  enqueueUniqueCrawlUrls,
  getCrawlProgressCounts,
} = require('./crawlQueue');

function normalizeUrl(urlStr) {
  const parsed = new URL(urlStr);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return `${parsed.protocol}//${host}${pathname}`.toLowerCase();
}

describe('site audit crawl queue', () => {
  it('queues each canonical URL once even when discovered repeatedly', () => {
    const queue = [];
    const scheduled = new Set([normalizeUrl('https://example.com/')]);
    const inScope = (url) => new URL(url).hostname.replace(/^www\./, '') === 'example.com';

    enqueueUniqueCrawlUrls(queue, scheduled, [
      'https://example.com/about',
      'https://example.com/about/',
      'https://www.example.com/about?ref=nav',
      'https://example.com/image.jpg',
      'https://other.example/contact',
    ], 1, inScope, normalizeUrl);

    expect(queue).toEqual([{ url: 'https://example.com/about', depth: 1 }]);
    expect(scheduled.size).toBe(2);
  });

  it('caps the displayed target at the configured crawl limit', () => {
    expect(getCrawlProgressCounts(52, 644, 500)).toEqual({
      pagesTotal: 500,
      pagesRemaining: 448,
    });
  });

  it('reports the exact unique target when it is below the limit', () => {
    expect(getCrawlProgressCounts(52, 177, 500)).toEqual({
      pagesTotal: 229,
      pagesRemaining: 177,
    });
  });
});
