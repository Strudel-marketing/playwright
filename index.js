const express = require('express');
const app = express();
const port = 3000;
const { auditPage } = require('./seo-audit');

app.use(express.json());

app.get('/health', (req, res) => {
  res.send('OK');
});

app.post('/api/seo/audit', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  try {
    const result = await auditPage(url);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => console.log(`SEO Audit API listening on port ${port}`));
