# תיעוד API מלא - שירות Playwright Web Services

## סקירה כללית
השירות מספק פלטפורמה מקיפה לניתוח אתרים, אוטומציה, השוואות ויכולות SEO מתקדמות.

---

## 🔍 SEO Analysis - `/api/seo`

### POST /api/seo/audit - ניתוח SEO מלא
**חובה:** `url` (string)
**אופציונלי:** `includeScreenshot` (boolean), `options` (object)

**דוגמת קריאה:**
```json
{
  "url": "https://example.com",
  "includeScreenshot": true
}
```

**תשובה:** ניתוח מקיף כולל SEO score, performance metrics, headings analysis, images/links analysis, readability, keyword density, schemas, screenshot

---

## 📊 Schema Extraction - `/api/extract`

### POST /api/extract/schema - חילוץ סכמות
**חובה:** `url` (string)
**אופציונלי:** `options` (object)

**תשובה:** JSON-LD, OpenGraph, Twitter Card, Microdata, RDFa

### POST /api/extract/quick-check - בדיקה מהירה
**חובה:** `url` (string)

**תשובה:** סיכום מהיר של סכמות קיימות

---

## 📸 Screenshots - `/api/screenshot`

### POST /api/screenshot/capture - צילום יחיד
**חובה:** `url` (string)
**אופציונלי:** `options` (object) - width, height, fullPage, quality, format

### POST /api/screenshot/multiple - צילומים מרובים
**חובה:** `urls` (array)
**אופציונלי:** `options` (object)

---

## 🤖 Automation - `/api/automation`

### POST /api/automation/execute - ביצוע פעולות
**חובה:** `url` (string), `actions` (array)
**אופציונלי:** `options` (object)

**פעולות זמינות:** click, type, scroll, wait, screenshot

### POST /api/automation/form - מילוי טופס
**חובה:** `url` (string), `formData` (object)
**אופציונלי:** `options` (object) - submitForm, waitAfterSubmit

### POST /api/automation/extract - חילוץ נתונים
**חובה:** `url` (string), `extractionConfig` (object עם itemSelector)
**אופציונלי:** fields, nextPageSelector, maxPages

### POST /api/automation/monitor - ניטור שינויים
**חובה:** `url` (string), `monitorConfig` (object עם selector)
**אופציונלי:** interval, maxChecks, changeType

### POST /api/automation/analyze-forms - ניתוח טפסים
**חובה:** `url` (string)

---

## ⚖️ Comparison - `/api/compare`

### POST /api/compare/visual - השוואה ויזואלית
**חובה:** `url1` (string), `url2` (string)
**אופציונלי:** `options` (object) - threshold, fullPage

### POST /api/compare/content - השוואת תוכן
**חובה:** `url1` (string), `url2` (string)

### POST /api/compare/schema - השוואת סכמות
**חובה:** `url1` (string), `url2` (string)

### POST /api/compare/advanced - השוואה מתקדמת
**חובה:** `mainUrl` (string), `competitorUrls` (array, עד 5)
**אופציונלי:** `options` (object) - includeVisual, includeContent, includeSchema, includeSeo

---

## ❓ People Also Ask - `/api/paa`

### POST /api/paa - שאלות PAA מגוגל
**חובה:** `query` (string)

### POST /api/paa/bing - שאלות PAA מבינג
**חובה:** `query` (string)

### GET /api/paa/status - סטטוס שירות

### POST /api/paa/debug - מצב debug
**חובה:** `query` (string)

---

## 🚀 Performance - `/api/performance`

### POST /api/performance/lighthouse - ניתוח Lighthouse
**חובה:** `url` (string)
**אופציונלי:** `options` (object) - categories, device, throttling

### POST /api/performance/lighthouse/full - ניתוח מלא
**זהה לעיל אבל עם כל הקטגוריות**

### POST /api/performance/quick - ניתוח מהיר
**חובה:** `url` (string)

---

## 🏥 Health & Status

### GET /health - בדיקת בריאות
**תשובה:** "OK"

### GET /status - סטטוס מפורט
**תשובה:** JSON עם status, timestamp, uptime, version

---

## מבנה תשובות

### הצלחה:
```json
{
  "success": true,
  "url": "https://example.com",
  "results": { ... },
  "timestamp": "2024-01-01T10:00:00Z"
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
- 400: Bad Request (חסרים פרמטרים)
- 429: Rate Limited (PAA)
- 500: Internal Server Error
- 503: Service Unavailable (חסום)

---

## תכונות מיוחדות

### תמיכה בעברית:
- זיהוי שפה אוטומטי
- ניתוח readability מותאם לעברית
- תמיכה ב-RTL
- סינון stop words בעברית

### Anti-Detection:
- User agents מגוונים
- Rate limiting חכם
- Proxy support (PAA)
- Browser fingerprinting protection

### Screenshots:
- נשמרים ב-`/app/screenshots/`
- נגישים דרך `/screenshots/`
- TTL של 7 ימים
- פורמטים: PNG, JPEG, WebP
