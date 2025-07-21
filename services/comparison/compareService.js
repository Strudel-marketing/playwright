const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

class CompareService {
    async visualCompare(url1, url2, options = {}) {
        const browser = await chromium.launch();
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });

        try {
            // Take screenshot of first URL
            const page1 = await context.newPage();
            await page1.goto(url1, { waitUntil: 'networkidle' });
            const screenshot1 = await page1.screenshot({ fullPage: true });

            // Take screenshot of second URL
            const page2 = await context.newPage();
            await page2.goto(url2, { waitUntil: 'networkidle' });
            const screenshot2 = await page2.screenshot({ fullPage: true });

            // Compare screenshots
            const img1 = PNG.sync.read(screenshot1);
            const img2 = PNG.sync.read(screenshot2);
            
            const { width, height } = img1;
            const diff = new PNG({ width, height });

            const numDiffPixels = pixelmatch(
                img1.data, img2.data, diff.data, width, height,
                { threshold: 0.1 }
            );

            const diffPercentage = (numDiffPixels / (width * height)) * 100;

            return {
                success: true,
                comparison: {
                    url1,
                    url2,
                    diffPixels: numDiffPixels,
                    diffPercentage: diffPercentage.toFixed(2),
                    totalPixels: width * height,
                    dimensions: { width, height }
                },
                screenshots: {
                    original1: screenshot1.toString('base64'),
                    original2: screenshot2.toString('base64'),
                    diff: PNG.sync.write(diff).toString('base64')
                }
            };

        } finally {
            await browser.close();
        }
    }

    async performanceCompare(url1, url2) {
        const browser = await chromium.launch();
        
        try {
            const results = {};
            
            for (const [key, url] of Object.entries({ url1, url2 })) {
                const context = await browser.newContext();
                const page = await context.newPage();
                
                const startTime = Date.now();
                await page.goto(url, { waitUntil: 'networkidle' });
                const loadTime = Date.now() - startTime;
                
                const metrics = await page.evaluate(() => {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    return {
                        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
                    };
                });
                
                results[key] = {
                    url,
                    loadTime,
                    metrics
                };
                
                await context.close();
            }
            
            return {
                success: true,
                comparison: results,
                summary: {
                    fasterUrl: results.url1.loadTime < results.url2.loadTime ? results.url1.url : results.url2.url,
                    loadTimeDifference: Math.abs(results.url1.loadTime - results.url2.loadTime)
                }
            };
            
        } finally {
            await browser.close();
        }
    }

    /**
     * Advanced comparison between main URL and multiple competitor URLs
     * Focuses on content and schema analysis (no visual comparison)
     */
    async advancedCompare(mainUrl, competitorUrls, options = {}) {
        const browser = await chromium.launch();
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });

        try {
            console.log(`🔍 Starting advanced comparison for ${mainUrl} vs ${competitorUrls.length} competitors`);

            // Analyze main URL
            const mainPage = await context.newPage();
            await mainPage.goto(mainUrl, { waitUntil: 'networkidle' });
            const mainData = await this.extractPageData(mainPage, mainUrl);

            // Analyze competitor URLs
            const competitorData = [];
            for (const url of competitorUrls) {
                try {
                    const page = await context.newPage();
                    await page.goto(url, { waitUntil: 'networkidle' });
                    const data = await this.extractPageData(page, url);
                    competitorData.push(data);
                    await page.close();
                } catch (error) {
                    console.error(`Error analyzing ${url}:`, error.message);
                    competitorData.push({
                        url,
                        error: error.message,
                        success: false
                    });
                }
            }

            // Compare content and schemas
            const contentComparison = this.compareContent(mainData, competitorData);
            const schemaComparison = this.compareSchemas(mainData, competitorData);

            return {
                mainUrl,
                competitorUrls,
                analysis: {
                    main: mainData,
                    competitors: competitorData
                },
                comparisons: {
                    content: contentComparison,
                    schemas: schemaComparison
                },
                summary: this.generateComparisonSummary(mainData, competitorData)
            };

        } finally {
            await browser.close();
        }
    }

    /**
     * Extract comprehensive page data for comparison
     */
    async extractPageData(page, url) {
        try {
            const data = await page.evaluate(() => {
                // Extract JSON-LD schemas
                const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                const schemas = jsonLdScripts.map(script => {
                    try {
                        return JSON.parse(script.textContent);
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);

                // Extract content
                const title = document.title;
                const description = document.querySelector('meta[name="description"]')?.content || '';
                const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim());
                const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim());
                const h3s = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim());

                // Extract meta tags
                const metaTags = {};
                document.querySelectorAll('meta').forEach(meta => {
                    const name = meta.getAttribute('name') || meta.getAttribute('property');
                    const content = meta.getAttribute('content');
                    if (name && content) {
                        metaTags[name] = content;
                    }
                });

                // Extract text content
                const textContent = document.body.innerText.replace(/\s+/g, ' ').trim();
                const wordCount = textContent.split(' ').length;

                return {
                    title,
                    description,
                    headings: { h1s, h2s, h3s },
                    metaTags,
                    schemas,
                    textContent: textContent.substring(0, 1000), // First 1000 chars
                    wordCount,
                    schemaCount: schemas.length
                };
            });

            return {
                url,
                success: true,
                ...data
            };

        } catch (error) {
            return {
                url,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Compare content between main site and competitors
     */
    compareContent(mainData, competitorData) {
        const comparisons = competitorData.map(competitor => {
            if (!competitor.success) {
                return {
                    url: competitor.url,
                    error: competitor.error,
                    comparison: null
                };
            }

            // Title comparison
            const titleSimilarity = this.calculateTextSimilarity(mainData.title, competitor.title);
            
            // Description comparison
            const descSimilarity = this.calculateTextSimilarity(mainData.description, competitor.description);
            
            // Heading comparison
            const h1Similarity = this.calculateArraySimilarity(mainData.headings.h1s, competitor.headings.h1s);
            const h2Similarity = this.calculateArraySimilarity(mainData.headings.h2s, competitor.headings.h2s);
            
            // Word count comparison
            const wordCountDiff = Math.abs(mainData.wordCount - competitor.wordCount);
            const wordCountSimilarity = Math.max(0, 100 - (wordCountDiff / Math.max(mainData.wordCount, competitor.wordCount)) * 100);

            return {
                url: competitor.url,
                comparison: {
                    title: {
                        main: mainData.title,
                        competitor: competitor.title,
                        similarity: titleSimilarity
                    },
                    description: {
                        main: mainData.description,
                        competitor: competitor.description,
                        similarity: descSimilarity
                    },
                    headings: {
                        h1Similarity,
                        h2Similarity
                    },
                    wordCount: {
                        main: mainData.wordCount,
                        competitor: competitor.wordCount,
                        similarity: wordCountSimilarity
                    },
                    overallContentSimilarity: (titleSimilarity + descSimilarity + h1Similarity + wordCountSimilarity) / 4
                }
            };
        });

        return comparisons;
    }

    /**
     * Compare JSON-LD schemas between sites
     */
    compareSchemas(mainData, competitorData) {
        const mainSchemas = mainData.schemas || [];
        
        const comparisons = competitorData.map(competitor => {
            if (!competitor.success) {
                return {
                    url: competitor.url,
                    error: competitor.error,
                    schemaComparison: null
                };
            }

            const competitorSchemas = competitor.schemas || [];
            
            // Extract schema types
            const mainTypes = this.extractSchemaTypes(mainSchemas);
            const competitorTypes = this.extractSchemaTypes(competitorSchemas);
            
            // Find common and unique schema types
            const commonTypes = mainTypes.filter(type => competitorTypes.includes(type));
            const mainUniqueTypes = mainTypes.filter(type => !competitorTypes.includes(type));
            const competitorUniqueTypes = competitorTypes.filter(type => !mainTypes.includes(type));
            
            return {
                url: competitor.url,
                schemaComparison: {
                    mainSchemaCount: mainSchemas.length,
                    competitorSchemaCount: competitorSchemas.length,
                    mainTypes,
                    competitorTypes,
                    commonTypes,
                    mainUniqueTypes,
                    competitorUniqueTypes,
                    typeSimilarity: commonTypes.length / Math.max(mainTypes.length, competitorTypes.length, 1) * 100,
                    schemas: {
                        main: mainSchemas,
                        competitor: competitorSchemas
                    }
                }
            };
        });

        return comparisons;
    }

    /**
     * Extract schema types from JSON-LD data
     */
    extractSchemaTypes(schemas) {
        const types = new Set();
        
        schemas.forEach(schema => {
            if (schema['@type']) {
                if (Array.isArray(schema['@type'])) {
                    schema['@type'].forEach(type => types.add(type));
                } else {
                    types.add(schema['@type']);
                }
            }
            
            // Handle @graph structures
            if (schema['@graph']) {
                schema['@graph'].forEach(item => {
                    if (item['@type']) {
                        if (Array.isArray(item['@type'])) {
                            item['@type'].forEach(type => types.add(type));
                        } else {
                            types.add(item['@type']);
                        }
                    }
                });
            }
        });
        
        return Array.from(types);
    }

    /**
     * Calculate text similarity between two strings
     */
    calculateTextSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        
        const commonWords = words1.filter(word => words2.includes(word));
        const totalWords = new Set([...words1, ...words2]).size;
        
        return totalWords > 0 ? (commonWords.length / totalWords) * 100 : 0;
    }

    /**
     * Calculate similarity between two arrays
     */
    calculateArraySimilarity(arr1, arr2) {
        if (!arr1.length && !arr2.length) return 100;
        if (!arr1.length || !arr2.length) return 0;
        
        const common = arr1.filter(item => arr2.includes(item));
        const total = new Set([...arr1, ...arr2]).size;
        
        return total > 0 ? (common.length / total) * 100 : 0;
    }

    /**
     * Generate comparison summary
     */
    generateComparisonSummary(mainData, competitorData) {
        const successfulComparisons = competitorData.filter(c => c.success);
        
        return {
            totalCompetitors: competitorData.length,
            successfulAnalysis: successfulComparisons.length,
            failedAnalysis: competitorData.length - successfulComparisons.length,
            mainSiteSchemas: mainData.schemas?.length || 0,
            averageCompetitorSchemas: successfulComparisons.length > 0 
                ? Math.round(successfulComparisons.reduce((sum, c) => sum + (c.schemas?.length || 0), 0) / successfulComparisons.length)
                : 0
        };
    }
}

module.exports = new CompareService();
