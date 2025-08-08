import express from 'express';
import { performSeoAudit } from '../seo/seoService.js';
import { summarizeContent } from './knowledgeService.js';

const router = express.Router();

/**
 * ביצוע SEO Audit ושמירת הידע
 */
router.post('/analyze', async (req, res) => {
  try {
    const { url, options } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL' });
    }

    const results = await performSeoAudit(url, options || {});
    return res.json(results);

  } catch (error) {
    console.error('❌ Error in /analyze:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * סיכום תוכן מהעמוד
 */
router.post('/summarize', async (req, res) => {
  try {
    const { url, language } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL' });
    }

    const summary = await summarizeContent(url, language || 'en');
    return res.json(summary);

  } catch (error) {
    console.error('❌ Error in /summarize:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
