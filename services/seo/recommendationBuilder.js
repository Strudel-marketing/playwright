/**
 * Recommendation Builder
 * בונה המלצות מפורטות ומועילות מתוך מאגר הידע
 */

const RECOMMENDATIONS = require('./seoRecommendations');

/**
 * Build detailed recommendation from knowledge base
 */
function buildRecommendation(type, context = {}) {
  const base = RECOMMENDATIONS[type];

  if (!base) {
    // Fallback for unknown types
    return {
      issue: context.issue || type,
      priority: 'medium',
      category: 'unknown'
    };
  }

  const recommendation = {
    ...base,
    context: context // Additional context-specific info
  };

  // Add specific measurements to the issue
  if (context.measurement) {
    recommendation.issue = `${base.issue} (${context.measurement})`;
  }

  return recommendation;
}

/**
 * Build comprehensive category recommendations
 */
function buildCategoryRecommendations(category, issues, context = {}) {
  const recommendations = [];
  const quickWins = [];
  const longTerm = [];

  issues.forEach(issueKey => {
    const rec = buildRecommendation(issueKey, context[issueKey] || {});
    recommendations.push(rec);

    // Categorize by effort
    if (rec.category === 'quick-win') {
      quickWins.push({
        issue: rec.issue,
        howToFix: rec.howToFix,
        priority: rec.priority
      });
    } else if (rec.category === 'long-term') {
      longTerm.push({
        issue: rec.issue,
        why: rec.why,
        priority: rec.priority
      });
    }
  });

  return {
    all: recommendations,
    quickWins,
    longTerm,
    criticalCount: recommendations.filter(r => r.priority === 'critical').length,
    highCount: recommendations.filter(r => r.priority === 'high').length
  };
}

/**
 * Generate priority-sorted action plan
 */
function generateActionPlan(allRecommendations) {
  const critical = [];
  const high = [];
  const medium = [];
  const low = [];

  allRecommendations.forEach(rec => {
    const item = {
      issue: rec.issue,
      category: rec.category,
      impact: rec.impact,
      howToFix: rec.howToFix ? rec.howToFix.slice(0, 3) : [] // First 3 steps
    };

    switch (rec.priority) {
      case 'critical':
        critical.push(item);
        break;
      case 'high':
        high.push(item);
        break;
      case 'medium':
        medium.push(item);
        break;
      case 'low':
        low.push(item);
        break;
    }
  });

  return {
    critical,
    high,
    medium,
    low,
    summary: {
      total: allRecommendations.length,
      criticalCount: critical.length,
      highCount: high.length,
      mediumCount: medium.length,
      lowCount: low.length,
      quickWinCount: allRecommendations.filter(r => r.category === 'quick-win').length
    }
  };
}

/**
 * Get specific recommendation details
 */
function getRecommendationDetails(type) {
  return RECOMMENDATIONS[type] || null;
}

/**
 * Build simple issue text (for backward compatibility)
 */
function getSimpleIssue(type, context = {}) {
  const rec = RECOMMENDATIONS[type];
  if (!rec) return context.fallback || type;

  if (context.measurement) {
    return `${rec.issue} (${context.measurement})`;
  }

  return rec.issue;
}

module.exports = {
  buildRecommendation,
  buildCategoryRecommendations,
  generateActionPlan,
  getRecommendationDetails,
  getSimpleIssue,

  // Recommendation type constants
  TYPES: {
    // Basic
    MISSING_TITLE: 'MISSING_TITLE',
    TITLE_TOO_SHORT: 'TITLE_TOO_SHORT',
    TITLE_TOO_LONG: 'TITLE_TOO_LONG',
    MISSING_META_DESCRIPTION: 'MISSING_META_DESCRIPTION',
    META_DESC_TOO_SHORT: 'META_DESC_TOO_SHORT',
    META_DESC_TOO_LONG: 'META_DESC_TOO_LONG',

    // Technical
    NOT_HTTPS: 'NOT_HTTPS',
    MISSING_CANONICAL: 'MISSING_CANONICAL',
    MISSING_VIEWPORT: 'MISSING_VIEWPORT',
    MISSING_ROBOTS: 'MISSING_ROBOTS',
    MISSING_LANG: 'MISSING_LANG',

    // Content
    CONTENT_TOO_SHORT: 'CONTENT_TOO_SHORT',
    WEAK_KEYWORD_FOCUS: 'WEAK_KEYWORD_FOCUS',
    FEW_HEADINGS: 'FEW_HEADINGS',
    NO_INTERNAL_LINKS: 'NO_INTERNAL_LINKS',
    POOR_READABILITY: 'POOR_READABILITY',

    // Media
    MISSING_ALT_TEXT: 'MISSING_ALT_TEXT',
    NOT_RESPONSIVE: 'NOT_RESPONSIVE',
    SLOW_LOAD_TIME: 'SLOW_LOAD_TIME',
    LINKS_WITHOUT_TEXT: 'LINKS_WITHOUT_TEXT',

    // Structured
    NO_STRUCTURED_DATA: 'NO_STRUCTURED_DATA',
    WEAK_LLM_READINESS: 'WEAK_LLM_READINESS',
    MISSING_BREADCRUMB: 'MISSING_BREADCRUMB',

    // Social
    NO_OPEN_GRAPH: 'NO_OPEN_GRAPH',
    NO_OG_IMAGE: 'NO_OG_IMAGE'
  }
};
