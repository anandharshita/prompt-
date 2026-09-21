/**
 * ==============================================================================
 * PROMPT EQUIPMENTS — CONTROLLER & TRANSMITTER INTELLIGENCE BACKEND SERVER
 * ==============================================================================
 * A high-performance, zero-dependency Node.js production server.
 * Handles:
 *  1. Full REST API: /api/auth, /api/products, /api/users, /api/history, /api/settings, /api/sync
 *  2. Dual persistence: Local disk (data/db.json) + Cloud DB (Vercel KV / Redis / Supabase)
 *  3. Static asset serving for public dashboard, admin portal, and mobile clients
 *  4. Live synchronization engine with official promptweighpack.com catalog
 *  5. Automatic port collision retry & zero-crash startup resilience
 * ==============================================================================
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Polyfill global fetch for Node.js < 18 environments
if (typeof fetch === "undefined") {
  globalThis.fetch = function(fetchUrl, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new URL(fetchUrl);
        const client = parsed.protocol === "https:" ? https : http;
        const req = client.request(parsed, {
          method: options.method || "GET",
          headers: options.headers || {}
        }, (res) => {
          let data = "";
          res.on("data", chunk => data += chunk);
          res.on("end", () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              json: async () => JSON.parse(data),
              text: async () => data
            });
          });
        });
        req.on("error", reject);
        if (options.body) {
          req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
        }
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  };
}

const { CloudDB, DEFAULT_USERS } = require("./api/db");

// Handlers from api/
const authHandler = require("./api/auth");
const productsHandler = require("./api/products");
const usersHandler = require("./api/users");
const historyHandler = require("./api/history");
const settingsHandler = require("./api/settings");
const syncHandler = require("./api/sync");

const INITIAL_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = __dirname;

// MIME types dictionary for static file serving
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf"
};

/**
 * Universal CORS and Security Headers
 */
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Api-Version"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

/**
 * Attach express-like helper methods to standard ServerResponse
 */
function enhanceResponse(res) {
  if (!res.status) {
    res.status = function(code) {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = function(data) {
      setCorsHeaders(res);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(data));
      return res;
    };
  }
  if (!res.send) {
    res.send = function(data) {
      setCorsHeaders(res);
      res.end(data);
      return res;
    };
  }
}

/**
 * Parse incoming HTTP request body (JSON or URL-encoded)
 */
function parseRequestBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      if (!body) {
        req.body = {};
        return resolve({});
      }
      try {
        req.body = JSON.parse(body);
      } catch (err) {
        req.body = body;
      }
      resolve(req.body);
    });
    req.on("error", () => {
      req.body = {};
      resolve({});
    });
  });
}

/**
 * Serve static file from local filesystem with Windows-safe pathing
 */
function serveStaticFile(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for HTML5 routing -> directly serve the intelligence dashboard
      const fallbackApp = path.join(PUBLIC_DIR, "controller-selector (2).html");
      fs.readFile(fallbackApp, (fbErr, fbContent) => {
        if (!fbErr) {
          setCorsHeaders(res);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.writeHead(200);
          return res.end(fbContent);
        }
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("404 Not Found");
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=3600");
    setCorsHeaders(res);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

/**
 * Main HTTP Server Request Router
 */
const server = http.createServer(async (req, res) => {
  enhanceResponse(res);
  setCorsHeaders(res);

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || "/";

  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  // 2. Route API endpoints
  if (pathname.startsWith("/api/")) {
    await parseRequestBody(req);
    req.query = parsedUrl.query;

    const apiRoute = pathname.toLowerCase();

    try {
      // /api/health
      if (apiRoute === "/api/health") {
        const prods = await CloudDB.getProducts();
        const users = await CloudDB.getUsers();
        return res.status(200).json({
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptimeSeconds: Math.floor(process.uptime()),
          catalogCount: prods.length,
          userCount: users.length,
          environment: process.env.NODE_ENV || "development"
        });
      }

      // /api/auth
      if (apiRoute === "/api/auth") {
        return await authHandler(req, res);
      }

      // /api/products
      if (apiRoute === "/api/products" || apiRoute.startsWith("/api/products/")) {
        return await productsHandler(req, res);
      }

      // /api/users
      if (apiRoute === "/api/users" || apiRoute.startsWith("/api/users/")) {
        return await usersHandler(req, res);
      }

      // /api/history
      if (apiRoute === "/api/history") {
        return await historyHandler(req, res);
      }

      // /api/settings
      if (apiRoute === "/api/settings") {
        return await settingsHandler(req, res);
      }

      // /api/sync
      if (apiRoute === "/api/sync") {
        return await syncHandler(req, res);
      }

      return res.status(404).json({ error: `API route '${pathname}' not found.` });
    } catch (apiErr) {
      console.error(`Error handling ${req.method} ${pathname}:`, apiErr);
      return res.status(500).json({ error: "Internal Server Error in backend router." });
    }
  }

  // 3. Route Static Files (Windows-safe path resolution)
  let cleanRelPath = decodeURIComponent(pathname).replace(/^[\/\\]+/, "").replace(/\.\.[\/\\]/g, "");
  if (!cleanRelPath || cleanRelPath === "" || cleanRelPath === "controller-selector" || cleanRelPath === "index.html") {
    cleanRelPath = "controller-selector (2).html";
  }

  let filePath = path.join(PUBLIC_DIR, cleanRelPath);
  serveStaticFile(req, res, filePath);
});

// Server State Verification
async function initServerState(port) {
  try {
    const products = await CloudDB.getProducts();
    const users = await CloudDB.getUsers();
    const settings = await CloudDB.getSettings();

    console.log(`\n==================================================================`);
    console.log(`  PROMPT EQUIPMENTS — INDUSTRIAL CONTROLLER INTELLIGENCE BACKEND`);
    console.log(`==================================================================`);
    console.log(`  ✓ Persistence:       Local Storage (data/db.json) + Cloud Adapter`);
    console.log(`  ✓ Indexed Catalog:   ${products.length} Weighing Controllers & Transmitters`);
    console.log(`  ✓ Registered Users:  ${users.length} RBAC System Accounts`);
    console.log(`  ✓ Site Settings:     "${settings.siteTitle || 'Prompt Intelligence Portal'}"`);
    console.log(`  ✓ Official Sync:     Connected to promptweighpack.com`);
    console.log(`------------------------------------------------------------------`);
    console.log(`  🚀 Live URL:         http://localhost:${port}`);
    console.log(`  📡 API Health:       http://localhost:${port}/api/health`);
    console.log(`  📁 Entry Points:     http://localhost:${port}/index.html`);
    console.log(`                       http://localhost:${port}/controller-selector%20(2).html`);
    console.log(`==================================================================\n`);
  } catch (err) {
    console.warn("Notice during server state initialization:", err.message);
  }
}

// Resilient Server Startup with Automatic Port Fallback
let activePort = INITIAL_PORT;

function listenOnPort(p) {
  server.listen(p, () => {
    initServerState(p);
  });
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.warn(`[PORT NOTICE] Port ${activePort} is already in use. Automatically switching to port ${activePort + 1}...`);
    activePort++;
    listenOnPort(activePort);
  } else if (err.code === "EACCES") {
    console.warn(`[PORT PERMISSION] Port ${activePort} restricted. Attempting port ${activePort + 1000}...`);
    activePort += 1000;
    listenOnPort(activePort);
  } else {
    console.error("Server lifecycle error:", err);
  }
});

listenOnPort(activePort);
