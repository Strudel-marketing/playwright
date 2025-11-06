/**
 * Rate Limiter for PageSpeed Insights API
 * Prevents exceeding daily quota limit (default: 10,000 requests/day)
 */

class PSIRateLimiter {
    constructor() {
        this.dailyLimit = parseInt(process.env.PSI_DAILY_LIMIT) || 10000;
        this.requests = [];
        this.resetTime = this.getNextMidnight();

        console.log(`📊 PSI Rate Limiter initialized with daily limit: ${this.dailyLimit}`);

        // Schedule daily reset
        this.scheduleReset();
    }

    /**
     * Get next midnight UTC timestamp
     */
    getNextMidnight() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }

    /**
     * Schedule daily reset at midnight UTC
     */
    scheduleReset() {
        const now = Date.now();
        const timeUntilReset = this.resetTime - now;

        setTimeout(() => {
            this.reset();
            // Schedule next reset
            this.scheduleReset();
        }, timeUntilReset);

        const resetDate = new Date(this.resetTime);
        console.log(`⏰ Next PSI rate limit reset scheduled for: ${resetDate.toISOString()}`);
    }

    /**
     * Reset the counter (called at midnight UTC)
     */
    reset() {
        const previousCount = this.requests.length;
        this.requests = [];
        this.resetTime = this.getNextMidnight();

        console.log(`🔄 PSI Rate Limiter reset. Previous 24h requests: ${previousCount}`);
    }

    /**
     * Clean up old requests (older than 24 hours)
     */
    cleanup() {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        const beforeCount = this.requests.length;
        this.requests = this.requests.filter(timestamp => timestamp > oneDayAgo);

        if (beforeCount !== this.requests.length) {
            console.log(`🧹 Cleaned ${beforeCount - this.requests.length} old PSI requests`);
        }
    }

    /**
     * Check if request can be made
     * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
     */
    checkLimit() {
        // Clean up old requests
        this.cleanup();

        const currentCount = this.requests.length;
        const remaining = Math.max(0, this.dailyLimit - currentCount);
        const allowed = currentCount < this.dailyLimit;

        return {
            allowed,
            remaining,
            resetTime: this.resetTime,
            currentCount,
            limit: this.dailyLimit
        };
    }

    /**
     * Record a new request
     * @returns {Object} { success: boolean, remaining: number, resetTime: number }
     */
    recordRequest() {
        const check = this.checkLimit();

        if (!check.allowed) {
            console.warn(`⚠️ PSI Rate Limit exceeded! ${check.currentCount}/${this.dailyLimit} requests used.`);
            return {
                success: false,
                error: 'Daily PageSpeed Insights API limit exceeded',
                remaining: 0,
                resetTime: this.resetTime,
                resetDate: new Date(this.resetTime).toISOString()
            };
        }

        // Record the request
        this.requests.push(Date.now());

        const newRemaining = check.remaining - 1;

        // Log warning if approaching limit
        if (newRemaining <= 100) {
            console.warn(`⚠️ PSI Rate Limit approaching: ${newRemaining} requests remaining`);
        } else if (newRemaining % 1000 === 0) {
            console.log(`📊 PSI requests remaining today: ${newRemaining}`);
        }

        return {
            success: true,
            remaining: newRemaining,
            resetTime: this.resetTime,
            used: this.requests.length,
            limit: this.dailyLimit
        };
    }

    /**
     * Get current status
     */
    getStatus() {
        this.cleanup();

        const currentCount = this.requests.length;
        const remaining = Math.max(0, this.dailyLimit - currentCount);

        return {
            used: currentCount,
            remaining,
            limit: this.dailyLimit,
            resetTime: this.resetTime,
            resetDate: new Date(this.resetTime).toISOString(),
            utilizationPercent: Math.round((currentCount / this.dailyLimit) * 100)
        };
    }
}

// Singleton instance
const rateLimiter = new PSIRateLimiter();

module.exports = rateLimiter;
