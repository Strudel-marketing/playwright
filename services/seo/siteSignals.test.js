const {
  isRootAllowed,
  parseRobotsTxt,
  securityHeaders,
} = require('./siteSignals');

describe('site-level SEO signals', () => {
  it('extracts sitemap declarations and crawler-specific access', () => {
    const parsed = parseRobotsTxt(`
      User-agent: *
      Allow: /
      Sitemap: https://example.com/sitemap.xml

      User-agent: GPTBot
      Disallow: /
    `);

    expect(parsed.sitemaps).toEqual(['https://example.com/sitemap.xml']);
    expect(isRootAllowed(parsed, 'Googlebot')).toBe(true);
    expect(isRootAllowed(parsed, 'GPTBot')).toBe(false);
  });

  it('uses the longest matching robots rule with allow winning ties', () => {
    const parsed = parseRobotsTxt(`
      User-agent: *
      Disallow: /
      Allow: /
    `);

    expect(isRootAllowed(parsed, 'ClaudeBot')).toBe(true);
  });

  it('reports security headers without pretending missing headers were unmeasured', () => {
    const headers = new Headers({
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
    });

    expect(securityHeaders(headers)).toMatchObject({
      hsts: { present: true },
      csp: { present: false },
      x_content_type_options: { present: true },
    });
  });
});
