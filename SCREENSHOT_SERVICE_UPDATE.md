# Screenshot Service: Redirect & Popup Protection Update

## 📋 סיכום שינויים

### ✅ מה תוקן (26/10/2024):

#### 1. **שימוש ב-safeNavigate במקום page.goto**
```javascript
// ❌ לפני:
await page.goto(url, { waitUntil: chosenWaitUntil, timeout: navTimeout });

// ✅ אחרי:
await browserPool.safeNavigate(page, url, {
  waitUntil: chosenWaitUntil,
  timeout: navTimeout
});
```

**יתרונות:**
- הגנה מפני infinite redirects
- Rate limiting per domain
- Random delays אנטי-detection
- Retry logic חכם

---

#### 2. **חסימה משופרת של פופאפים**

##### A. חסימת Dialogs (Alert/Confirm/Prompt)
```javascript
page.on('dialog', async dialog => {
  console.log(`🚫 Blocked dialog: ${dialog.type()} - "${dialog.message()}"`);
  await dialog.dismiss();
});
```

##### B. חסימת window.open
```javascript
await page.addInitScript(() => {
  window.open = () => null;
});
```

##### C. חסימת Event Listeners שפותחים פופאפים
```javascript
await page.addInitScript(() => {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'click' || type === 'mousedown') {
      return; // חסום listeners שעלולים לפתוח popups
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
});
```

##### D. ניקוי Modals/Overlays קיימים
```javascript
await page.evaluate(() => {
  const popupSelectors = [
    '[class*="modal"]',
    '[class*="popup"]',
    '[class*="overlay"]',
    '[id*="modal"]',
    '[id*="popup"]',
    '[role="dialog"]',
    '.cookie-banner',
    '.newsletter-popup',
    '[class*="cookie"]'
  ];

  popupSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (el && el.style) {
        el.style.display = 'none';
        el.remove();
      }
    });
  });

  // הסרת overlay backgrounds
  const overlays = document.querySelectorAll('[class*="overlay"], [style*="fixed"]');
  overlays.forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' && style.zIndex > 100) {
      el.remove();
    }
  });
});
```

---

#### 3. **הפרדה בין blockPopups ל-blockMedia**

```javascript
// blockPopups (default: true) - חוסם פופאפים ודיאלוגים
// blockMedia (default: false) - חוסם media/fonts (לביצועים)

if (blockMedia) {
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['media', 'font'].includes(type)) {
      return route.abort();
    }
    return route.continue();
  });
}
```

---

#### 4. **שיפורים נוספים**

- ✅ לוגים מפורטים יותר
- ✅ הוספת `popupsBlocked` ל-response
- ✅ שיפור error handling
- ✅ תיעוד מקיף בקוד

---

## 🎯 איך להשתמש

### דוגמה 1: צילום מסך רגיל עם חסימת פופאפים
```bash
curl -X POST https://playwright.strudel.marketing/api/screenshot/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "fullPage": true,
      "format": "jpeg",
      "quality": 90,
      "blockPopups": true
    }
  }'
```

### דוגמה 2: צילום עם חסימת media (מהיר יותר)
```bash
curl -X POST https://playwright.strudel.marketing/api/screenshot/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "fullPage": true,
      "blockPopups": true,
      "blockMedia": true
    }
  }'
```

### דוגמה 3: stealth mode + popup blocking
```bash
curl -X POST https://playwright.strudel.marketing/api/screenshot/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "stealthMode": true,
      "blockPopups": true
    }
  }'
```

---

## 📊 השפעה על Services אחרים

### ✅ Services שכבר משתמשים ב-safeNavigate:
- **SEO Service** ✓
- **Schema Service** ✓
- **PAA Service** ✓ (שונה לשימוש ב-browserPool בלבד)
- **Screenshots Service** ✓ (עודכן עכשיו!)

### ✅ Services שלא צריכים עדכון:
- **Automation Service** - לא משתמש ב-goto
- **Comparison Service** - לא משתמש ב-goto
- **Performance Service** - לא משתמש ב-goto
- **Knowledge Service** - לא משתמש ב-goto

---

## 🔧 אפשרויות נוספות שזמינות

```javascript
const options = {
  // Basic options
  fullPage: true,              // צילום עמוד מלא
  format: 'jpeg',              // png/jpeg/webp
  quality: 80,                 // 1-100 (רק ל-jpeg/webp)
  width: 1280,                 // רוחב viewport
  height: 800,                 // גובה viewport
  
  // Advanced navigation
  waitUntil: 'networkidle',    // domcontentloaded/networkidle
  timeout: 30000,              // timeout בms
  
  // Protection features
  blockPopups: true,           // חסימת פופאפים (מומלץ!)
  blockMedia: false,           // חסימת media/fonts (לביצועים)
  stealthMode: false,          // anti-detection mode
  
  // Targeting
  selector: '.main-content',   // צילום element ספציפי
  clip: {x, y, width, height}, // חיתוך אזור מדויק
  
  // Storage
  saveToFile: false,           // שמירה לקובץ
  outputDir: './screenshots',  // תיקיית יעד
  
  // Alternative input
  html: '<html>...</html>',    // HTML content ישיר
};
```

---

## 📈 ביצועים צפויים

| תרחיש | זמן צפוי | הערות |
|-------|----------|-------|
| צילום רגיל | 2-5 שניות | ללא חסימות |
| + blockPopups | 3-6 שניות | +1s לניקוי |
| + blockMedia | 1-3 שניות | מהיר יותר! |
| + stealthMode | 4-8 שניות | התנהגות אנושית |

---

## 🐛 פתרון בעיות

### בעיה: הצילום עדיין מכיל פופאפ
**פתרון:**
1. וודא ש-`blockPopups: true` בoptions
2. נסה להגדיל את ה-`waitTime` ב-safeNavigate
3. הוסף `stealthMode: true` אם האתר מזהה automation

### בעיה: הצילום לוקח יותר מדי זמן
**פתרון:**
1. הפעל `blockMedia: true`
2. שנה `waitUntil` ל-`domcontentloaded`
3. הקטן את ה-`timeout`

### בעיה: הצילום נכשל עם שגיאת redirect
**פתרון:**
זה לא אמור לקרות יותר! `safeNavigate` מטפל בזה אוטומטית.
אם זה עדיין קורה, בדוק את הלוגים ל-rate limiting.

---

## 🔄 גרסאות

### v2.0.0 (26/10/2024)
- ✅ שימוש ב-safeNavigate
- ✅ חסימת פופאפים משופרת
- ✅ הפרדה בין blockPopups ל-blockMedia
- ✅ לוגים מפורטים

### v1.x.x (קודם)
- ❌ page.goto ישיר
- ⚠️ חסימת popups בסיסית
- ⚠️ blockPopups חסם גם media

---

**🎉 השרת עכשיו מוגן לחלוטין מפני redirects ופופאפים!**

*תיעוד עודכן: 26 אוקטובר 2024*
