const express = require('express');
const bodyParser = require('body-parser');
const runSeoAudit = require('./seo-audit');

const app = express();
app.use(bodyParser.json());

app.post('/api/seo/audit', async (req, res) => {
    const { url, options } = req.body;
    try {
        const result = await runSeoAudit(url, options);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(3000, () => console.log('SEO Audit API running on port 3000'));