# הגדרת PageSpeed Insights API

מדריך להגדרת Google PageSpeed Insights API בשירות Performance.

## למה PageSpeed Insights API?

הקוד הקודם השתמש ב-Lighthouse מקומי שרץ על השרת. זה גרם לתוצאות לא מדויקות מכיוון ש:

1. **מיקום גיאוגרפי שונה** - השרת שלך נמצא במקום אחר מהמשתמשים שלך
2. **אין נתוני משתמשים אמיתיים (Field Data)** - Lighthouse מקומי רק מריץ סימולציה
3. **תנאי רשת שונים** - השרת שלך עשוי להיות מהיר/איטי יותר ממשתמש ממוצע
4. **Chrome Flags בעייתיים** - `--single-process` ו-`--no-zygote` משפיעים על דיוק המדידות

**PageSpeed Insights API מספק:**
- ✅ תוצאות **זהות** לממשק של Google PageSpeed Insights
- ✅ נתונים אמיתיים של משתמשים מ-28 יום אחרונים (Chrome UX Report)
- ✅ תנאי רשת סטנדרטיים עם throttling נכון
- ✅ תוצאות עקביות ואמינות

---

## שלב 1: קבלת API Key מ-Google Cloud

### 1.1 יצירת פרויקט ב-Google Cloud Console

1. גש ל-[Google Cloud Console](https://console.cloud.google.com/)
2. צור פרויקט חדש או בחר פרויקט קיים
3. שים לב לשם הפרויקט - תצטרך אותו בהמשך

### 1.2 הפעלת PageSpeed Insights API

1. גש ל-[PageSpeed Insights API Library](https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com)
2. לחץ על "Enable" / "הפעל"
3. המתן כמה שניות עד שה-API יופעל

### 1.3 יצירת API Key

**חשוב:** PageSpeed Insights API משתמש ב-**API Key** ולא ב-OAuth credentials!

1. גש ל-[Credentials](https://console.cloud.google.com/apis/credentials)
2. לחץ על "Create Credentials" → "API Key"
3. ה-API Key ייווצר אוטומטית
4. **מומלץ:** לחץ על "Restrict Key" כדי להגן על המפתח:
   - תחת "API restrictions", בחר "Restrict key"
   - סמן רק את "PageSpeed Insights API"
   - תחת "Application restrictions", בחר את סוג ההגבלה המתאים:
     - **HTTP referrers** - אם אתה קורא מהדפדפן
     - **IP addresses** - אם אתה קורא מהשרת (מומלץ!)
     - הוסף את כתובת ה-IP של השרת שלך

5. שמור את ה-API Key במקום מאובטח

---

## שלב 2: הגדרת השירות

### 2.1 יצירת קובץ .env

1. צור קובץ `.env` בתיקיית השורש של הפרויקט:

```bash
cp .env.example .env
```

2. ערוך את הקובץ `.env` והוסף את ה-API Key שלך:

```env
# Google PageSpeed Insights API
GOOGLE_PAGESPEED_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Rate Limiting (אופציונלי - ברירת מחדל 10,000)
PSI_DAILY_LIMIT=10000

# API Key פנימי (לאימות קריאות ל-API שלך)
API_KEY=your_internal_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=production
```

### 2.2 הגנה על .env

וודא ש-`.env` נמצא ב-`.gitignore`:

```bash
# ודא שזה קיים ב-.gitignore
echo ".env" >> .gitignore
echo "*.env" >> .gitignore
```

**אף פעם אל תשלח את קובץ .env ל-Git!**

---

## שלב 3: בדיקת ההתקנה

### 3.1 הפעלת השירות

```bash
npm start
```

### 3.2 בדיקת Health Check

```bash
curl http://localhost:3000/api/performance/health
```

**תשובה צפויה:**
```json
{
  "success": true,
  "service": "performance",
  "status": "healthy",
  "pageSpeedInsights": {
    "configured": true,
    "quota": {
      "used": 0,
      "remaining": 10000,
      "limit": 10000,
      "resetTime": 1699315200000,
      "utilizationPercent": 0
    }
  }
}
```

אם `"configured": false`, בדוק ש-`GOOGLE_PAGESPEED_API_KEY` מוגדר נכון ב-`.env`.

### 3.3 ריצת בדיקה ראשונה

```bash
curl -X POST http://localhost:3000/api/performance/pagespeed \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "strategy": "mobile"
    }
  }'
```

**אם הכל עובד**, תקבל תשובה עם:
- `"success": true`
- `"source": "PageSpeed Insights API"`
- ציוני performance מדויקים
- Field Data (אם יש מספיק נתונים לדומיין)

---

## שלב 4: שימוש ב-API

### Endpoints זמינים:

1. **בדיקה בסיסית**
```bash
POST /api/performance/pagespeed
```

2. **ביצועים בלבד (מהיר יותר)**
```bash
POST /api/performance/pagespeed/performance
```

3. **ניתוח מלא (כל הקטגוריות)**
```bash
POST /api/performance/pagespeed/full
```

4. **Mobile + Desktop ביחד**
```bash
POST /api/performance/pagespeed/both
```

5. **בדיקת מכסה**
```bash
GET /api/performance/quota
```

ראה פרטים מלאים ב-`API-DOCUMENTATION.md`.

---

## מגבלות ו-Quota

### מכסות חינם:
- **25,000 קריאות ליום** (ברירת מחדל של Google)
- השירות מגביל ל-**10,000 קריאות ליום** (להגנה על ה-quota שלך)

### איפוס יומי:
- המונה מתאפס כל יום ב-00:00 UTC

### בדיקת מכסה:
```bash
curl http://localhost:3000/api/performance/quota
```

### שינוי המגבלה:
ערוך `.env`:
```env
PSI_DAILY_LIMIT=5000  # הפחת ל-5,000 למשל
```

---

## פתרון בעיות

### שגיאה: "API key not configured"
**פתרון:**
1. וודא שקיים קובץ `.env`
2. בדוק ש-`GOOGLE_PAGESPEED_API_KEY` מוגדר
3. הפעל מחדש את השירות

### שגיאה: "API key not valid"
**פתרון:**
1. בדוק ש-ה-API Key נכון (העתק שוב מ-Google Cloud)
2. וודא ש-PageSpeed Insights API מופעל בפרויקט
3. בדוק הגבלות IP/Referrer

### שגיאה: "Daily limit exceeded"
**פתרון:**
1. בדוק את המכסה: `GET /api/performance/quota`
2. המתן עד 00:00 UTC למחרת
3. או העלה את `PSI_DAILY_LIMIT` ב-`.env`

### תוצאות שונות מממשק Google
**זה תקין!** ההבדלים יכולים לנבוע מ:
- זמן ריצה שונה (השרת עושה caching)
- מיקום גיאוגרפי של השרת
- Field Data משתנה עם הזמן

**אבל**, ה-Lab Data (ציונים ומדדים) צריכים להיות דומים מאוד!

---

## השוואה: PSI API לעומת Lighthouse מקומי

| תכונה | PSI API (מומלץ) | Lighthouse מקומי |
|---|---|---|
| תוצאות זהות לגוגל | ✅ כן | ❌ לא |
| Field Data (נתונים אמיתיים) | ✅ כן | ❌ לא |
| Throttling נכון | ✅ כן | ❌ לא |
| עלות | 🆓 חינם (25k/יום) | 🆓 חינם |
| מהירות | ~10-30 שניות | ~5-15 שניות |
| דיוק | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| אמינות | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

**המלצה:** השתמש תמיד ב-PSI API למעט אם אתה צריך לבדוק בסביבת פיתוח ללא אינטרנט.

---

## אבטחה

### אל תחשוף את ה-API Key!
- ✅ שמור ב-`.env` (לא ב-Git)
- ✅ הגבל לפי IP addresses
- ✅ השתמש רק ב-PageSpeed Insights API
- ❌ אל תשלח ל-client-side JavaScript
- ❌ אל תשתף באיזורים ציבוריים

### סביבת production:
- השתמש ב-environment variables (לא `.env` ישירות)
- Coolify / Docker: הגדר ב-Settings → Environment Variables
- הפעל HTTPS
- הגבל גישה לנתיב `/api/performance/*` במידת הצורך

---

## עדכון מקוד קיים

אם השתמשת בעבר ב-`/api/performance/lighthouse`, **שנה ל:**

```diff
- POST /api/performance/lighthouse
+ POST /api/performance/pagespeed
```

הקוד הישן עדיין יעבוד (backward compatibility), אבל יוסיף הודעת אזהרה.

---

## תמיכה

בעיות? בדוק:
1. `GET /api/performance/health` - סטטוס השירות
2. `GET /api/performance/quota` - מכסת API
3. Logs של השרת - שגיאות מפורטות

עזרה נוספת: פנה למפתח או ראה את התיעוד המלא ב-`API-DOCUMENTATION.md`.
