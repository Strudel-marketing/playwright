const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import service routes
const seoRoutes = require('./services/seo/seoRoutes');
const schemaRoutes = require('./services/schema/schemaRoutes');
const screenshotRoutes = require('./services/screenshots/screenshotRoutes');
const automationRoutes = require('./services/automation/automationRoutes');
const compareRoutes = require('./services/comparison/compareRoutes');
const paaRoutes = require('./services/paa/paaRoutes');

// Import utilities
const browserPool = require('./utils/browserPool');
const { runLighthouse } = require('./utils/lighthouse');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Static files for screenshots
app.use('/screenshots', express.static('/app/screenshots', {
    maxAge: '7d',
    setHeaders: (res, path) => {
        res.setHeader('Content-Type', 'image/png');
    }
}));

// Health Check
app.get('/health', (req, res) => {
    res.json({
        State: { 
            Health: {
                Status: 'healthy'
            }
        }, 
        status: 'OK',
        service: 'Playwright Web Services API',
        version: '3.0.0',
        architecture: 'Modular Services',
        features: [
            'seo-analysis',
            'schema-extraction', 
            'structured-data',
            'screenshots',
            'automation',
            'comparison',
            'lighthouse-performance',
            'paa-extraction'
        ],
        endpoints: {
            seo: [
                'POST /api/seo/audit',
                'POST /api/seo/quick-check',
                'GET /api/seo/performance'
            ],
            extraction: [
                'POST /api/extract/quick-check',
                'POST /api/extract/schema'
            ],
            screenshots: [
                'POST /api/screenshot'
            ],
            automation: [
                'POST /api/automation/*'
            ],
            comparison: [
                'POST /api/compare/*'
            ],
            paa: [
                'POST /api/paa',
                'POST /api/paa/bing',
                'POST /api/paa/bing/debug',
                'POST /api/paa/debug',
                'GET /api/paa/status'
            ]
        },
        timestamp: new Date().toISOString()
    });
});

// Connect service routes
app.use('/api/seo', seoRoutes);
app.use('/api/extract', schemaRoutes);
app.use('/api/screenshot', screenshotRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/paa', paaRoutes);

{{ ... }}
