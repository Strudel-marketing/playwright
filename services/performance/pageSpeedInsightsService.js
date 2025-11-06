const rateLimiter = require('../../utils/psiRateLimiter');

/**
 * PageSpeed Insights API Service
 * Uses Google's official PageSpeed Insights API for accurate performance metrics
 */

const PSI_API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Run PageSpeed Insights analysis using Google's API
 * @param {string} url - The URL to analyze
 * @param {Object} options - Configuration options
 * @returns {Object} PageSpeed Insights analysis results
 */
async function runPageSpeedInsights(url, options = {}) {
    // Check rate limit
    const rateLimitCheck = rateLimiter.recordRequest();

    if (!rateLimitCheck.success) {
        return {
            success: false,
            error: rateLimitCheck.error,
            rateLimitInfo: {
                remaining: rateLimitCheck.remaining,
                resetTime: rateLimitCheck.resetTime,
                resetDate: rateLimitCheck.resetDate
            },
            url
        };
    }

    // Check if API key is configured
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: 'Google PageSpeed Insights API key not configured. Please set GOOGLE_PAGESPEED_API_KEY in .env file',
            url,
            rateLimitInfo: {
                remaining: rateLimitCheck.remaining,
                resetTime: rateLimitCheck.resetTime
            }
        };
    }

    try {
        // Build API URL with parameters
        const strategy = options.strategy || options.device || 'mobile'; // mobile or desktop
        const categories = options.categories || ['performance', 'accessibility', 'best-practices', 'seo'];

        // Build query parameters
        const params = new URLSearchParams({
            url: url,
            key: apiKey,
            strategy: strategy === 'desktop' ? 'desktop' : 'mobile'
        });

        // Add categories
        categories.forEach(category => {
            params.append('category', category.toUpperCase().replace('-', '_'));
        });

        // Add locale if specified
        if (options.locale) {
            params.append('locale', options.locale);
        }

        const apiUrl = `${PSI_API_BASE}?${params.toString()}`;

        console.log(`🚀 Running PageSpeed Insights API for: ${url} (${strategy})`);
        console.log(`📊 Remaining PSI requests today: ${rateLimitCheck.remaining}`);

        // Make API request
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`PageSpeed Insights API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const psiResult = await response.json();

        // Extract data from PSI response
        const lighthouseResult = psiResult.lighthouseResult;
        const loadingExperience = psiResult.loadingExperience;
        const originLoadingExperience = psiResult.originLoadingExperience;

        if (!lighthouseResult) {
            throw new Error('Invalid PageSpeed Insights API response: missing lighthouseResult');
        }

        const { categories: lhrCategories, audits } = lighthouseResult;

        // Build result object
        const result = {
            success: true,
            source: 'PageSpeed Insights API',
            url: lighthouseResult.finalUrl || url,
            requestedUrl: url,
            strategy: strategy,
            timestamp: new Date().toISOString(),
            fetchTime: lighthouseResult.fetchTime,

            // Lab Data (Lighthouse scores)
            labData: {
                scores: {
                    performance: Math.round((lhrCategories.performance?.score || 0) * 100),
                    accessibility: Math.round((lhrCategories.accessibility?.score || 0) * 100),
                    bestPractices: Math.round((lhrCategories['best-practices']?.score || 0) * 100),
                    seo: Math.round((lhrCategories.seo?.score || 0) * 100),
                    pwa: lhrCategories.pwa ? Math.round((lhrCategories.pwa.score || 0) * 100) : null
                },
                metrics: {
                    firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
                    largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
                    cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
                    speedIndex: audits['speed-index']?.numericValue,
                    totalBlockingTime: audits['total-blocking-time']?.numericValue,
                    timeToInteractive: audits['interactive']?.numericValue,
                    maxPotentialFID: audits['max-potential-fid']?.numericValue
                },
                metricsDisplayValues: {
                    firstContentfulPaint: audits['first-contentful-paint']?.displayValue,
                    largestContentfulPaint: audits['largest-contentful-paint']?.displayValue,
                    cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue,
                    speedIndex: audits['speed-index']?.displayValue,
                    totalBlockingTime: audits['total-blocking-time']?.displayValue,
                    timeToInteractive: audits['interactive']?.displayValue,
                    maxPotentialFID: audits['max-potential-fid']?.displayValue
                }
            },

            // Field Data (Real User Metrics from CrUX)
            fieldData: null,
            originFieldData: null,

            // Rate limit info
            rateLimitInfo: {
                remaining: rateLimitCheck.remaining,
                used: rateLimitCheck.used,
                limit: rateLimitCheck.limit,
                resetTime: rateLimitCheck.resetTime
            }
        };

        // Add field data if available (28-day real user data from Chrome UX Report)
        if (loadingExperience && loadingExperience.metrics) {
            result.fieldData = {
                id: loadingExperience.id,
                overallCategory: loadingExperience.overall_category,
                metrics: parseFieldMetrics(loadingExperience.metrics)
            };
        }

        // Add origin field data if available
        if (originLoadingExperience && originLoadingExperience.metrics) {
            result.originFieldData = {
                id: originLoadingExperience.id,
                overallCategory: originLoadingExperience.overall_category,
                metrics: parseFieldMetrics(originLoadingExperience.metrics)
            };
        }

        // Add selected audits with opportunities
        const opportunities = [];
        const diagnostics = [];

        Object.entries(audits).forEach(([key, audit]) => {
            if (audit.details && audit.details.type === 'opportunity' && audit.score !== null && audit.score < 1) {
                opportunities.push({
                    id: key,
                    title: audit.title,
                    description: audit.description,
                    score: audit.score,
                    displayValue: audit.displayValue,
                    numericValue: audit.numericValue
                });
            } else if (audit.details && audit.details.type === 'diagnostic' && audit.score !== null && audit.score < 1) {
                diagnostics.push({
                    id: key,
                    title: audit.title,
                    description: audit.description,
                    score: audit.score,
                    displayValue: audit.displayValue
                });
            }
        });

        result.labData.opportunities = opportunities;
        result.labData.diagnostics = diagnostics;

        console.log(`✅ PageSpeed Insights analysis completed for: ${url}`);
        console.log(`   Performance Score: ${result.labData.scores.performance}/100`);
        console.log(`   LCP: ${result.labData.metricsDisplayValues.largestContentfulPaint}`);
        console.log(`   Has Field Data: ${result.fieldData ? 'Yes' : 'No'}`);

        return result;

    } catch (error) {
        console.error('❌ PageSpeed Insights API error:', error.message);

        return {
            success: false,
            error: `PageSpeed Insights API failed: ${error.message}`,
            url,
            rateLimitInfo: {
                remaining: rateLimitCheck.remaining,
                resetTime: rateLimitCheck.resetTime
            }
        };
    }
}

/**
 * Parse field metrics from CrUX data
 */
function parseFieldMetrics(metrics) {
    const parsed = {};

    for (const [key, data] of Object.entries(metrics)) {
        parsed[key] = {
            percentile: data.percentile,
            distributions: data.distributions,
            category: data.category
        };
    }

    return parsed;
}

/**
 * Run performance analysis only
 */
async function runPerformanceOnly(url, options = {}) {
    return runPageSpeedInsights(url, {
        ...options,
        categories: ['performance']
    });
}

/**
 * Run full audit (all categories)
 */
async function runFullAudit(url, options = {}) {
    return runPageSpeedInsights(url, {
        ...options,
        categories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa']
    });
}

/**
 * Run analysis for both mobile and desktop
 */
async function runBothStrategies(url, options = {}) {
    console.log(`🔄 Running PageSpeed Insights for both mobile and desktop: ${url}`);

    const [mobileResult, desktopResult] = await Promise.all([
        runPageSpeedInsights(url, { ...options, strategy: 'mobile' }),
        runPageSpeedInsights(url, { ...options, strategy: 'desktop' })
    ]);

    return {
        success: mobileResult.success && desktopResult.success,
        url,
        mobile: mobileResult,
        desktop: desktopResult,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    runPageSpeedInsights,
    runPerformanceOnly,
    runFullAudit,
    runBothStrategies
};
