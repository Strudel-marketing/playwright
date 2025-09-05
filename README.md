# 🎭 Playwright Universal Automation API

![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**The most comprehensive Playwright-based automation service** - combining advanced SEO analysis, structured data extraction, site comparison, and universal automation capabilities.

## 🌟 Core Features

### 🔍 **Comprehensive SEO Analysis**
- **15+ SEO Parameters** - Title, meta, headings, images, links
- **Performance Metrics** - Load time, Core Web Vitals, FCP
- **Technical SEO** - HTTPS, canonical, viewport, language
- **Content Analysis** - Word count, reading time, structure
- **Mobile Optimization** - Responsive design detection
- **Accessibility Checks** - Alt text, semantic HTML
- **Social Media Ready** - Open Graph, Twitter Cards
- **Score & Recommendations** - 0-100 score with actionable advice

### 📊 **Structured Data Extraction** 
- **JSON-LD Parsing** - Schema.org structured data
- **Microdata Extraction** - HTML5 microdata parsing
- **Open Graph Meta** - Social media optimization tags
- **Twitter Cards** - Twitter-specific meta tags  
- **Product Data** - E-commerce product information
- **SEO Meta Analysis** - All meta tags and canonical URLs
- **Quick Schema Check** - Fast structured data validation

### 📸 **Advanced Screenshots**
- **Full Page Capture** - Complete page screenshots
- **Element-Specific** - Target specific CSS selectors
- **Multiple Viewports** - Desktop, tablet, mobile sizes
- **Popup Blocking** - Automatic popup handling
- **High Quality** - PNG/JPEG format with customizable options
- **Manual Upload** - Upload your own screenshots for automation use
- **Stealth Mode** - Anti-bot detection bypass
- **Persistent Storage** - Images saved with volume mapping

### ⚖️ **Site Comparison**
- **Multi-Site Analysis** - Compare up to 10 sites simultaneously
- **Custom Data Extraction** - Define your own CSS selectors
- **Visual Comparison** - Optional screenshots for each site
- **Competitive Analysis** - Perfect for competitor research
- **Price Monitoring** - Extract and compare pricing data

### 🌐 **Universal Automation** (Framework Ready)
- **Config-Based Sites** - Add any website with JSON config
- **Authentication Support** - Handle login flows automatically
- **Document Downloads** - PDF, Excel, CSV with auto-detection
- **Data Workflows** - Multi-step automation sequences
- **Custom Extractors** - Site-specific data extraction

## 🚀 Quick Start

### Docker Deployment (Recommended)

```bash
# Clone repository
git clone https://github.com/Strudel-marketing/playwright.git
cd playwright

# Build and run
docker build -t playwright-universal .
docker run -p 3000:3000 playwright-universal
```

### Local Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Start development server
npm run dev
```

## 📡 API Endpoints

### 🏥 Health Check
```bash
GET /health
```
**Response includes**: Service status, version, available features

### 🔍 Comprehensive SEO Analysis
```bash
POST /api/seo/audit
{
  "url": "https://example.com",
  "includeScreenshot": true,
  "detailed": true
}
```

**Analyzes 15+ SEO factors:**
- ✅ Title optimization (length, keywords)
- ✅ Meta description (length, presence)  
- ✅ Heading structure (H1-H6 analysis)
- ✅ Image optimization (alt text, sizing)
- ✅ Link analysis (internal/external, nofollow)
- ✅ Performance metrics (load time, FCP)
- ✅ Mobile responsiveness
- ✅ Technical SEO (HTTPS, canonical, charset)
- ✅ Social media meta tags
- ✅ Structured data presence
- ✅ Content analysis (word count, reading time)
- ✅ Form analysis and accessibility

### 📊 Schema Extraction
```bash
POST /api/extract/schema
{
  "url": "https://example.com",
  "options": {
    "includeTables": true
  }
}
```

### ⚡ Quick Schema Check
```bash
POST /api/extract/quick-check
{
  "url": "https://example.com"
}
```

### 📸 Advanced Screenshots

#### Capture Screenshot
```bash
POST /api/screenshot/capture
{
  "url": "https://example.com",
  "options": {
    "fullPage": true,
    "viewport": {"width": 1920, "height": 1080},
    "selector": ".main-content",
    "blockPopups": true,
    "stealthMode": true
  }
}
```

#### Upload Screenshot
```bash
POST /api/screenshot/upload
Content-Type: multipart/form-data

# Form fields:
# - screenshot: image file (required)
# - description: text description (optional)
```

#### List Screenshots
```bash
GET /api/screenshot/list
```

### ⚖️ Site Comparison
```bash
POST /api/compare
{
  "urls": ["https://site1.com", "https://site2.com"],
  "selectors": {
    "price": ".price",
    "title": "h1",
    "rating": ".rating"
  },
  "includeScreenshots": true
}
```

### 📥 Document Downloads
```bash
POST /api/download
{
  "url": "https://example.com/documents",
  "downloadSelector": ".download-btn",
  "credentials": {
    "loginUrl": "https://example.com/login",
    "email": "user@example.com",
    "password": "password123"
  }
}
```

### 🌐 Universal Automation
```bash
POST /api/universal/{site}/{action}
{
  "credentials": {...},
  "dataType": "invoices",
  "filters": {...}
}
```

## 💡 Detailed Usage Examples

### Complete SEO Audit with Analysis
```bash
curl -X POST http://localhost:3000/api/seo/audit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-website.com",
    "includeScreenshot": true,
    "detailed": true
  }' | jq '.'
```

### Advanced Screenshot with Stealth Mode
```bash
curl -X POST http://localhost:3000/api/screenshot/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://protected-site.com",
    "options": {
      "fullPage": false,
      "width": 1920,
      "height": 1080,
      "stealthMode": true,
      "saveToFile": true,
      "timeout": 60000
    }
  }'
```

### Upload Manual Screenshot
```bash
curl -X POST http://localhost:3000/api/screenshot/upload \
  -H "x-api-key: YOUR_API_KEY" \
  -F "screenshot=@screenshot.png" \
  -F "description=Manual screenshot for backlink verification"
```

### E-commerce Product Monitoring
```bash
curl -X POST http://localhost:3000/api/compare \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://amazon.com/product/1",
      "https://competitor.com/product/2"
    ],
    "selectors": {
      "price": ".price, .cost",
      "availability": ".stock",
      "rating": ".rating",
      "reviews": ".review-count"
    },
    "includeScreenshots": false
  }'
```

### Complete Schema Analysis
```bash
curl -X POST http://localhost:3000/api/extract/schema \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://restaurant-example.com",
    "options": {"includeTables": true}
  }' | jq '.data'
```

## 📊 Response Examples

### Screenshot Upload Response
```json
{
  "success": true,
  "message": "Screenshot uploaded successfully",
  "results": {
    "originalName": "screenshot.png",
    "filename": "screenshot-a1b2c3d4-2025-09-05T17-30-00-123Z.png",
    "filePath": "./screenshots/screenshot-a1b2c3d4-2025-09-05T17-30-00-123Z.png",
    "screenshotUrl": "https://playwright.strudel.marketing/screenshots/screenshot-a1b2c3d4-2025-09-05T17-30-00-123Z.png",
    "format": "png",
    "size": 1245678,
    "description": "Manual screenshot for backlink verification",
    "timestamp": "2025-09-05T17:30:00.123Z",
    "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANS..."
  }
}
```

### Screenshot List Response
```json
{
  "success": true,
  "screenshots": [
    {
      "filename": "screenshot-a1b2c3d4-2025-09-05T17-30-00-123Z.png",
      "url": "https://playwright.strudel.marketing/screenshots/screenshot-a1b2c3d4-2025-09-05T17-30-00-123Z.png",
      "size": 1245678,
      "created": "2025-09-05T17:30:00.123Z",
      "modified": "2025-09-05T17:30:00.123Z"
    }
  ],
  "total": 1
}
```

### SEO Audit Response
```json
{
  "success": true,
  "result": {
    "url": "https://example.com",
    "score": 78,
    "grade": "C",
    "issues": [
      "Title length not optimal (30-60 chars)",
      "3 images missing alt text",
      "Missing Open Graph tags"
    ],
    "recommendations": [
      "Optimize title length to 30-60 characters",
      "Add descriptive alt text to all images",
      "Add Open Graph meta tags for social sharing"
    ],
    "seoData": {
      "title": "Example Domain",
      "titleLength": 13,
      "description": "This domain is for use in examples...",
      "headings": {
        "h1": [{"text": "Example Domain", "length": 13}],
        "h2": [],
        "h3": []
      },
      "imageAnalysis": {
        "total": 0,
        "withAlt": 0,
        "withoutAlt": 0
      },
      "linkAnalysis": {
        "total": 1,
        "internal": 0,
        "external": 1
      },
      "technicalSEO": {
        "hasHTTPS": true,
        "hasCanonical": false,
        "isResponsive": false,
        "hasLang": true
      },
      "structuredData": {
        "hasStructuredData": false,
        "jsonLD": [],
        "microdata": []
      },
      "socialMeta": {
        "openGraph": {},
        "twitterCard": {}
      }
    },
    "performance": {
      "loadTime": 1245,
      "scoreBreakdown": {
        "content": 22,
        "technical": 20,
        "performance": 18,
        "mobile": 2,
        "social": 4,
        "structured": 2
      }
    },
    "stealthMode": true
  }
}
```

## 🎯 Use Cases & Industries

### 🛍️ **E-commerce**
- **Competitor Price Monitoring** - Track competitor prices automatically
- **Product Data Extraction** - Get product details, reviews, ratings
- **SEO Optimization** - Improve product page SEO scores
- **Schema Markup Validation** - Ensure proper structured data
- **Manual Screenshot Upload** - Backup for blocked automated captures

### 📰 **Content & Media**
- **Article Analysis** - Extract headline, author, publish date
- **SEO Content Audits** - Comprehensive content optimization
- **Social Media Optimization** - Validate OG and Twitter tags
- **Competitor Content Analysis** - Track competitor content strategies
- **Stealth Capture** - Bypass anti-bot protections for analysis

### 🏢 **Marketing Agencies**
- **Client SEO Audits** - Comprehensive SEO reports for clients
- **Competitor Analysis** - Multi-site comparison reports
- **Performance Monitoring** - Track client website improvements
- **Automated Reporting** - Generate regular SEO status reports
- **Manual Override** - Upload screenshots when automation fails

### 🏪 **Local Business**
- **Local SEO Monitoring** - Track local search optimization
- **Review Monitoring** - Extract ratings and reviews
- **Citation Consistency** - Verify business information across sites
- **Mobile Optimization** - Ensure mobile-friendly implementation

## 🛠️ Advanced Configuration

### Environment Variables
```env
NODE_ENV=production
PORT=3000
BROWSER_TIMEOUT=30000
MAX_CONCURRENT_PAGES=5
SCREENSHOT_QUALITY=90
UPLOAD_MAX_SIZE=10485760
```

### Docker Configuration with Volume Mapping
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set memory and CPU limits
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Browser optimization
ENV PLAYWRIGHT_BROWSERS_PATH=/app/browsers
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Performance settings
ENV UV_THREADPOOL_SIZE=4
ENV NODE_ENV=production

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

RUN npx playwright install --with-deps chromium
COPY src/ ./src/

# Create screenshots directory and set permissions
RUN mkdir -p /app/screenshots && chmod 755 /app/screenshots

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

### Screenshot Storage Configuration
For persistent screenshot storage with Docker:

```yaml
version: '3.8'
services:
  playwright-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./screenshots:/app/screenshots  # Persistent screenshot storage
    restart: unless-stopped
```

For Coolify deployment, add a Directory Mount:
- **Source Directory**: `./screenshots`
- **Destination Directory**: `/app/screenshots`

## 🔒 Security & Features

### Anti-Bot Protection
- **Stealth Mode** - Realistic browser fingerprinting
- **Human-like Behavior** - Mouse movements, scrolling, delays
- **Header Spoofing** - Modern browser headers
- **JavaScript Injection** - Hide automation properties

### File Upload Security
- **Type Validation** - Only image files allowed
- **Size Limits** - Configurable upload size limits
- **Filename Sanitization** - Safe filename generation
- **Path Traversal Protection** - Secure file storage

### Rate Limiting (Recommended)
```nginx
# Nginx rate limiting configuration
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
limit_req zone=api burst=20 nodelay;
```

## 🚀 Deployment Options

### 1. Coolify (Recommended)
```yaml
# Simple Coolify deployment with persistent storage
Repository: https://github.com/Strudel-marketing/playwright
Branch: main
Port: 3000
Domain: playwright.your-domain.com
Storages:
  - Source: ./screenshots
    Destination: /app/screenshots
```

### 2. Docker Compose with Volumes
```yaml
version: '3.8'
services:
  playwright-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./screenshots:/app/screenshots
      - ./downloads:/app/downloads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 📞 Support & Community

### 🆘 Getting Help
- 📧 **Email**: support@strudel.marketing
- 🐛 **Issues**: [GitHub Issues](https://github.com/Strudel-marketing/playwright/issues)
- 📚 **Documentation**: API docs available at `/health` endpoint
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Strudel-marketing/playwright/discussions)

### 🤝 Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Submit a pull request

### 📄 License
MIT License - see [LICENSE](LICENSE) file for details

## 🎉 What's New in v2.1

### ✨ Enhanced Screenshot Features
- **Manual Upload Support** - Upload screenshots from your computer
- **Stealth Mode** - Anti-bot detection bypass for protected sites
- **Persistent Storage** - Volume mapping for permanent screenshot storage
- **List Management** - View all stored screenshots via API
- **Enhanced Security** - File type validation and secure storage

### 🔧 Technical Improvements
- **Volume Mapping** - Proper Docker volume configuration
- **Better Error Handling** - Improved upload validation
- **File Management** - Automatic filename generation and collision prevention
- **Storage Optimization** - Efficient file storage with metadata

---

**🎭 Built with ❤️ using Microsoft Playwright • 🚀 Powered by Node.js • 🐳 Docker Ready**

*Transform your SEO analysis and data extraction workflows with the most powerful Playwright automation service available.*
