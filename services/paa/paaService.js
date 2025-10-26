const browserPool = require('../../utils/browserPool');

// Rate limiting map
const lastPAARequest = new Map();

// Utility delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extract People Also Ask questions from Google search
 * @param {string} query - Search query
 * @param {string} clientIP - Client IP for rate limiting
 * @returns {Object} PAA results
 */
async function extractPAAQuestions(query, clientIP) {
    // Rate limiting check
    const lastRequest = lastPAARequest.get(clientIP);
    const now = Date.now();
    
    if (lastRequest && (now - lastRequest) < 30000) {
        throw new Error(`Rate limit: Please wait ${Math.ceil((30000 - (now - lastRequest)) / 1000)} seconds`);
    }

    lastPAARequest.set(clientIP, now);

    console.log(`🔍 PAA Search for: "${query}" from IP: ${clientIP}`);

    // ✅ FIXED: Use browserPool instead of creating own browser
    const { page, context, safeNavigate } = await browserPool.acquire({
        locale: 'he-IL',
        timezoneId: 'Asia/Jerusalem',
        extraHTTPHeaders: {
            'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive'
        }
    });

    try {
        // Navigate to Google search using safeNavigate
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=he&gl=IL`;
        
        // ✅ FIXED: Use safeNavigate (with built-in delays and rate limiting)
        await safeNavigate(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for potential PAA elements to load
        await delay(3000);

        // Try multiple PAA selectors (Google changes them frequently)
        const paaSelectors = [
            '[jsname="N760b"]', // Common PAA selector
            '[data-initq]', // Alternative PAA selector
            '.related-question-pair', // Another variant
            '.g[data-initq]', // Yet another variant
            '[jsaction*="expand"]' // Expandable questions
        ];

        let paaQuestions = [];

        for (const selector of paaSelectors) {
            try {
                const questions = await page.evaluate((sel) => {
                    const elements = document.querySelectorAll(sel);
                    const questions = [];
                    
                    elements.forEach(element => {
                        // Try different text extraction methods
                        let questionText = '';
                        
                        if (element.textContent) {
                            questionText = element.textContent.trim();
                        } else if (element.innerText) {
                            questionText = element.innerText.trim();
                        }
                        
                        // Filter out non-question text and duplicates
                        if (questionText && 
                            questionText.length > 10 && 
                            questionText.length < 200 &&
                            (questionText.includes('?') || 
                             questionText.includes('מה') || 
                             questionText.includes('איך') || 
                             questionText.includes('למה') ||
                             questionText.includes('What') ||
                             questionText.includes('How') ||
                             questionText.includes('Why'))) {
                            questions.push(questionText);
                        }
                    });
                    
                    return [...new Set(questions)]; // Remove duplicates
                }, selector);

                if (questions.length > 0) {
                    paaQuestions = [...paaQuestions, ...questions];
                }
            } catch (e) {
                console.warn(`Selector ${selector} failed:`, e.message);
            }
        }

        // Remove duplicates and clean results
        paaQuestions = [...new Set(paaQuestions)]
            .filter(q => q.length > 5 && q.length < 300)
            .slice(0, 10); // Limit to 10 questions

        console.log(`✅ Found ${paaQuestions.length} PAA questions for "${query}"`);

        if (paaQuestions.length === 0) {
            // If no PAA found, check if we're blocked
            const pageTitle = await page.title();
            const pageContent = await page.content();
            
            if (pageTitle.includes('unusual traffic') || 
                pageContent.includes('detected unusual traffic') ||
                pageContent.includes('captcha')) {
                console.warn('🚨 Detected blocking/captcha');
                throw new Error('Google has temporarily blocked this IP. Please try again later.');
            }
        }

        return {
            success: true,
            query: query,
            questions: paaQuestions,
            count: paaQuestions.length,
            timestamp: new Date().toISOString(),
            source: 'google',
            language: 'he-IL'
        };

    } catch (error) {
        throw error;
    } finally {
        // ✅ FIXED: Use releasePageObject to properly clean up
        await browserPool.releasePageObject({ page, context });
    }
}

/**
 * Extract PAA questions from Bing search
 * @param {string} query - Search query
 * @param {string} clientIP - Client IP for rate limiting
 * @param {boolean} debug - Enable debug mode
 * @returns {Object} PAA results from Bing
 */
async function extractBingPAAQuestions(query, clientIP, debug = false) {
    // Rate limiting check
    const lastRequest = lastPAARequest.get(clientIP + '_bing');
    const now = Date.now();
    
    if (lastRequest && (now - lastRequest) < 30000) {
        throw new Error(`Rate limit: Please wait ${Math.ceil((30000 - (now - lastRequest)) / 1000)} seconds`);
    }

    lastPAARequest.set(clientIP + '_bing', now);

    console.log(`🔍 Bing PAA Search for: "${query}" from IP: ${clientIP}`);

    // ✅ FIXED: Use browserPool instead of creating own browser
    const { page, context, safeNavigate } = await browserPool.acquire({
        locale: 'he-IL',
        timezoneId: 'Asia/Jerusalem'
    });

    try {
        // Navigate to Bing search using safeNavigate
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=he&cc=IL`;
        
        // ✅ FIXED: Use safeNavigate (with built-in delays and rate limiting)
        await safeNavigate(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await delay(2000);

        // Bing PAA selectors
        const bingSelectors = [
            '.b_rs', // Related searches
            '.b_algo .b_title', // Search results titles
            '[data-tag="RelatedSearches"] a', // Related searches links
            '.b_pag a' // Pagination suggestions
        ];

        let paaQuestions = [];

        for (const selector of bingSelectors) {
            try {
                const questions = await page.evaluate((sel) => {
                    const elements = document.querySelectorAll(sel);
                    const questions = [];
                    
                    elements.forEach(element => {
                        let questionText = element.textContent?.trim() || element.innerText?.trim() || '';
                        
                        if (questionText && 
                            questionText.length > 10 && 
                            questionText.length < 200) {
                            questions.push(questionText);
                        }
                    });
                    
                    return [...new Set(questions)];
                }, selector);

                if (questions.length > 0) {
                    paaQuestions = [...paaQuestions, ...questions];
                }
            } catch (e) {
                console.warn(`Bing selector ${selector} failed:`, e.message);
            }
        }

        // Clean and deduplicate results
        paaQuestions = [...new Set(paaQuestions)]
            .filter(q => q.length > 5 && q.length < 300)
            .slice(0, 10);

        console.log(`✅ Found ${paaQuestions.length} Bing PAA questions for "${query}"`);

        return {
            success: true,
            query: query,
            questions: paaQuestions,
            count: paaQuestions.length,
            timestamp: new Date().toISOString(),
            source: 'bing',
            language: 'he-IL',
            debug: debug
        };

    } catch (error) {
        throw error;
    } finally {
        // ✅ FIXED: Use releasePageObject to properly clean up
        await browserPool.releasePageObject({ page, context });
    }
}

/**
 * Get PAA service status
 * @returns {Object} Service status
 */
function getPAAStatus() {
    return {
        success: true,
        service: 'PAA Extraction Service',
        status: 'active',
        features: [
            'google-paa-extraction',
            'bing-paa-extraction',
            'rate-limiting',
            'anti-detection',
            'hebrew-support',
            'browser-pool-integration'
        ],
        rateLimits: {
            google: '30 seconds between requests',
            bing: '30 seconds between requests'
        },
        activeRequests: lastPAARequest.size,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    extractPAAQuestions,
    extractBingPAAQuestions,
    getPAAStatus
};
