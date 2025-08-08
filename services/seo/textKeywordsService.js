const { execFile } = require('child_process');
const path = require('path');

function analyzeTextKeywords({ text, language = 'en', top_n = 12, timeout = 20000 } = {}) {
  return new Promise((resolve) => {
    try {
      const script = path.join(__dirname, '../../scripts/text_keywords.py');
      const payload = JSON.stringify({ text, language, top_n });

      const child = execFile('python3', [script, payload], { timeout }, (err, stdout, stderr) => {
        if (err) {
          console.warn('text_keywords.py failed:', err.message);
          return resolve({ success: false, error: err.message });
        }
        if (stderr) {
          // לעיתים ספריות כותבות ל-stderr למרות שהכול תקין
          console.warn('text_keywords.py stderr:', String(stderr).slice(0, 500));
        }
        try {
          const data = JSON.parse(stdout || '{}');
          return resolve(data);
        } catch (parseErr) {
          console.warn('text_keywords.py parse error:', parseErr.message);
          return resolve({ success: false, error: 'parse_error' });
        }
      });

      // בטיחות: אם משום מה אין אירוע חזרה
      child.on('error', (e) => {
        console.warn('text_keywords.py spawn error:', e.message);
        resolve({ success: false, error: e.message });
      });
    } catch (e) {
      console.warn('analyzeTextKeywords error:', e.message);
      resolve({ success: false, error: e.message });
    }
  });
}

module.exports = { analyzeTextKeywords };
