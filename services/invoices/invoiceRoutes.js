const express = require('express');
const router = express.Router();
const invoiceService = require('./invoiceService');
const store = require('./invoiceStore');
const scheduler = require('./invoiceScheduler');

// --- Site Configuration CRUD ---

router.get('/sites', async (req, res) => {
  try {
    const sites = await store.getSites();
    res.json({ success: true, sites });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sites/:id', async (req, res) => {
  try {
    const sites = await store.getSites();
    const site = sites.find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site not found' });
    res.json({ success: true, site });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sites', async (req, res) => {
  try {
    const site = req.body;
    if (!site.name) return res.status(400).json({ success: false, error: 'Site name is required' });
    if (!site.url && !site.loginUrl) return res.status(400).json({ success: false, error: 'URL or loginUrl is required' });

    const saved = await store.saveSite(site);
    // Reload scheduler if schedule changed
    if (site.schedule) await scheduler.reloadAll();
    res.json({ success: true, site: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/sites/:id', async (req, res) => {
  try {
    const site = { ...req.body, id: req.params.id };
    const saved = await store.saveSite(site);
    if (site.schedule) await scheduler.reloadAll();
    res.json({ success: true, site: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/sites/:id', async (req, res) => {
  try {
    const deleted = await store.deleteSite(req.params.id);
    scheduler.unscheduleSite(req.params.id);
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Run / Test ---

router.post('/sites/:id/run', async (req, res) => {
  try {
    const result = await invoiceService.runSite(req.params.id);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sites/:id/test', async (req, res) => {
  try {
    const site = await store.getSite(req.params.id);
    if (!site) return res.status(404).json({ success: false, error: 'Site not found' });
    const result = await invoiceService.testSite(site);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test with inline config (no save needed)
router.post('/test', async (req, res) => {
  try {
    const site = req.body;
    if (!site.url && !site.loginUrl) return res.status(400).json({ success: false, error: 'URL is required' });
    site.id = site.id || 'test_temp';
    site.name = site.name || 'Test';
    const result = await invoiceService.testSite(site);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze a URL - detect forms, download links, suggest selectors
router.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });
    const analysis = await invoiceService.analyzePage(url);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run with inline config
router.post('/run', async (req, res) => {
  try {
    const site = req.body;
    if (!site.url && !site.loginUrl) return res.status(400).json({ success: false, error: 'URL is required' });
    site.id = site.id || `adhoc_${Date.now()}`;
    site.name = site.name || 'Ad-hoc Run';
    const result = await invoiceService.executeFlow(site);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Downloads ---

router.get('/sites/:id/downloads', async (req, res) => {
  try {
    const files = await invoiceService.listDownloads(req.params.id);
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sites/:id/downloads/:filename', async (req, res) => {
  try {
    const file = await invoiceService.getDownloadFile(req.params.id, req.params.filename);
    const buf = Buffer.from(file.data, 'base64');
    const ext = req.params.filename.split('.').pop().toLowerCase();
    const mimeTypes = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', xls: 'application/vnd.ms-excel' };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.send(buf);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- History ---

router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await store.getHistory(limit);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Scheduler ---

router.get('/scheduler/status', async (req, res) => {
  res.json({ success: true, scheduler: scheduler.getStatus() });
});

router.post('/scheduler/reload', async (req, res) => {
  try {
    await scheduler.reloadAll();
    res.json({ success: true, scheduler: scheduler.getStatus() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
