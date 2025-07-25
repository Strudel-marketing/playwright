const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Try to load dotenv with error handling
try {
    require('dotenv').config();
    console.log('✅ dotenv loaded successfully');
} catch (error) {
    console.log('⚠️ dotenv not found, continuing without it:', error.message);
}

// Import service routes
const seoRoutes = require('./services/seo/seoRoutes');
const schemaRoutes = require('./services/schema/schemaRoutes');
const screenshotRoutes = require('./services/screenshots/screenshotRoutes');
const automationRoutes = require('./services/automation/automationRoutes');
const compareRoutes = require('./services/comparison/compareRoutes');
const paaRoutes = require('./services/paa/paaRoutes');
const performanceRoutes = require('./services/performance/performanceRoutes');
const knowledgeRoutes = require('./services/knowledge/knowledgeRoutes');

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
    res.status(200).send('OK');
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({ status: 'healthy' });
});

// Connect service routes
app.use('/api/seo', seoRoutes);
app.use('/api/extract', schemaRoutes);
app.use('/api/screenshot', screenshotRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/paa', paaRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Playwright Web Services API running on port ${PORT}`);
    console.log(`📊 SEO Analysis: http://localhost:${PORT}/api/seo/audit`);
    console.log(`🔍 Schema Extraction: http://localhost:${PORT}/api/extract/schema`);
    console.log(`📸 Screenshots: http://localhost:${PORT}/api/screenshot`);
    console.log(`🤖 Automation: http://localhost:${PORT}/api/automation`);
    console.log(`⚖️ Comparison: http://localhost:${PORT}/api/compare`);
    console.log(`❓ PAA: http://localhost:${PORT}/api/paa`);
    console.log(`🏥 Performance: http://localhost:${PORT}/api/performance`);
    console.log(`🧠 Knowledge Graph: http://localhost:${PORT}/api/knowledge`);
    console.log(`💚 Health Check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    await browserPool.cleanup();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    await browserPool.cleanup();
    process.exit(0);
});
