/**
 * SEO Recommendations Knowledge Base
 * מאגר המלצות מפורט עם הסברים, פעולות, והשפעה
 */

const RECOMMENDATIONS = {
  // ═══════════════════════════════════════
  // BASIC SEO
  // ═══════════════════════════════════════

  MISSING_TITLE: {
    issue: 'חסר כותרת (Title Tag)',
    why: 'הכותרת היא האלמנט החשוב ביותר ל-SEO. Google משתמש בה כדי להבין על מה העמוד ומציג אותה בתוצאות החיפוש.',
    impact: 'קריטי - ללא כותרת, העמוד כמעט לא יופיע בתוצאות חיפוש',
    priority: 'critical',
    category: 'quick-win',
    howToFix: [
      '1. הוסף תג <title> בתוך <head> של העמוד',
      '2. כתוב כותרת תיאורית ומזמינה באורך 50-60 תווים',
      '3. כלול את מילת המפתח העיקרית בתחילת הכותרת',
      '4. הפוך אותה ייחודית לכל עמוד'
    ],
    example: '<title>שירותי עיצוב פנים מקצועיים | טינה עיצובים</title>',
    resources: [
      'https://developers.google.com/search/docs/appearance/title-link'
    ]
  },

  TITLE_TOO_SHORT: {
    issue: 'כותרת קצרה מדי',
    why: 'כותרת קצרה מדי (מתחת ל-40 תווים) לא מנצלת את המקום בתוצאות החיפוש ועלולה להיראות לא מקצועית.',
    impact: 'בינוני - פוגע ב-CTR (אחוז הקליקים)',
    priority: 'high',
    category: 'quick-win',
    howToFix: [
      '1. הוסף מידע תיאורי נוסף לכותרת',
      '2. כלול את שם העסק/מותג',
      '3. הוסף Value Proposition (מה מייחד אותך)',
      '4. שמור על אורך של 50-60 תווים'
    ],
    example: 'לפני: "עיצוב פנים" | אחרי: "עיצוב פנים מקצועי לבית ולעסק | טינה עיצובים"'
  },

  TITLE_TOO_LONG: {
    issue: 'כותרת ארוכה מדי',
    why: 'Google מציג רק 50-60 תווים. כותרת ארוכה תיחתך באמצע ולא תוצג במלואה.',
    impact: 'בינוני - פוגע בהבנת התוכן מתוצאות החיפוש',
    priority: 'medium',
    category: 'quick-win',
    howToFix: [
      '1. קצר את הכותרת ל-50-60 תווים',
      '2. שמור את המידע החשוב ביותר בתחילה',
      '3. הסר מילות מילוי מיותרות',
      '4. העבר מידע משני ל-Meta Description'
    ],
    example: 'לפני: "שירותי עיצוב פנים מקצועיים לבתים פרטיים ועסקים קטנים ובינוניים באזור המרכז והצפון - טינה עיצובים" (100 תווים)\nאחרי: "עיצוב פנים לבית ולעסק באזור המרכז | טינה עיצובים" (54 תווים)'
  },

  MISSING_META_DESCRIPTION: {
    issue: 'חסר Meta Description',
    why: 'המטא תיאור מופיע בתוצאות החיפוש מתחת לכותרת. תיאור טוב מגדיל משמעותית את אחוז הקליקים (CTR).',
    impact: 'גבוה - פוגע ב-CTR ובהבנת התוכן',
    priority: 'high',
    category: 'quick-win',
    howToFix: [
      '1. הוסף תג <meta name="description" content="..."> בתוך <head>',
      '2. כתוב תיאור מזמין באורך 140-160 תווים',
      '3. כלול Call-to-Action (קריאה לפעולה)',
      '4. השתמש במילות מפתח רלוונטיות באופן טבעי'
    ],
    example: '<meta name="description" content="שירותי עיצוב פנים יוקרתיים לבתים ולעסקים. ייעוץ חינם, תכנון תלת-ממד, וליווי מלא. צור קשר עכשיו לפגישת היכרות ללא התחייבות.">',
    resources: [
      'https://developers.google.com/search/docs/appearance/snippet'
    ]
  },

  META_DESC_TOO_SHORT: {
    issue: 'Meta Description קצר מדי',
    why: 'תיאור קצר מדי (מתחת ל-120 תווים) לא מנצל את המקום בתוצאות החיפוש ולא מספק מספיק מידע למשתמש.',
    impact: 'בינוני - מפסיד הזדמנות לשכנע',
    priority: 'medium',
    category: 'quick-win',
    howToFix: [
      '1. הרחב את התיאור עם פרטים נוספים',
      '2. הוסף יתרונות ספציפיים (מה מייחד אותך)',
      '3. כלול Call-to-Action',
      '4. הגיע ל-140-160 תווים'
    ],
    example: 'לפני: "עיצוב פנים מקצועי" (20 תווים)\nאחרי: "שירותי עיצוב פנים יוקרתיים עם ניסיון של 15 שנה. תכנון תלת-ממד, ליווי מלא מהרעיון ועד המימוש. צור קשר לפגישת ייעוץ חינם." (142 תווים)'
  },

  META_DESC_TOO_LONG: {
    issue: 'Meta Description ארוך מדי',
    why: 'Google מציג רק 140-160 תווים. תיאור ארוך ייחתך באמצע ולא יוצג במלואה בתוצאות החיפוש.',
    impact: 'בינוני - פוגע בהבנת התוכן מתוצאות החיפוש',
    priority: 'medium',
    category: 'quick-win',
    howToFix: [
      '1. קצר את התיאור ל-140-160 תווים',
      '2. שמור את המידע החשוב ביותר בתחילה',
      '3. הסר מילות מילוי מיותרות',
      '4. ודא שיש Call-to-Action ברור'
    ],
    example: 'לפני: "שירותי עיצוב פנים מקצועיים ויוקרתיים לבתים פרטיים, דירות, משרדים, ועסקים קטנים ובינוניים באזור המרכז, הצפון והדרום, עם ניסיון של 15 שנה בתחום, מאות פרויקטים מוצלחים, ושירות מעולה" (210 תווים)\nאחרי: "עיצוב פנים יוקרתי לבית ולעסק. 15 שנות ניסיון, מאות פרויקטים. ייעוץ חינם, תכנון תלת-ממד, וליווי מלא. צור קשר עכשיו!" (145 תווים)'
  },

  // ═══════════════════════════════════════
  // TECHNICAL SEO
  // ═══════════════════════════════════════

  NOT_HTTPS: {
    issue: 'האתר לא מאובטח (אין HTTPS)',
    why: 'Google מעדיף אתרים מאובטחים וסימן "לא מאובטח" פוגע באמון המשתמשים. זהו גם גורם דירוג רשמי של Google.',
    impact: 'קריטי - פוגע בדירוג ובאמון המשתמשים',
    priority: 'critical',
    category: 'long-term',
    howToFix: [
      '1. רכוש תעודת SSL (יש גם חינמיות כמו Let\'s Encrypt)',
      '2. התקן את התעודה על השרת',
      '3. הפנה את כל התעבורה HTTP ל-HTTPS (301 redirect)',
      '4. עדכן את כל הקישורים הפנימיים ל-HTTPS',
      '5. עדכן ב-Google Search Console'
    ],
    resources: [
      'https://letsencrypt.org/',
      'https://developers.google.com/search/docs/crawling-indexing/https'
    ]
  },

  MISSING_CANONICAL: {
    issue: 'חסר Canonical URL',
    why: 'תג Canonical מונע תוכן כפול ומבהיר לגוגל איזו גרסה של העמוד היא העיקרית (לדוגמה: עם/בלי www).',
    impact: 'בינוני-גבוה - עלול ליצור בעיות תוכן כפול',
    priority: 'high',
    category: 'quick-win',
    howToFix: [
      '1. הוסף תג <link rel="canonical" href="URL"> בכל עמוד',
      '2. השתמש ב-URL המלא והמועדף (עם https://)',
      '3. ודא שה-canonical מצביע על גרסה אחת עקבית',
      '4. בעמוד עצמו, canonical צריך להצביע על עצמו'
    ],
    example: '<link rel="canonical" href="https://example.com/page">',
    resources: [
      'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls'
    ]
  },

  MISSING_VIEWPORT: {
    issue: 'חסר Viewport Meta Tag',
    why: 'ללא viewport tag, האתר לא יוצג נכון במכשירים ניידים. Google מדרג אתרים לפי גרסת המובייל (Mobile-First Indexing).',
    impact: 'קריטי - פוגע חמור בחוויית מובייל ובדירוג',
    priority: 'critical',
    category: 'quick-win',
    howToFix: [
      '1. הוסף את התג הבא ל-<head> של כל עמוד:',
      '   <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '2. בדוק שהאתר responsive במכשירים שונים',
      '3. השתמש ב-Chrome DevTools לבדיקה'
    ],
    example: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    resources: [
      'https://developers.google.com/search/mobile-sites/mobile-seo/responsive-design'
    ]
  },

  MISSING_ROBOTS: {
    issue: 'חסר Robots Meta Tag',
    why: 'תג Robots מאפשר לשלוט בכך שמנועי חיפוש יאנדקסו את העמוד או לא, ואם לעקוב אחרי קישורים.',
    impact: 'נמוך-בינוני - רצוי להוסיף לשליטה מלאה',
    priority: 'low',
    category: 'quick-win',
    howToFix: [
      '1. הוסף תג <meta name="robots" content="index, follow">',
      '2. לעמודים שלא רוצים לאנדקס: content="noindex"',
      '3. ודא עקביות עם robots.txt'
    ],
    example: '<meta name="robots" content="index, follow">',
    resources: [
      'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag'
    ]
  },

  MISSING_LANG: {
    issue: 'חסר שפה ב-HTML (lang attribute)',
    why: 'הגדרת שפה עוזרת למנועי חיפוש להציג את העמוד למשתמשים בשפה הנכונה ומשפרת נגישות.',
    impact: 'נמוך - משפר הבנה ונגישות',
    priority: 'low',
    category: 'quick-win',
    howToFix: [
      '1. הוסף lang attribute לתג <html>',
      '2. לעברית: <html lang="he">',
      '3. לאנגלית: <html lang="en">'
    ],
    example: '<html lang="he" dir="rtl">',
    resources: [
      'https://www.w3.org/International/questions/qa-html-language-declarations'
    ]
  },

  // ═══════════════════════════════════════
  // CONTENT SEO
  // ═══════════════════════════════════════

  CONTENT_TOO_SHORT: {
    issue: 'תוכן קצר מדי',
    why: 'Google מעדיף תוכן מקיף ומפורט. תוכן קצר (מתחת ל-300 מילים) לא מספק מספיק ערך למשתמשים ונחשב "thin content".',
    impact: 'גבוה - פוגע בדירוג ובערך לממשתמש',
    priority: 'high',
    category: 'long-term',
    howToFix: [
      '1. הרחב את התוכן ל-500+ מילים לפחות (800+ אופטימלי)',
      '2. הוסף פרטים, דוגמאות, וסטטיסטיקות',
      '3. ענה על שאלות נפוצות של המשתמשים',
      '4. הוסף כותרות משנה (H2, H3) למבנה ברור',
      '5. כלול רשימות ו-bullet points לקריאות'
    ],
    example: 'במקום: "אנחנו מציעים שירותי עיצוב פנים"\nכתוב: "שירותי עיצוב הפנים שלנו כוללים ייעוץ ראשוני חינם, תכנון תלת-ממד מפורט, בחירת חומרים ואביזרים, ניהול פרויקט מלא וליווי עד למימוש. עם ניסיון של 15 שנה, ביצענו למעלה מ-200 פרויקטים..."'
  },

  WEAK_KEYWORD_FOCUS: {
    issue: 'חוסר מיקוד בביטויי מפתח',
    why: 'ללא שימוש עקבי במילות/ביטויים מסוימים, Google לא מבין על מה העמוד ועבור אילו חיפושים להציג אותו.',
    impact: 'גבוה - פוגע בדירוג עבור מילות מפתח רלוונטיות',
    priority: 'high',
    category: 'long-term',
    howToFix: [
      '1. בחר 1-2 ביטויי מפתח ראשיים לעמוד',
      '2. השתמש בהם באופן טבעי ב:',
      '   - כותרת (Title)',
      '   - H1',
      '   - 2-3 כותרות משנה (H2/H3)',
      '   - פסקה ראשונה',
      '   - לאורך הטקסט (4-6 פעמים לפחות)',
      '3. השתמש גם בווריאציות וצורות שונות',
      '4. אל תגזים - זה צריך להישמע טבעי!'
    ],
    example: 'ביטוי מפתח: "עיצוב פנים למשרדים"\nהופעות: Title, H1, 2xH2, 5 פעמים בטקסט\nווריאציות: "עיצוב משרדים", "תכנון משרדי היטק", "עיצוב סביבת עבודה"'
  },

  FEW_HEADINGS: {
    issue: 'מעט כותרות משנה (H2/H3)',
    why: 'כותרות משנה יוצרות מבנה ברור, משפרות קריאות, ועוזרות לגוגל להבין את המבנה וההיררכיה של התוכן.',
    impact: 'בינוני - פוגע בקריאות וב-SEO',
    priority: 'medium',
    category: 'quick-win',
    howToFix: [
      '1. חלק את התוכן לסעיפים עם כותרות H2',
      '2. השתמש ב-H3 לתתי-סעיפים',
      '3. כלול מילות מפתח בכותרות באופן טבעי',
      '4. המלצה: לפחות 3-5 כותרות משנה לעמוד תוכן'
    ],
    example: 'H1: עיצוב פנים למשרדים\nH2: למה עיצוב משרד חשוב?\nH2: השירותים שלנו\nH3: תכנון ועיצוב\nH3: ייעוץ וליווי\nH2: פרויקטים שביצענו'
  },

  NO_INTERNAL_LINKS: {
    issue: 'אין קישורים פנימיים',
    why: 'קישורים פנימיים עוזרים למשתמשים לנווט, מפיצים "link juice" (כוח SEO) בין עמודים, ועוזרים לגוגל לגלות עמודים.',
    impact: 'בינוני-גבוה - פוגע ב-UX וב-SEO',
    priority: 'medium',
    category: 'quick-win',
    howToFix: [
      '1. קשר לעמודים רלוונטיים אחרים באתר (3-5 לפחות)',
      '2. השתמש ב-Anchor Text תיאורי (לא "לחץ כאן")',
      '3. קשר לעמודים עמוקים (לא רק לדף הבית)',
      '4. ודא שהקישורים רלוונטיים ומועילים למשתמש'
    ],
    example: 'במקום: "לפרטים נוספים <a href="/services">לחץ כאן</a>"\nכתוב: "ראה את <a href="/services">שירותי עיצוב הפנים המלאים שלנו</a>"'
  },

  POOR_READABILITY: {
    issue: 'קריאות נמוכה - משפטים ארוכים',
    why: 'משפטים ארוכים מקשים על הקריאה והבנה. Google מעדיף תוכן קריא שמספק חוויה טובה למשתמשים.',
    impact: 'בינוני - פוגע ב-UX ובזמן שהייה',
    priority: 'medium',
    category: 'long-term',
    howToFix: [
      '1. פצל משפטים ארוכים למשפטים קצרים',
      '2. העברית: 10-18 מילים למשפט (אופטימלי)',
      '3. אנגלית: 12-20 מילים למשפט',
      '4. השתמש ברשימות (bullets) לנקודות מרובות',
      '5. הוסף פסקאות קצרות (3-5 שורות)',
      '6. השתמש בכותרות משנה לחלוקת התוכן'
    ],
    example: 'לפני: "שירותי עיצוב הפנים שלנו כוללים תכנון ועיצוב מלא של חללי מגורים ועסקים, כולל בחירת חומרים, רהיטים, ואביזרים, ניהול פרויקט וליווי מלא עד למימוש הסופי של הפרויקט" (30 מילים)\n\nאחרי:\n"שירותי עיצוב הפנים שלנו כוללים:\n• תכנון ועיצוב מלא\n• בחירת חומרים ורהיטים\n• ניהול וליווי עד למימוש"'
  },

  // ═══════════════════════════════════════
  // MEDIA & UX
  // ═══════════════════════════════════════

  MISSING_ALT_TEXT: {
    issue: 'תמונות ללא טקסט חלופי (Alt Text)',
    why: 'Alt Text עוזר לגוגל להבין מה מופיע בתמונה (Google Images), משפר נגישות לכבדי ראייה, ומוצג כשהתמונה לא נטענת.',
    impact: 'בינוני - פוגע ב-SEO של תמונות ובנגישות',
    priority: 'medium',
    category: 'quick-win',
    howToFix: [
      '1. הוסף alt attribute לכל תמונה',
      '2. תאר את התמונה בקצרה ובצורה תיאורית (לא "תמונה1.jpg")',
      '3. כלול מילות מפתח רלוונטיות באופן טבעי',
      '4. שמור על 5-15 מילים',
      '5. אל תתחיל ב-"תמונה של" - זה מובן מאליו'
    ],
    example: 'רע: <img src="img1.jpg" alt="תמונה">\nטוב: <img src="living-room.jpg" alt="סלון מעוצב בסגנון מודרני עם ספה אפורה ושטיח צמר">',
    resources: [
      'https://developers.google.com/search/docs/appearance/google-images#descriptive-alt-text'
    ]
  },

  NOT_RESPONSIVE: {
    issue: 'האתר לא Responsive (לא מותאם למובייל)',
    why: 'Google משתמש ב-Mobile-First Indexing - הוא מדרג את האתר לפי גרסת המובייל. אתר לא responsive יקבל דירוג נמוך.',
    impact: 'קריטי - פוגע קשות בדירוג וב-UX',
    priority: 'critical',
    category: 'long-term',
    howToFix: [
      '1. השתמש ב-responsive design framework (Bootstrap, Tailwind)',
      '2. השתמש ב-CSS media queries',
      '3. בדוק באמצעות Mobile-Friendly Test של Google',
      '4. ודא viewport meta tag מוגדר נכון',
      '5. בדוק במכשירים שונים (טלפון, טאבלט)'
    ],
    resources: [
      'https://search.google.com/test/mobile-friendly',
      'https://developers.google.com/search/mobile-sites'
    ]
  },

  SLOW_LOAD_TIME: {
    issue: 'זמן טעינה איטי',
    why: 'זמן טעינה איטי גורם למשתמשים לעזוב את האתר ופוגע בדירוג Google. Core Web Vitals הם גורם דירוג רשמי.',
    impact: 'גבוה - פוגע ב-UX, Conversion, ודירוג',
    priority: 'high',
    category: 'long-term',
    howToFix: [
      '1. דחוס תמונות (WebP, Lazy Loading)',
      '2. השתמש ב-CDN לקבצים סטטיים',
      '3. מזער CSS ו-JavaScript (Minify)',
      '4. הפעל Caching בשרת',
      '5. הסר קוד לא נחוץ',
      '6. השתמש ב-PageSpeed Insights API לזיהוי בעיות'
    ],
    resources: [
      'https://developers.google.com/speed/pagespeed/insights/'
    ]
  },

  LINKS_WITHOUT_TEXT: {
    issue: 'קישורים ללא טקסט',
    why: 'קישורים ללא טקסט (anchor text ריק) פוגעים בנגישות, UX, ולא מספקים הקשר לגוגל על תוכן היעד.',
    impact: 'נמוך-בינוני - פוגע בנגישות וב-SEO',
    priority: 'low',
    category: 'quick-win',
    howToFix: [
      '1. הוסף טקסט תיאורי לכל קישור',
      '2. אם הקישור על תמונה, ודא שלתמונה יש alt text',
      '3. אל להשתמש בקישורים עם אייקונים בלבד ללא תיאור'
    ],
    example: 'רע: <a href="/contact"><img src="icon.png"></a>\nטוב: <a href="/contact"><img src="icon.png" alt="צור קשר">צור קשר</a>'
  },

  // ═══════════════════════════════════════
  // STRUCTURED DATA & LLM
  // ═══════════════════════════════════════

  NO_STRUCTURED_DATA: {
    issue: 'חסר Structured Data (JSON-LD)',
    why: 'Structured Data הוא קריטי למנועי חיפוש מודרניים, LLMs (ChatGPT, Perplexity), ו-Voice Search. ללא זה, האתר "בלתי נראה" ל-AI.',
    impact: 'קריטי - פוגע ב-Rich Results, AI Search, Voice Search',
    priority: 'critical',
    category: 'long-term',
    howToFix: [
      '1. הוסף לכל עמוד <script type="application/ld+json">',
      '2. התחל עם schemas בסיסיים:',
      '   • Organization - מידע על העסק',
      '   • WebSite - מידע על האתר',
      '   • WebPage - מידע על העמוד',
      '3. השתמש ב-Schema.org Generator',
      '4. בדוק עם Rich Results Test של Google'
    ],
    example: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "טינה עיצובים",
  "url": "https://teena.co.il",
  "logo": "https://teena.co.il/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+972-50-1234567",
    "contactType": "Customer Service"
  }
}
</script>`,
    resources: [
      'https://schema.org/',
      'https://search.google.com/test/rich-results',
      'https://technicalseo.com/tools/schema-markup-generator/'
    ]
  },

  WEAK_LLM_READINESS: {
    issue: 'Schema Markup לא מספיק מקיף ל-AI Engines',
    why: 'LLMs כמו ChatGPT, Google AI Overview, ו-Perplexity מסתמכים על Structured Data. ללא schemas מקיפים, האתר לא יופיע בתשובות AI.',
    impact: 'קריטי - פוגע בנראות ב-AI Search העתידי',
    priority: 'critical',
    category: 'long-term',
    howToFix: [
      '1. הוסף Organization Schema עם כל הפרטים',
      '2. הוסף WebSite Schema עם SearchAction',
      '3. הוסף BreadcrumbList לניווט',
      '4. לעמודי מאמרים: הוסף Article Schema עם author, publisher, datePublished',
      '5. למוצרים: הוסף Product Schema עם offers, rating',
      '6. הוסף FAQ Schema לשאלות נפוצות',
      '7. ודא שיש @context, mainEntity, ותמונות'
    ],
    resources: [
      'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data'
    ]
  },

  MISSING_BREADCRUMB: {
    issue: 'חסר BreadcrumbList Schema',
    why: 'Breadcrumbs עוזרים ל-Google להבין את מבנה האתר ומשפרים ניווט ב-AI search engines.',
    impact: 'בינוני - משפר הבנת מבנה האתר',
    priority: 'medium',
    category: 'long-term',
    howToFix: [
      '1. הוסף רכיב breadcrumb visual באתר',
      '2. הוסף BreadcrumbList Schema בכל עמוד',
      '3. כלול את הנתיב המלא מהבית ועד העמוד הנוכחי'
    ],
    example: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [{
    "@type": "ListItem",
    "position": 1,
    "name": "בית",
    "item": "https://example.com"
  },{
    "@type": "ListItem",
    "position": 2,
    "name": "שירותים",
    "item": "https://example.com/services"
  }]
}
</script>`
  },

  // ═══════════════════════════════════════
  // SOCIAL
  // ═══════════════════════════════════════

  NO_OPEN_GRAPH: {
    issue: 'חסר Open Graph Tags',
    why: 'Open Graph שולט כיצד העמוד מוצג כששמשתפים אותו ברשתות חברתיות (Facebook, LinkedIn, WhatsApp).',
    impact: 'בינוני - פוגע בשיתופים ברשתות חברתיות',
    priority: 'medium',
    category: 'quick-win',
    howToFix: [
      '1. הוסף Open Graph meta tags ל-<head>:',
      '   • og:title - כותרת',
      '   • og:description - תיאור',
      '   • og:image - תמונה (1200x630px מומלץ)',
      '   • og:url - כתובת העמוד',
      '   • og:type - סוג (website/article)',
      '2. בדוק עם Facebook Sharing Debugger'
    ],
    example: `<meta property="og:title" content="עיצוב פנים מקצועי">
<meta property="og:description" content="שירותי עיצוב פנים יוקרתיים...">
<meta property="og:image" content="https://example.com/og-image.jpg">
<meta property="og:url" content="https://example.com/page">`,
    resources: [
      'https://developers.facebook.com/tools/debug/'
    ]
  },

  NO_OG_IMAGE: {
    issue: 'חסר תמונה לשיתוף (og:image)',
    why: 'שיתופים עם תמונה מקבלים פי 2-3 יותר קליקים. ללא תמונה, השיתוף נראה לא מקצועי.',
    impact: 'בינוני - פוגע ב-CTR מרשתות חברתיות',
    priority: 'medium',
    category: 'quick-win',
    howToFix: [
      '1. צור תמונה 1200x630px לכל עמוד (או לפחות עמודים ראשיים)',
      '2. כלול טקסט, לוגו, ועיצוב מזמין',
      '3. הוסף: <meta property="og:image" content="URL">',
      '4. הוסף גם: <meta property="og:image:width" content="1200">',
      '                <meta property="og:image:height" content="630">'
    ],
    example: '<meta property="og:image" content="https://example.com/images/og-homepage.jpg">'
  }
};

module.exports = RECOMMENDATIONS;
