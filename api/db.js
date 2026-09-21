/**
 * Unified Cloud Persistence Adapter for Prompt Intelligence Dashboard
 * Auto-detects available cloud storage:
 * 1. Vercel KV / Upstash Redis (KV_REST_API_URL, KV_REST_API_TOKEN)
 * 2. Supabase REST (SUPABASE_URL, SUPABASE_KEY)
 * 3. In-memory / Fallback cache
 */

// In-memory cache fallback for serverless warm instances
const memoryStore = {
  products: null,
  users: null,
  history: [],
  settings: {
    siteTitle: "Prompt Equipments — Industrial Controller & Transmitter Intelligence Dashboard",
    companyName: "Prompt Equipments",
    officialUrl: "https://www.promptweighpack.com/products/",
    contactEmail: "sales@promptweighpack.com",
    contactPhone: "+91 79 4004 0000",
    announcementBanner: "",
    autoSyncEnabled: true,
    syncIntervalHours: 24,
    lastSyncTimestamp: null
  }
};

// Default seed users
const DEFAULT_USERS = [
  {
    id: "usr_superadmin",
    username: "superadmin_ho",
    passwordHash: "prompt@super000",
    displayName: "Super Administrator",
    role: "superadmin",
    createdAt: "2026-01-01T00:00:00.000Z",
    active: true
  },
  {
    id: "usr_admin",
    username: "promptweighpack_ho",
    passwordHash: "prompt@000",
    displayName: "Prompt Catalog Admin",
    role: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    active: true
  }
];

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

function extractSeedProductsFromHtml() {
  try {
    const htmlPath = path.join(__dirname, "..", "controller-selector (2).html");
    if (fs.existsSync(htmlPath)) {
      const content = fs.readFileSync(htmlPath, "utf8");
      const match = content.match(/const\s+SEED_DATA\s*=\s*(\[[\s\S]*?\]);\s*\/\* ====/);
      if (match && match[1]) {
        const fn = new Function("return " + match[1]);
        const data = fn();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    }
  } catch (err) {}
  return [];
}

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = readDataFile();
    if (!current || !Array.isArray(current.products) || current.products.length === 0) {
      // If db.json exists with products, keep it, otherwise initialize
      let initial = current || {};
      if (!Array.isArray(initial.products) || initial.products.length === 0) {
        const seeds = extractSeedProductsFromHtml();
        initial.products = seeds.length > 0 ? seeds : [];
      }
      if (!Array.isArray(initial.categories)) {
        initial.categories = ["Weighing Controllers", "Weighing Transmitters"];
      }
      if (!Array.isArray(initial.users)) {
        initial.users = DEFAULT_USERS;
      }
      if (!Array.isArray(initial.history)) {
        initial.history = [];
      }
      if (!initial.settings) {
        initial.settings = memoryStore.settings;
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
    }
  } catch (err) {}
}

function readDataFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (err) {}
  return null;
}

function writeDataFile(key, value) {
  try {
    let current = readDataFile() || {};
    current[key] = value;
    fs.writeFileSync(DATA_FILE, JSON.stringify(current, null, 2), "utf8");
  } catch (err) {}
}

class CloudDB {
  static async get(key) {
    // 1. Try Vercel KV / Upstash Redis
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
          headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
        });
        const data = await res.json();
        if (data && data.result) {
          try {
            return JSON.parse(data.result);
          } catch {
            return data.result;
          }
        }
      } catch (err) {
        console.error("Vercel KV get error:", err);
      }
    }

    // 2. Try Supabase
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)) {
      try {
        const keyVal = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
        const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/app_storage?key=eq.${key}&select=value`, {
          headers: {
            apikey: keyVal,
            Authorization: `Bearer ${keyVal}`
          }
        });
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return rows[0].value;
        }
      } catch (err) {
        console.error("Supabase get error:", err);
      }
    }

    // 3. Try Local File Storage
    const fileData = readDataFile();
    if (fileData && fileData[key] !== undefined && fileData[key] !== null) {
      return fileData[key];
    }

    // 4. Fallback to in-memory store
    return memoryStore[key] || null;
  }

  static async set(key, value) {
    // Update in-memory store
    memoryStore[key] = value;

    // Update local file storage
    writeDataFile(key, value);

    // 1. Try Vercel KV / Upstash Redis
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const strVal = JSON.stringify(value);
        await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify([key, strVal])
        });
      } catch (err) {
        console.error("Vercel KV set error:", err);
      }
    }

    // 2. Try Supabase
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)) {
      try {
        const keyVal = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/app_storage`, {
          method: "POST",
          headers: {
            apikey: keyVal,
            Authorization: `Bearer ${keyVal}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          },
          body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
        });
      } catch (err) {
        console.error("Supabase set error:", err);
      }
    }

    return true;
  }

  static async getProducts() {
    let prods = await this.get("products");
    if (!prods) {
      prods = memoryStore.products || [];
    }
    if (Array.isArray(prods)) {
      prods.forEach(p => {
        if (p.price === undefined) p.price = "";
        if (p.priceTerms === undefined) p.priceTerms = "";
        if (p.leadTime === undefined) p.leadTime = "";
      });
    }
    return prods;
  }

  static async setProducts(products) {
    return await this.set("products", products);
  }

  static async getCategories() {
    let cats = await this.get("categories");
    if (!cats || !Array.isArray(cats) || cats.length === 0) {
      cats = ["Weighing Controllers", "Weighing Transmitters"];
    }
    return cats;
  }

  static async setCategories(categories) {
    return await this.set("categories", categories);
  }

  static async getUsers() {
    let users = await this.get("users");
    if (!users || !Array.isArray(users) || users.length === 0) {
      users = DEFAULT_USERS;
      await this.set("users", users);
    }
    return users;
  }

  static async setUsers(users) {
    return await this.set("users", users);
  }

  static async getHistory() {
    let hist = await this.get("history");
    if (!hist || !Array.isArray(hist)) hist = [];
    return hist;
  }

  static async addHistoryEntry(entry) {
    const hist = await this.getHistory();
    const newEntry = {
      id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      ...entry
    };
    hist.unshift(newEntry);
    if (hist.length > 500) hist.length = 500;
    await this.set("history", hist);
    return newEntry;
  }

  static async getSettings() {
    let settings = await this.get("settings");
    if (!settings) settings = memoryStore.settings;
    return settings;
  }

  static async setSettings(settings) {
    return await this.set("settings", settings);
  }
}

module.exports = { CloudDB, DEFAULT_USERS };
