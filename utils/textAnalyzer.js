/**
 * Text Analyzer Utilities
 * מודול משותף לניתוח טקסט וחילוץ מילות מפתח
 *
 * משמש את: knowledgeService, knowledgeRoutes
 */

// Stop words - רשימה מרוכזת
const STOP_WORDS_EN = new Set([
  'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  'this', 'that', 'these', 'those', 'from', 'into', 'over', 'under', 'out',
  'up', 'down', 'as', 'if', 'then', 'else', 'than', 'very', 'more', 'most',
  'less', 'least', 'same', 'such', 'per', 'via', 'within', 'without'
]);

const STOP_WORDS_HE = new Set([
  'של', 'את', 'עם', 'על', 'אל', 'כל', 'לא', 'אם', 'כי', 'זה', 'היא', 'הוא',
  'ב', 'ל', 'מ', 'ה', 'ו', 'אני', 'אתה', 'הם', 'אנחנו', 'יש', 'או', 'גם',
  'אנו', 'אתם', 'אתן', 'הן', 'רק', 'כמו', 'לפי', 'בין', 'אין', 'להיות'
]);

const STOP_WORDS_ALL = new Set([...STOP_WORDS_EN, ...STOP_WORDS_HE]);

// Stop topics - מילים כלליות לסינון topics
const STOP_TOPICS = new Set([
  'scientific', 'article', 'published', 'study', 'paper', 'report',
  'overview', 'introduction', 'conclusion',
  'december', 'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november'
]);

/**
 * חילוץ מילות מפתח מטקסט
 * @param {string} text - הטקסט לניתוח
 * @param {Object} options - אפשרויות
 * @param {number} options.topN - מספר מילות מפתח להחזיר (default: 10)
 * @param {number} options.minLength - אורך מינימלי למילה (default: 2)
 * @param {boolean} options.includeNumbers - האם לכלול מספרים (default: false)
 * @returns {Array<string>} - מערך של מילות מפתח
 */
function extractKeywordsFromText(text, options = {}) {
  const {
    topN = 10,
    minLength = 2,
    includeNumbers = false
  } = options;

  try {
    const words = String(text || '')
      .toLowerCase()
      // שמירה על עברית ואנגלית בלבד
      .replace(/[^\u0590-\u05FF\u0041-\u005A\u0061-\u007A\s]/g, ' ')
      .split(/\s+/)
      .filter(word => {
        if (word.length <= minLength) return false;
        if (STOP_WORDS_ALL.has(word)) return false;
        if (!includeNumbers && /^\d+$/.test(word)) return false;
        return true;
      });

    // ספירת תדירות
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // מיון לפי תדירות והחזרת topN
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([word]) => word);

  } catch (error) {
    console.error('Error extracting keywords from text:', error);
    return [];
  }
}

/**
 * ניקוי topics/phrases - מסנן מילים כלליות, QIDs, ואורך לא מתאים
 * @param {Array} topics - מערך של topics
 * @param {number} maxTopics - מספר מקסימלי של topics להחזיר (default: 6)
 * @param {Object} options - אפשרויות נוספות
 * @returns {Array<string>}
 */
function cleanTopics(topics, maxTopics = 6, options = {}) {
  const {
    minWords = 2,
    maxWords = 4,
    filterQids = true
  } = options;

  const isQid = (value) => typeof value === 'string' && /^q\d+$/i.test(value);

  const result = [];
  const seen = new Set();

  for (const topic of (topics || [])) {
    const str = String(topic || '').toLowerCase().trim();

    // דילוגים
    if (!str) continue;
    if (filterQids && isQid(str)) continue;
    if (STOP_TOPICS.has(str)) continue;

    // בדיקת אורך (2-4 מילים)
    const words = str.split(/\s+/);
    if (words.length < minWords || words.length > maxWords) continue;

    // בדיקת כפילות
    const key = words.join(' ');
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(key);

    if (result.length >= maxTopics) break;
  }

  return result;
}

/**
 * יצירת שאלות FAQ מתוך keyphrases
 * @param {Array} keyphrases - מערך של ביטויים
 * @param {number} maxFaqs - מספר מקסימלי של FAQs (default: 5)
 * @param {string} language - שפה ('he' או 'en', default: 'he')
 * @returns {Array<string>}
 */
function buildFaqs(keyphrases, maxFaqs = 5, language = 'he') {
  const isQid = (value) => typeof value === 'string' && /^q\d+$/i.test(value);

  const faqs = [];
  const taken = new Set();

  const questionTemplates = {
    he: (phrase) => `מה זה ${phrase}?`,
    en: (phrase) => `What is ${phrase}?`
  };

  const template = questionTemplates[language] || questionTemplates.he;

  for (const phrase of (keyphrases || [])) {
    const str = String(phrase || '').toLowerCase().trim();

    // דילוגים
    if (!str) continue;
    if (isQid(str)) continue;
    if (STOP_TOPICS.has(str)) continue;

    // בדיקת אורך (2-5 מילים)
    const words = str.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;

    // יצירת שאלה
    const question = template(str);
    if (taken.has(question)) continue;

    taken.add(question);
    faqs.push(question);

    if (faqs.length >= maxFaqs) break;
  }

  return faqs;
}

/**
 * זיהוי שפה של טקסט (עברית/אנגלית)
 * @param {string} text - הטקסט לזיהוי
 * @returns {string} - 'he', 'en', או 'unknown'
 */
function detectLanguage(text) {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = hebrewChars + englishChars;

  if (totalChars === 0) return 'unknown';

  const hebrewRatio = hebrewChars / totalChars;
  const englishRatio = englishChars / totalChars;

  if (hebrewRatio > 0.3) return 'he';
  if (englishRatio > 0.3) return 'en';

  return 'unknown';
}

/**
 * ספירת מילים בטקסט
 * @param {string} text - הטקסט
 * @returns {number}
 */
function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length;
}

/**
 * חישוב אורך משפט ממוצע
 * @param {string} text - הטקסט
 * @returns {number}
 */
function calculateAvgSentenceLength(text) {
  const sentences = String(text || '')
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 0);

  if (sentences.length === 0) return 0;

  const words = countWords(text);
  return Number((words / sentences.length).toFixed(1));
}

module.exports = {
  // Constants
  STOP_WORDS_EN,
  STOP_WORDS_HE,
  STOP_WORDS_ALL,
  STOP_TOPICS,

  // Main functions
  extractKeywordsFromText,
  cleanTopics,
  buildFaqs,

  // Helper functions
  detectLanguage,
  countWords,
  calculateAvgSentenceLength
};
