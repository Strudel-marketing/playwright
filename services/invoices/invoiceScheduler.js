const store = require('./invoiceStore');
const invoiceService = require('./invoiceService');

class InvoiceScheduler {
  constructor() {
    this.jobs = new Map(); // siteId -> intervalId
    this.running = false;
  }

  /**
   * Start the scheduler - loads all sites and schedules active ones
   */
  async start() {
    if (this.running) return;
    this.running = true;
    console.log('Invoice scheduler started');
    await this.reloadAll();
  }

  /**
   * Reload all scheduled jobs from store
   */
  async reloadAll() {
    // Clear existing jobs
    this.stopAll();

    const sites = await store.getSitesRaw();
    for (const site of sites) {
      if (site.schedule && site.schedule.enabled) {
        this.scheduleSite(site);
      }
    }
  }

  /**
   * Schedule a site using simple interval-based scheduling
   * schedule.intervalHours - run every N hours
   * schedule.dayOfMonth - run on specific day of month (1-28)
   * schedule.time - preferred time "HH:MM" (used for daily/monthly)
   */
  scheduleSite(site) {
    if (this.jobs.has(site.id)) {
      clearInterval(this.jobs.get(site.id));
    }

    const schedule = site.schedule;
    if (!schedule || !schedule.enabled) return;

    if (schedule.intervalHours) {
      // Simple interval: run every N hours
      const ms = schedule.intervalHours * 60 * 60 * 1000;
      const intervalId = setInterval(() => this._runSite(site.id), ms);
      this.jobs.set(site.id, intervalId);
      console.log(`Scheduled ${site.name} (${site.id}) every ${schedule.intervalHours}h`);
    } else if (schedule.dayOfMonth) {
      // Monthly: check every hour if it's the right day and time
      const intervalId = setInterval(() => {
        const now = new Date();
        const targetDay = schedule.dayOfMonth;
        const [targetHour] = (schedule.time || '09:00').split(':').map(Number);
        if (now.getDate() === targetDay && now.getHours() === targetHour && now.getMinutes() < 5) {
          this._runSite(site.id);
        }
      }, 5 * 60 * 1000); // Check every 5 minutes
      this.jobs.set(site.id, intervalId);
      console.log(`Scheduled ${site.name} (${site.id}) on day ${schedule.dayOfMonth} at ${schedule.time || '09:00'}`);
    } else if (schedule.time) {
      // Daily at specific time
      const intervalId = setInterval(() => {
        const now = new Date();
        const [targetHour, targetMin] = schedule.time.split(':').map(Number);
        if (now.getHours() === targetHour && now.getMinutes() >= targetMin && now.getMinutes() < targetMin + 5) {
          this._runSite(site.id);
        }
      }, 5 * 60 * 1000);
      this.jobs.set(site.id, intervalId);
      console.log(`Scheduled ${site.name} (${site.id}) daily at ${schedule.time}`);
    }
  }

  async _runSite(siteId) {
    console.log(`Scheduler: running invoice download for ${siteId}`);
    try {
      await invoiceService.runSite(siteId);
      console.log(`Scheduler: completed ${siteId}`);
    } catch (error) {
      console.error(`Scheduler: failed ${siteId}:`, error.message);
    }
  }

  /**
   * Remove schedule for a site
   */
  unscheduleSite(siteId) {
    if (this.jobs.has(siteId)) {
      clearInterval(this.jobs.get(siteId));
      this.jobs.delete(siteId);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    for (const [id, intervalId] of this.jobs) {
      clearInterval(intervalId);
    }
    this.jobs.clear();
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus() {
    return {
      running: this.running,
      scheduledSites: Array.from(this.jobs.keys()),
      count: this.jobs.size
    };
  }
}

module.exports = new InvoiceScheduler();
