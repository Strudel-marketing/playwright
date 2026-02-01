const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SITES_FILE = path.join(DATA_DIR, 'invoice-sites.json');
const HISTORY_FILE = path.join(DATA_DIR, 'invoice-history.json');

// Simple encryption for credentials using app secret
const ALGO = 'aes-256-cbc';
const getKey = () => {
  const secret = process.env.INVOICE_SECRET || process.env.API_KEY || 'default-secret-change-me';
  return crypto.scryptSync(secret, 'salt', 32);
};

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJSON(filePath, fallback = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

async function writeJSON(filePath, data) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// --- Site Configs ---

async function getSites() {
  const sites = await readJSON(SITES_FILE, []);
  // Mask credentials in output
  return sites.map(s => ({
    ...s,
    credentials: s.credentials ? Object.fromEntries(
      Object.entries(s.credentials).map(([k, v]) => [k, '********'])
    ) : null
  }));
}

async function getSitesRaw() {
  const sites = await readJSON(SITES_FILE, []);
  // Decrypt credentials
  return sites.map(s => {
    if (s.credentials) {
      const decrypted = {};
      for (const [k, v] of Object.entries(s.credentials)) {
        try { decrypted[k] = decrypt(v); } catch { decrypted[k] = v; }
      }
      return { ...s, credentials: decrypted };
    }
    return s;
  });
}

async function getSite(id) {
  const sites = await getSitesRaw();
  return sites.find(s => s.id === id) || null;
}

async function saveSite(site) {
  const sites = await readJSON(SITES_FILE, []);

  // Encrypt credentials
  if (site.credentials) {
    const encrypted = {};
    for (const [k, v] of Object.entries(site.credentials)) {
      encrypted[k] = encrypt(v);
    }
    site.credentials = encrypted;
  }

  const idx = sites.findIndex(s => s.id === site.id);
  if (idx >= 0) {
    sites[idx] = { ...sites[idx], ...site, updatedAt: new Date().toISOString() };
  } else {
    site.id = site.id || `site_${Date.now()}`;
    site.createdAt = new Date().toISOString();
    site.updatedAt = site.createdAt;
    sites.push(site);
  }

  await writeJSON(SITES_FILE, sites);
  return site;
}

async function deleteSite(id) {
  const sites = await readJSON(SITES_FILE, []);
  const filtered = sites.filter(s => s.id !== id);
  await writeJSON(SITES_FILE, filtered);
  return filtered.length < sites.length;
}

// --- History ---

async function getHistory(limit = 50) {
  const history = await readJSON(HISTORY_FILE, []);
  return history.slice(-limit).reverse();
}

async function addHistory(entry) {
  const history = await readJSON(HISTORY_FILE, []);
  entry.id = `run_${Date.now()}`;
  entry.timestamp = new Date().toISOString();
  history.push(entry);
  // Keep last 500 entries
  const trimmed = history.slice(-500);
  await writeJSON(HISTORY_FILE, trimmed);
  return entry;
}

module.exports = {
  getSites,
  getSitesRaw,
  getSite,
  saveSite,
  deleteSite,
  getHistory,
  addHistory,
  encrypt,
  decrypt
};
