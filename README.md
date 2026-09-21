# Prompt Equipments — Controller & Transmitter Intelligence Dashboard

A scalable, cloud-ready, mobile-optimized industrial dashboard for Prompt Equipments weighing controllers and transmitters. Engineered for office collaboration, customer sharing, live cloud synchronization, and deployment on **Vercel**.

---

## 🌟 Key Architecture & Capabilities

### 1. Multi-Role Access Control (RBAC)
- **Guest (Customers & Office Colleagues)**:
  - **Zero credentials required**. Instant, open access to search, multi-filter, inspect full engineering spec sheets, compare controllers side-by-side, export comparison tables, print datasheets, and download PDF brochures.
  - **Shareable Deep Links**: Share pre-filtered views or comparison matrices directly with clients via URL (e.g., `?compare=mo4,gm8804c-2` or `?category=Weighing+Controllers`).
- **Admin**:
  - Secure login with designated username & password (default: `promptweighpack` / `prompt2026`).
  - Full CRUD capability: Add new controllers, edit technical specs, upload images, manage dynamic custom specifications.
  - Can update general site settings (announcement banner, contact details).
  - All modifications are automatically tracked in the cloud audit trail.
- **Super Admin**:
  - Master administrative control (default: `superadmin_ho` / `prompt@super000`).
  - **User Management**: Create, edit, reset passwords, deactivate, or delete Admin accounts.
  - **Audit Trail & Change History**: Inspect full chronological timeline of who changed what, when, and exact before/after data snapshots.
  - **One-Click UNDO / Rollback**: Instant `⏪ Rollback` button next to any change event to revert erroneous edits, restore accidentally deleted products, or undo additions across the cloud database.
  - **Official Site Sync**: Direct synchronization with `https://www.promptweighpack.com/products/`.

---

### 2. Live Cloud Sync & Scalability
- **Vercel Serverless Architecture**:
  - `/api/products.js`: Real-time product CRUD with cloud database persistence.
  - `/api/history.js`: Audit logging with atomic rollback endpoint (`POST /api/history` with `action: "undo"`).
  - `/api/users.js`: Role-based user administration.
  - `/api/settings.js`: Global site configuration & announcement banner management.
  - `/api/sync.js`: Direct crawler and synchronization with the official company WooCommerce REST API.
  - `/api/auth.js`: Authentication and role validation.
- **Cloud Database Support**:
  - Native plug-and-play support for **Vercel KV / Upstash Redis** or **Supabase PostgreSQL**.
  - Local/hybrid fallback: Automatically falls back to browser storage (`localStorage` + `sessionStorage`) if running offline or without serverless functions.

---

### 3. Direct Connection to Official Company Website
- Directly integrates with the official website: `https://www.promptweighpack.com/products/`
- Connects to the WordPress WooCommerce Store API (`/wp-json/wc/store/v1/products`) to discover new controllers, transmitters, and updated schematics.
- Merges updates into the catalog while safely preserving custom engineering fields and calibration metrics.

---

## 🚀 Deployment to Vercel

Deploying this application to Vercel takes less than 2 minutes:

### Method A: Deploy via GitHub (Recommended)
1. Initialize a git repository and push this folder to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Prompt Intelligence Dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR_ORGANIZATION/prompt-controller-dashboard.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com/) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Click **"Deploy"** (Vercel automatically detects `vercel.json`, `index.html`, and the `/api/` serverless functions).
5. Your dashboard is now live on a global URL (e.g., `https://prompt-controller-dashboard.vercel.app`)!

### Method B: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
```

---

## 🔐 Default Credentials

| Role | Username | Default Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin_ho` | `prompt@super000` | Full system control, User Management, Audit Log, 1-Click Rollback, Official Sync |
| **Admin** | `promptweighpack_ho` | `prompt@000` | Catalog CRUD, Edit Specs, Upload Images, Update Site Settings |
| **Guest / Customer** | *None* | *None* | Open public access, search, filter, compare, share links |

> **Security Tip**: Once deployed live, log in as `superadmin_ho`, navigate to **"👥 User Management"**, and change default passwords.

---

## 📱 Mobile Compatibility
Tested and optimized for:
- iPhone (SE, 12, 13, 14, 15, 16 Pro/Max) with iOS notch & Dynamic Island safe areas (`viewport-fit=cover`).
- Android (Samsung Galaxy, Google Pixel, OnePlus).
- Prevention of iOS Safari 16px auto-zoom on input focus.
- Off-canvas slide-in filter drawer with touch-scrolling.
- Responsive side-by-side comparison matrix with fluid touch swipe.
