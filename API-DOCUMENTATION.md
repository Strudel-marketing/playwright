# תיעוד API מלא - Playwright Web Services
*מסמך פנימי מסודר עם דוגמאות אמיתיות*

---

## 🔍 SEO Analysis - `/api/seo`

### POST /api/seo/audit - ניתוח SEO מלא

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `includeScreenshot` (boolean), `options` (object)

**דוגמת curl:**
```bash
curl -X POST https://play.strudel.marketing/api/seo/audit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "includeScreenshot": true
  }'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "url": "https://teena.co.il",
  "results": {
    "seoScore": {
      "total": 81,
      "grade": "A-",
      "issues": ["3 images missing alt text"],
      "recommendations": ["Add alt text to all images"]
    },
    "performance": {
      "loadTime": 4300,
      "domContentLoaded": 2100,
      "firstContentfulPaint": 1800
    },
    "headings": {
      "h1": { "count": 1, "content": ["טינה - עיצוב פנים מותאם אישית"] },
      "h2": { "count": 4, "content": ["השירותים שלנו", "הפרויקטים שלנו"] }
    },
    "readability": {
      "score": 60,
      "wordCount": 548,
      "language": "hebrew"
    },
    "screenshot": "/screenshots/teena-co-il-20240122063000.png"
  }
}
```

---

## 📊 Schema Extraction - `/api/extract`

### POST /api/extract/extract - חילוץ סכמות

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `options` (object)

**דוגמת curl:**
```bash
curl -X POST https://play.strudel.marketing/api/extract/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example-store.com/product/123"}'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "url": "https://example-store.com/product/123",
  "results": {
    "jsonLd": [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "iPhone 15 Pro",
        "offers": {
          "@type": "Offer",
          "price": "999",
          "priceCurrency": "USD"
        }
      }
    ],
    "openGraph": {
      "og:title": "iPhone 15 Pro",
      "og:image": "https://example-store.com/images/iphone15pro.jpg"
    }
  }
}
```

---

## 🤖 Form Automation - זרימת עבודה דו-שלבית

### שלב 1: POST /api/automation/analyze-forms - ניתוח טפסים

**מטרה:** זיהוי וניתוח כל הטפסים בעמוד

**דוגמת curl:**
```bash
curl -X POST https://play.strudel.marketing/api/automation/analyze-forms \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/contact"}'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "formAnalysis": {
    "formsFound": 1,
    "forms": [
      {
        "index": 0,
        "selector": "#contact-form",
        "action": "/submit-contact",
        "method": "POST",
        "fields": [
          {
            "name": "full_name",
            "type": "text",
            "selector": "#full_name",
            "label": "שם מלא *",
            "required": true
          },
          {
            "name": "email",
            "type": "email",
            "selector": "#email",
            "label": "אימייל *",
            "required": true
          },
          {
            "name": "message",
            "type": "textarea",
            "selector": "#message",
            "label": "הודעה *",
            "required": true
          }
        ],
        "submitButtons": [
          {
            "selector": "#submit-btn",
            "text": "שלח הודעה"
          }
        ]
      }
    ],
    "automationSuggestions": [
      {
        "formIndex": 0,
        "suggestedActions": [
          {
            "type": "type",
            "selector": "#full_name",
            "text": "ישראל ישראלי"
          },
          {
            "type": "type",
            "selector": "#email",
            "text": "israel@example.com"
          },
          {
            "type": "type",
            "selector": "#message",
            "text": "שלום, אני מעוניין לקבל מידע נוסף."
          },
          {
            "type": "click",
            "selector": "#submit-btn"
          }
        ]
      }
    ]
  }
}
```

### שלב 2: POST /api/automation/form - מילוי הטופס

**מטרה:** שימוש במידע מהשלב הראשון למילוי ושליחת הטופס

**דוגמת curl (בהתבסס על הניתוח):**
```bash
curl -X POST https://play.strudel.marketing/api/automation/form \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/contact",
    "formData": {
      "full_name": "ישראל ישראלי",
      "email": "israel@example.com",
      "message": "שלום, אני מעוניין לקבל מידע נוסף על השירותים שלכם."
    },
    "options": {
      "submitForm": true,
      "waitAfterSubmit": 5000
    }
  }'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "formSubmission": {
    "fieldsFilledCount": 3,
    "formSubmitted": true,
    "redirectUrl": "https://example.com/thank-you",
    "screenshot": "/screenshots/form-submit-20240122063500.png",
    "fieldsStatus": {
      "full_name": {
        "status": "filled",
        "value": "ישראל ישראלי"
      },
      "email": {
        "status": "filled",
        "value": "israel@example.com"
      },
      "message": {
        "status": "filled",
        "value": "שלום, אני מעוניין לקבל מידע נוסף על השירותים שלכם."
      }
    }
  }
}
```

---

## 📸 Screenshots - `/api/screenshot`

### POST /api/screenshot/capture - צילום יחיד

**דוגמת curl:**
```bash
curl -X POST https://play.strudel.marketing/api/screenshot/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "options": {
      "fullPage": true,
      "quality": 90
    }
  }'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "results": {
    "screenshotPath": "/screenshots/teena-co-il-20240122063000.png",
    "screenshotUrl": "https://play.strudel.marketing/screenshots/teena-co-il-20240122063000.png",
    "dimensions": { "width": 1920, "height": 2840 },
    "fileSize": "1.2MB"
  }
}
```

---

## ❓ People Also Ask - `/api/paa`

### POST /api/paa - שאלות PAA מגוגל

**דוגמת curl:**
```bash
curl -X POST https://play.strudel.marketing/api/paa \
  -H "Content-Type: application/json" \
  -d '{"query": "עיצוב פנים לסלון קטן"}'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "query": "עיצוב פנים לסלון קטן",
  "questions": [
    {
      "question": "איך לעצב סלון קטן כך שייראה גדול יותר?",
      "answer": "כדי לגרום לסלון קטן להיראות גדול יותר, מומלץ להשתמש בצבעים בהירים...",
      "source": "https://example-design.com/small-living-room-tips"
    }
  ],
  "totalQuestions": 4,
  "language": "he"
}
```

---

## ⚖️ Comparison - `/api/compare`

### POST /api/compare/advanced - השוואה מתקדמת

**דוגמת curl:**
```bash
curl -X POST https://play.strudel.marketing/api/compare/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "mainUrl": "https://mydesignstudio.com",
    "competitorUrls": [
      "https://competitor1-design.com",
      "https://competitor2-interior.com"
    ],
    "options": {
      "includeVisual": true,
      "includeSeo": true
    }
  }'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "comparison": {
    "overallRanking": {
      "seoScore": 2,
      "contentQuality": 1,
      "visualAppeal": 1
    },
    "recommendations": [
      "Add LocalBusiness schema markup",
      "Improve internal linking structure"
    ],
    "strengths": [
      "Better visual design than competitors",
      "Higher content quality score"
    ]
  }
}
```

---

## 🚀 Performance - `/api/performance`

### POST /api/performance/lighthouse - ניתוח Lighthouse

**דוגמת curl:**
```bash
curl -X POST https://play.strudel.marketing/api/performance/lighthouse \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "options": {
      "device": "mobile"
    }
  }'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "lighthouse": {
    "performance": {
      "score": 0.72,
      "metrics": {
        "firstContentfulPaint": 2100,
        "largestContentfulPaint": 4200
      }
    },
    "accessibility": {
      "score": 0.89,
      "issues": ["11 images missing alt text"]
    },
    "seo": {
      "score": 0.85,
      "issues": ["Meta description too short"]
    }
  }
}
```

---

## 🏥 Health & Status

### GET /health
```bash
curl https://play.strudel.marketing/health
```
**תשובה:** `OK`

### GET /status
```bash
curl https://play.strudel.marketing/status
```
**תשובה:**
```json
{
  "status": "healthy",
  "uptime": 86400,
  "version": "1.2.0"
}
```

---

## 📋 מבנה תשובות

### הצלחה:
```json
{
  "success": true,
  "url": "https://example.com",
  "results": { /* תוצאות */ },
  "timestamp": "2024-01-22T06:30:00Z"
}
```

### שגיאה:
```json
{
  "success": false,
  "error": "Error message",
  "url": "https://example.com"
}
```

### קודי שגיאה:
- **400:** חסרים פרמטרים חובה
- **429:** Rate limit (PAA)
- **500:** שגיאה פנימית
- **503:** שירות לא זמין

---

## 🌟 תכונות מיוחדות

### תמיכה בעברית:
- זיהוי שפה אוטומטי
- ניתוח readability מותאם לעברית
- תמיכה ב-RTL
- סינון stop words בעברית

### Anti-Detection:
- User agents מגוונים
- Rate limiting חכם
- Browser fingerprinting protection

### Screenshots:
- נשמרים ב-`/app/screenshots/`
- נגישים דרך `/screenshots/`
- TTL של 7 ימים
- פורמטים: PNG, JPEG, WebP
