# תיעוד API מלא - Playwright Web Services
*מסמך פנימי מסודר עם דוגמאות אמיתיות*

---

## 🔍 SEO Analysis - `/api/seo`

### POST /api/seo/audit - ניתוח SEO מלא

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `includeScreenshot` (boolean), `options` (object)

**אפשרויות זמינות ב-options:**
- `waitTime` (number) - זמן המתנה לטעינת העמוד
- `userAgent` (string) - User agent מותאם אישית
- `viewport` (object) - גודל מסך: `{width: number, height: number}`
- `timeout` (number) - זמן timeout למשימה

**דוגמת curl עם כל האפשרויות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/seo/audit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "includeScreenshot": true,
    "options": {
      "waitTime": 3000,
      "userAgent": "Mozilla/5.0 (compatible; SEO-Bot/1.0)",
      "viewport": {
        "width": 1920,
        "height": 1080
      },
      "timeout": 60000
    }
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

**אפשרויות זמינות ב-options:**
- `includeOpenGraph` (boolean) - כלול OpenGraph
- `includeTwitterCard` (boolean) - כלול Twitter Card
- `includeMicrodata` (boolean) - כלול Microdata
- `includeRDFa` (boolean) - כלול RDFa
- `timeout` (number) - זמן timeout

**דוגמת curl עם כל האפשרויות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/extract/extract \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example-store.com/product/123",
    "options": {
      "includeOpenGraph": true,
      "includeTwitterCard": true,
      "includeMicrodata": true,
      "includeRDFa": true,
      "timeout": 30000
    }
  }'
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
    },
    "twitterCard": {
      "twitter:card": "summary_large_image",
      "twitter:title": "iPhone 15 Pro"
    },
    "microdata": [],
    "rdfa": []
  }
}
```

### POST /api/extract/quick-check - בדיקה מהירה

**שדות חובה:** `url` (string)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/extract/quick-check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## 🤖 Form Automation - זרימת עבודה דו-שלבית

### שלב 1: POST /api/automation/analyze-forms - ניתוח טפסים

**מטרה:** זיהוי וניתוח כל הטפסים בעמוד

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `waitTime` (number) - זמן המתנה לטעינת העמוד
- `includeHidden` (boolean) - כלול שדות נסתרים
- `timeout` (number) - זמן timeout

**דוגמת curl עם אפשרויות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/automation/analyze-forms \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/contact",
    "options": {
      "waitTime": 2000,
      "includeHidden": false,
      "timeout": 30000
    }
  }'
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

**שדות חובה:** `url` (string), `formData` (object)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `submitForm` (boolean, default: true) - האם לשלוח את הטופס
- `waitAfterSubmit` (number, default: 3000) - זמן המתנה לאחר שליחה
- `formSelector` (string) - בורר ספציפי לטופס
- `screenshot` (boolean) - צילום מסך לאחר מילוי
- `timeout` (number) - זמן timeout

**דוגמת curl עם כל האפשרויות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/automation/form \
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
      "waitAfterSubmit": 5000,
      "formSelector": "#contact-form",
      "screenshot": true,
      "timeout": 60000
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

### POST /api/automation/execute - ביצוע רצף פעולות

**שדות חובה:** `url` (string), `actions` (array)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `waitTime` (number) - זמן המתנה בין פעולות
- `screenshot` (boolean) - צילום מסך לאחר כל פעולה
- `timeout` (number) - זמן timeout כללי
- `viewport` (object) - גודל מסך

**פעולות זמינות:**
- `click` - לחיצה על אלמנט
- `type` - הקלדת טקסט
- `scroll` - גלילה
- `wait` - המתנה
- `screenshot` - צילום מסך
- `select` - בחירה מרשימה נפתחת

**דוגמת curl עם אפשרויות מלאות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/automation/execute \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/login",
    "actions": [
      {
        "type": "type",
        "selector": "#username",
        "text": "user@example.com"
      },
      {
        "type": "type",
        "selector": "#password",
        "text": "mypassword123"
      },
      {
        "type": "click",
        "selector": "#login-button"
      },
      {
        "type": "wait",
        "duration": 2000
      },
      {
        "type": "screenshot",
        "filename": "after-login"
      }
    ],
    "options": {
      "waitTime": 1000,
      "screenshot": true,
      "timeout": 30000,
      "viewport": {
        "width": 1920,
        "height": 1080
      }
    }
  }'
```

---

## 🧠 Knowledge Graph - `/api/knowledge`

### POST /api/knowledge/analyze - ניתוח Knowledge Graph

**מטרה:** חילוץ מילות מפתח סמנטיות, ישויות ומושגים קשורים מ-URL, טקסט או רשימת מילות מפתח

**שדות חובה:** אחד מהבאים נדרש: `url` (string), `text` (string), או `keywords` (array)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `language` (string, default: 'en') - שפה לניתוח ('en', 'he')
- `includeWikidata` (boolean, default: true) - כלול נתוני Wikidata
- `limit` (number, default: 5) - מספר תוצאות מקסימלי לכל מילת מפתח
- `waitUntil` (string) - אירוע המתנה לטעינת דף (כאשר משתמשים ב-URL)
- `timeout` (number) - זמן timeout

**דוגמת curl עם URL:**
```bash
curl -X POST https://playwright.strudel.marketing/api/knowledge/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/interior-design-article",
    "options": {
      "language": "en",
      "includeWikidata": true,
      "limit": 5,
      "timeout": 60000
    }
  }'
```

**דוגמת curl עם מילות מפתח:**
```bash
curl -X POST https://playwright.strudel.marketing/api/knowledge/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["interior design", "modern furniture", "minimalist style"],
    "options": {
      "language": "en",
      "includeWikidata": true,
      "limit": 10
    }
  }'
```

**דוגמת curl עם טקסט:**
```bash
curl -X POST https://playwright.strudel.marketing/api/knowledge/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "עיצוב פנים מודרני משלב פונקציונליות עם אסתטיקה מינימליסטית",
    "options": {
      "language": "he",
      "includeWikidata": true,
      "limit": 5
    }
  }'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "url": "https://example.com/interior-design-article",
  "text": null,
  "analyzedKeywords": [
    "interior design",
    "modern furniture",
    "minimalist",
    "space planning"
  ],
  "knowledgeGraph": {
    "queries": ["interior design", "modern furniture", "minimalist", "space planning"],
    "google": [
      {
        "keyword": "interior design",
        "title": "Interior design",
        "description": "Interior design is the art and science of enhancing the interior of a building to achieve a healthier and more aesthetically pleasing environment",
        "url": "https://www.google.com/search?kgmid=/m/03h9v",
        "imageUrl": "https://example.com/image.jpg",
        "types": ["Thing", "Intangible", "Profession"]
      }
    ],
    "wikidata": [
      {
        "id": "Q7864353",
        "label": "interior design",
        "description": "art and science of enhancing the interior of a building",
        "url": "https://www.wikidata.org/wiki/Q7864353",
        "aliases": ["interior decoration", "interior architecture"]
      }
    ],
    "entities": [
      {
        "name": "Interior design",
        "id": "Q7864353",
        "types": ["Profession", "Art"],
        "description": "art and science of enhancing interiors",
        "url": "https://www.wikidata.org/wiki/Q7864353"
      }
    ],
    "semantic_keywords": [
      "space planning",
      "color theory",
      "furniture design",
      "architectural design",
      "ergonomic design"
    ],
    "related_terms": [
      "home decoration",
      "interior architecture",
      "spatial design",
      "furniture arrangement",
      "color schemes"
    ],
    "used_advertools": true
  },
  "timestamp": "2025-01-22T10:30:00.000Z"
}
```

---

### POST /api/knowledge/brief - יצירת בריף תוכן

**מטרה:** יצירת בריף תוכן אוטומטי מבוסס Knowledge Graph עם המלצות לכותרות, שאלות FAQ וישויות מרכזיות

**שדות חובה:** אחד מהבאים נדרש: `url` (string), `text` (string), או `keywords` (array)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `language` (string, default: 'he') - שפה לניתוח ('en', 'he')
- `includeWikidata` (boolean, default: true) - כלול נתוני Wikidata
- `limit` (number, default: 5) - מספר תוצאות מקסימלי
- `waitUntil` (string) - אירוע המתנה לטעינת דף
- `timeout` (number) - זמן timeout

**דוגמת curl עם URL:**
```bash
curl -X POST https://playwright.strudel.marketing/api/knowledge/brief \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "options": {
      "language": "he",
      "includeWikidata": true,
      "limit": 5
    }
  }'
```

**דוגמת curl עם מילות מפתח:**
```bash
curl -X POST https://playwright.strudel.marketing/api/knowledge/brief \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["עיצוב פנים", "רהיטים מודרניים", "סגנון מינימליסטי"],
    "options": {
      "language": "he",
      "includeWikidata": true
    }
  }'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "analyzedKeywords": [
    "עיצוב פנים",
    "רהיטים מודרניים",
    "סגנון מינימליסטי"
  ],
  "brief": {
    "focus_entities": [
      "עיצוב פנים",
      "רהיטים מודרניים",
      "סגנון מינימליסטי"
    ],
    "suggested_h2": [
      "תכנון מרחב יעיל",
      "תורת הצבעים בעיצוב",
      "בחירת רהיטים מתאימים",
      "עקרונות תאורה בעיצוב",
      "אלמנטים דקורטיביים מינימליסטיים",
      "ארגונומיה ונוחות"
    ],
    "faqs": [
      "מה זה עיצוב פנים?",
      "מה זה רהיטים מודרניים?",
      "מה זה סגנון מינימליסטי?",
      "מה זה תכנון מרחב?",
      "מה זה תורת הצבעים?"
    ],
    "references": [
      "https://www.wikidata.org/wiki/Q7864353",
      "https://www.wikidata.org/wiki/Q furniture123",
      "https://www.google.com/search?kgmid=/m/03h9v"
    ]
  },
  "knowledgeGraph": {
    "queries": ["עיצוב פנים", "רהיטים מודרניים", "סגנון מינימליסטי"],
    "google": [...],
    "wikidata": [...],
    "entities": [...],
    "semantic_keywords": [...],
    "related_terms": [...],
    "used_advertools": true
  },
  "timestamp": "2025-01-22T10:30:00.000Z"
}
```

**שימושים מומלצים לבריף:**
- **focus_entities** - הישויות המרכזיות שכדאי להתמקד בהן בתוכן
- **suggested_h2** - כותרות H2 מוצעות למאמר (2-4 מילים, רלוונטיות לנושא)
- **faqs** - שאלות FAQ מוצעות (פורמט "מה זה...?")
- **references** - קישורים למקורות חיצוניים (Wikidata, Google Knowledge Graph)

**טיפים לשימוש:**
1. השתמש ב-`language: 'he'` לתוכן בעברית
2. הגדל את `limit` לקבלת יותר המלצות למילות מפתח
3. השתמש ב-`url` לניתוח דף קיים, או `keywords` לתכנון תוכן חדש
4. ה-FAQs אוטומטיות מתאימות למימוש ב-Schema.org FAQPage

---

## 📸 Screenshots - `/api/screenshot`

### POST /api/screenshot/capture - צילום יחיד

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `width` (number, default: 1920) - רוחב המסך
- `height` (number, default: 1080) - גובה המסך
- `fullPage` (boolean, default: false) - צילום עמוד מלא
- `quality` (number, 1-100, default: 80) - איכות התמונה
- `format` (string, default: 'png') - פורמט התמונה (png/jpeg/webp)
- `clip` (object) - חיתוך אזור ספציפי: `{x, y, width, height}`
- `omitBackground` (boolean) - השמטת רקע (לשקיפות)
- `timeout` (number) - זמן timeout

**דוגמת curl עם כל האפשרויות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/screenshot/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "options": {
      "width": 1920,
      "height": 1080,
      "fullPage": true,
      "quality": 90,
      "format": "png",
      "clip": {
        "x": 0,
        "y": 0,
        "width": 1920,
        "height": 1080
      },
      "omitBackground": false,
      "timeout": 30000
    }
  }'
```

**דוגמת תשובה:**
```json
{
  "success": true,
  "results": {
    "screenshotPath": "/screenshots/teena-co-il-20240122063000.png",
    "screenshotUrl": "https://playwright.strudel.marketing/screenshots/teena-co-il-20240122063000.png",
    "dimensions": { "width": 1920, "height": 2840 },
    "fileSize": "1.2MB"
  }
}
```

### POST /api/screenshot/multiple - צילומים מרובים

**שדות חובה:** `urls` (array)
**שדות אופציונליים:** `options` (object) - זהות לצילום יחיד

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/screenshot/multiple \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example1.com",
      "https://example2.com",
      "https://example3.com"
    ],
    "options": {
      "fullPage": true,
      "quality": 85,
      "format": "png"
    }
  }'
```

### POST /api/screenshot/responsive - צילומים רספונסיביים

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `viewports` (array), `options` (object)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/screenshot/responsive \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "viewports": [
      {"width": 1920, "height": 1080, "name": "desktop"},
      {"width": 768, "height": 1024, "name": "tablet"},
      {"width": 375, "height": 667, "name": "mobile"}
    ],
    "options": {
      "fullPage": true,
      "quality": 90
    }
  }'
```

---

## ❓ People Also Ask - `/api/paa`

### POST /api/paa - שאלות PAA מגוגל

**שדות חובה:** `query` (string)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/paa \
  -H "Content-Type: application/json" \
  -d '{"query": "עיצוב פנים לסלון קטן"}'
```

### POST /api/paa/bing - שאלות PAA מבינג

**שדות חובה:** `query` (string)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/paa/bing \
  -H "Content-Type: application/json" \
  -d '{"query": "interior design small living room"}'
```

### POST /api/paa/debug - PAA גוגל עם debug

**שדות חובה:** `query` (string)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/paa/debug \
  -H "Content-Type: application/json" \
  -d '{"query": "עיצוב פנים לסלון קטן"}'
```

### POST /api/paa/bing/debug - PAA בינג עם debug

**שדות חובה:** `query` (string)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/paa/bing/debug \
  -H "Content-Type: application/json" \
  -d '{"query": "interior design small living room"}'
```

### GET /api/paa/status - סטטוס שירות PAA

**דוגמת curl:**
```bash
curl https://playwright.strudel.marketing/api/paa/status
```

---

## ⚖️ Comparison - `/api/compare`

### POST /api/compare/visual - השוואה ויזואלית

**שדות חובה:** `url1` (string), `url2` (string)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `threshold` (number, 0-1, default: 0.1) - רגישות להבדלים
- `fullPage` (boolean) - השוואת עמוד מלא
- `ignoreAntialiasing` (boolean) - התעלמות מ-antialiasing
- `ignoreColors` (boolean) - התעלמות מצבעים

**דוגמת curl עם כל האפשרויות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/compare/visual \
  -H "Content-Type: application/json" \
  -d '{
    "url1": "https://example1.com",
    "url2": "https://example2.com",
    "options": {
      "threshold": 0.1,
      "fullPage": true,
      "ignoreAntialiasing": true,
      "ignoreColors": false
    }
  }'
```

### POST /api/compare/content - השוואת תוכן

**שדות חובה:** `url1` (string), `url2` (string)
**שדות אופציונליים:** `options` (object)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/compare/content \
  -H "Content-Type: application/json" \
  -d '{
    "url1": "https://example1.com",
    "url2": "https://example2.com",
    "options": {
      "includeMetaTags": true,
      "includeHeadings": true,
      "includeImages": true
    }
  }'
```

### POST /api/compare/structure - השוואת מבנה

**שדות חובה:** `url1` (string), `url2` (string)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/compare/structure \
  -H "Content-Type: application/json" \
  -d '{
    "url1": "https://example1.com",
    "url2": "https://example2.com"
  }'
```

### POST /api/compare/full - השוואה מלאה

**שדות חובה:** `url1` (string), `url2` (string)
**שדות אופציונליים:** `options` (object)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/compare/full \
  -H "Content-Type: application/json" \
  -d '{
    "url1": "https://example1.com",
    "url2": "https://example2.com",
    "options": {
      "includeVisual": true,
      "includeContent": true,
      "includeStructure": true
    }
  }'
```

### POST /api/compare/advanced - השוואה מתקדמת (מתחרים)

**שדות חובה:** `mainUrl` (string), `competitorUrls` (array, עד 5)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `includeVisual` (boolean) - כלול השוואה ויזואלית
- `includeContent` (boolean) - כלול השוואת תוכן
- `includeSchema` (boolean) - כלול השוואת סכמות
- `includeSeo` (boolean) - כלול השוואת SEO
- `includePerformance` (boolean) - כלול השוואת ביצועים

**דוגמת curl עם כל האפשרויות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/compare/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "mainUrl": "https://mydesignstudio.com",
    "competitorUrls": [
      "https://competitor1-design.com",
      "https://competitor2-interior.com"
    ],
    "options": {
      "includeVisual": true,
      "includeContent": true,
      "includeSchema": true,
      "includeSeo": true,
      "includePerformance": true
    }
  }'
```

---

## 🚀 Performance - `/api/performance`

### POST /api/performance/lighthouse - ניתוח Lighthouse בסיסי

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `options` (object)

**אפשרויות זמינות ב-options:**
- `categories` (array) - קטגוריות לבדיקה: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa']
- `device` (string) - 'desktop' או 'mobile'
- `throttling` (boolean) - הגבלת רשת
- `onlyCategories` (array) - רק קטגוריות ספציפיות
- `skipAudits` (array) - דילוג על בדיקות ספציפיות
- `locale` (string) - שפה לדוח

**דוגמת curl עם כל האפשרויות:**
```bash
curl -X POST https://playwright.strudel.marketing/api/performance/lighthouse \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "options": {
      "categories": ["performance", "accessibility", "seo"],
      "device": "mobile",
      "throttling": true,
      "locale": "he",
      "skipAudits": ["unused-css-rules"]
    }
  }'
```

### POST /api/performance/lighthouse/full - ניתוח Lighthouse מלא

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `options` (object) - זהות לבסיסי

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/performance/lighthouse/full \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "options": {
      "device": "desktop",
      "throttling": false,
      "locale": "he"
    }
  }'
```

### POST /api/performance/lighthouse/performance - ניתוח ביצועים בלבד

**שדות חובה:** `url` (string)
**שדות אופציונליים:** `options` (object)

**דוגמת curl:**
```bash
curl -X POST https://playwright.strudel.marketing/api/performance/lighthouse/performance \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://teena.co.il",
    "options": {
      "device": "mobile",
      "throttling": true
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
        "largestContentfulPaint": 4200,
        "speedIndex": 3100,
        "timeToInteractive": 5800,
        "totalBlockingTime": 280,
        "cumulativeLayoutShift": 0.12
      },
      "opportunities": [
        "Optimize images (potential savings: 1.2s)",
        "Remove unused JavaScript (potential savings: 0.8s)"
      ]
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

### GET /api/performance/health - בדיקת בריאות שירות

**דוגמת curl:**
```bash
curl https://playwright.strudel.marketing/api/performance/health
```

---

## 🏥 Health & Status

### GET /health
```bash
curl https://playwright.strudel.marketing/health
```
**תשובה:** `OK`

### GET /status
```bash
curl https://playwright.strudel.marketing/status
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
