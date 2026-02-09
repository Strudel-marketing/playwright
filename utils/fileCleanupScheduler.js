/**
 * File Cleanup Scheduler
 *
 * מנקה קבצי screenshots ו-PDFs ישנים מעל גיל מוגדר (ברירת מחדל: 90 יום)
 * רץ פעם ביום בשעה 03:00 בלילה
 */

const fs = require('fs');
const path = require('path');

class FileCleanupScheduler {
  constructor() {
    this.intervalId = null;
    this.running = false;
    this.maxAgeDays = parseInt(process.env.FILE_CLEANUP_DAYS) || 90;
    this.directories = [
      { path: '/app/screenshots', label: 'screenshots' },
      { path: './screenshots', label: 'screenshots (local)' },
      { path: './pdfs', label: 'pdfs' },
    ];
    this.lastRun = null;
    this.lastResult = null;
  }

  /**
   * התחלת ה-scheduler - בודק כל 30 דקות אם הגיע הזמן לניקוי
   */
  start() {
    if (this.running) return;
    this.running = true;

    console.log(`🧹 File cleanup scheduler started (deleting files older than ${this.maxAgeDays} days)`);

    // בדיקה כל 30 דקות אם הגיע 03:00
    this.intervalId = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() < 30) {
        // רץ רק פעם אחת ביום
        const today = now.toISOString().split('T')[0];
        if (this.lastRun !== today) {
          this.cleanup();
        }
      }
    }, 30 * 60 * 1000);

    // ניקוי ראשוני בהפעלה (רק אם לא רץ היום)
    const today = new Date().toISOString().split('T')[0];
    if (this.lastRun !== today) {
      this.cleanup();
    }
  }

  /**
   * ביצוע ניקוי בפועל
   */
  cleanup() {
    const now = new Date();
    const maxAgeMs = this.maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - maxAgeMs);

    let totalDeleted = 0;
    let totalFreedBytes = 0;
    const details = [];

    console.log(`🧹 Running file cleanup (removing files older than ${this.maxAgeDays} days, before ${cutoff.toISOString()})`);

    for (const dir of this.directories) {
      const result = this._cleanDirectory(dir.path, dir.label, cutoff);
      totalDeleted += result.deleted;
      totalFreedBytes += result.freedBytes;
      if (result.deleted > 0) {
        details.push(result);
      }
    }

    this.lastRun = now.toISOString().split('T')[0];
    this.lastResult = {
      timestamp: now.toISOString(),
      totalDeleted,
      totalFreedBytes,
      totalFreedMB: (totalFreedBytes / (1024 * 1024)).toFixed(2),
      details,
    };

    if (totalDeleted > 0) {
      console.log(`🧹 Cleanup complete: deleted ${totalDeleted} files, freed ${this.lastResult.totalFreedMB} MB`);
    } else {
      console.log('🧹 Cleanup complete: no old files to delete');
    }

    return this.lastResult;
  }

  /**
   * ניקוי תיקייה ספציפית
   */
  _cleanDirectory(dirPath, label, cutoff) {
    const result = { directory: label, path: dirPath, deleted: 0, freedBytes: 0, errors: [] };

    if (!fs.existsSync(dirPath)) {
      return result;
    }

    try {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);

        try {
          const stats = fs.statSync(filePath);

          // דלג על תיקיות
          if (stats.isDirectory()) continue;

          if (stats.mtime < cutoff) {
            fs.unlinkSync(filePath);
            result.deleted++;
            result.freedBytes += stats.size;
            console.log(`🗑️ Deleted: ${filePath} (${(stats.size / 1024).toFixed(1)} KB, modified ${stats.mtime.toISOString()})`);
          }
        } catch (fileError) {
          result.errors.push({ file: filePath, error: fileError.message });
          console.error(`⚠️ Failed to process ${filePath}:`, fileError.message);
        }
      }
    } catch (dirError) {
      result.errors.push({ directory: dirPath, error: dirError.message });
      console.error(`⚠️ Failed to read directory ${dirPath}:`, dirError.message);
    }

    return result;
  }

  /**
   * עצירת ה-scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    console.log('🧹 File cleanup scheduler stopped');
  }

  /**
   * סטטוס ה-scheduler
   */
  getStatus() {
    return {
      running: this.running,
      maxAgeDays: this.maxAgeDays,
      directories: this.directories.map(d => d.path),
      lastRun: this.lastRun,
      lastResult: this.lastResult,
    };
  }
}

module.exports = new FileCleanupScheduler();
