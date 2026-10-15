const DEFAULT_TIMEOUT_MS = 10000;

function measured(present, extra = {}) {
  return { state: 'measured', present, ...extra };
}

function unmeasured(error, extra = {}) {
  return { state: 'unmeasured', present: null, error, ...extra };
}

async function fetchSignal(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'StrudelSEOAudit/1.0' },
    });
    const text = options.readBody === false ? '' : await response.text();
    return { ok: true, response, text };
  } catch (error) {
    return { ok: false, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobotsTxt(text) {
  const groups = [];
  const sitemaps = [];
  let agents = [];
  let rules = [];

  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'sitemap' && value) {
      sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
      continue;
    }
    if ((key === 'allow' || key === 'disallow') && agents.length) {
      rules.push({ type: key, path: value });
    }
  }
  flush();
  return { groups, sitemaps: [...new Set(sitemaps)] };
}

function isRootAllowed(parsed, bot) {
  const normalizedBot = bot.toLowerCase();
  const specific = parsed.groups.filter(group =>
    group.agents.some(agent => agent !== '*' && normalizedBot.includes(agent))
  );
  const applicable = specific.length
    ? specific
    : parsed.groups.filter(group => group.agents.includes('*'));
  const matchingRules = applicable
    .flatMap(group => group.rules)
    .filter(rule => rule.path && '/'.startsWith(rule.path.replace(/\$$/, '')))
    .sort((a, b) => b.path.length - a.path.length || (a.type === 'allow' ? -1 : 1));

  if (!matchingRules.length) return true;
  return matchingRules[0].type === 'allow';
}

function securityHeaders(headers) {
  const names = {
    hsts: 'strict-transport-security',
    csp: 'content-security-policy',
    x_content_type_options: 'x-content-type-options',
    referrer_policy: 'referrer-policy',
    permissions_policy: 'permissions-policy',
  };
  return Object.fromEntries(Object.entries(names).map(([key, header]) => [key, {
    present: headers.has(header),
    value: headers.get(header) || '',
  }]));
}

async function collectSiteSignals(startUrl, options = {}) {
  let origin;
  try {
    origin = new URL(startUrl).origin;
  } catch {
    return { state: 'unmeasured', error: 'invalid-url' };
  }

  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  const robotsUrl = `${origin}/robots.txt`;
  const [homepageResult, robotsResult, llmsResult] = await Promise.all([
    fetchSignal(startUrl, { timeout, readBody: false }),
    fetchSignal(robotsUrl, { timeout }),
    fetchSignal(`${origin}/llms.txt`, { timeout }),
  ]);

  let robots;
  let declaredSitemaps = [];
  if (!robotsResult.ok) {
    robots = unmeasured(robotsResult.error, { url: robotsUrl });
  } else {
    const { response, text } = robotsResult;
    const present = response.ok && text.trim().length > 0 && !/^\s*</.test(text);
    const parsed = present ? parseRobotsTxt(text) : { groups: [], sitemaps: [] };
    declaredSitemaps = parsed.sitemaps;
    robots = measured(present, {
      url: response.url,
      status_code: response.status,
      sitemaps: declaredSitemaps,
      crawler_access: present ? {
        googlebot: isRootAllowed(parsed, 'googlebot'),
        gptbot: isRootAllowed(parsed, 'gptbot'),
        claudebot: isRootAllowed(parsed, 'claudebot'),
        perplexitybot: isRootAllowed(parsed, 'perplexitybot'),
      } : null,
    });
  }

  const sitemapCandidates = [...new Set([
    ...declaredSitemaps,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ])].slice(0, 5);
  const sitemapResults = await Promise.all(sitemapCandidates.map(async url => {
    const result = await fetchSignal(url, { timeout });
    if (!result.ok) return unmeasured(result.error, { url });
    const contentType = result.response.headers.get('content-type') || '';
    const looksLikeXml = /xml/i.test(contentType) || /<(urlset|sitemapindex)\b/i.test(result.text);
    return measured(result.response.ok && looksLikeXml, {
      url: result.response.url,
      status_code: result.response.status,
      content_type: contentType,
      declared_in_robots: declaredSitemaps.includes(url),
    });
  }));
  const sitemap = sitemapResults.find(result => result.state === 'measured' && result.present)
    || sitemapResults.find(result => result.state === 'measured')
    || sitemapResults[0]
    || unmeasured('no-candidates');

  const llmsTxt = !llmsResult.ok
    ? unmeasured(llmsResult.error, { url: `${origin}/llms.txt` })
    : measured(llmsResult.response.ok && llmsResult.text.trim().length > 0, {
        url: llmsResult.response.url,
        status_code: llmsResult.response.status,
        content_type: llmsResult.response.headers.get('content-type') || '',
      });

  const security = !homepageResult.ok
    ? { state: 'unmeasured', error: homepageResult.error, headers: null }
    : {
        state: 'measured',
        status_code: homepageResult.response.status,
        url: homepageResult.response.url,
        headers: securityHeaders(homepageResult.response.headers),
      };

  const states = [robots.state, sitemap.state, llmsTxt.state, security.state];
  return {
    state: states.every(state => state === 'measured') ? 'measured'
      : states.some(state => state === 'measured') ? 'partial' : 'unmeasured',
    robots,
    sitemap,
    llms_txt: llmsTxt,
    security,
  };
}

module.exports = {
  collectSiteSignals,
  isRootAllowed,
  parseRobotsTxt,
  securityHeaders,
};
