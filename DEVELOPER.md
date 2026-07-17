# POS Installment ERP — Developer Guide

## Build & Distribution

### Normal Build (No Expiration)
```bash
npm run build
```
This creates the installer in `dist/` with no expiration. The app runs freely without any license key.

---

### Pre-Built Duration Version (No Key Needed)
Build a version that auto-expires after N days. The expiry date is **baked into the executable** at build time.

```bash
# 30 days (1 month)
ok

# 60 days (2 months)
$env:APP_EXPIRY_DAYS=60; npm run build

# 90 days (3 months)
$env:APP_EXPIRY_DAYS=90; npm run build

# 180 days (6 months)
$env:APP_EXPIRY_DAYS=180; npm run build

# 365 days (1 year)
$env:APP_EXPIRY_DAYS=365; npm run build
```

**Important:** The prebuild script `scripts/prebuild.mjs` generates `src/main/build-config.ts` with the expiry days and build timestamp. This file is automatically created before every `npm run build`.

The app will show a lock screen after expiry telling the user to contact the vendor.

---

### Normal Build (No Expiration)
```bash
npm run build
```
This generates `src/main/build-config.ts` with empty expiry (no expiration). The app runs freely forever.

---

### License Key System (Simple — Fully Offline)

This works **without any internet connection**. Here's how:

1. **You** generate a license key for a specific duration using `keygen.mjs`
2. You send the key to your client (by email, WhatsApp, etc.)
3. **Client** installs the app, opens it, sees the activation screen
4. Client enters the key
5. The app decrypts and validates **locally** — no internet needed

#### Step 1: Generate a License Key
```bash
node keygen.mjs
```
Follow the prompts — choose a duration (1/2/3/6/12 months).

The tool outputs a license key like: `A1B2C-D3E4F-5G6H7-I8J9K`

#### Step 2: Send the Key to Your Client
Give them the key. No hardware ID needed. Works on any PC.

#### Step 3: Client Activates
- Open the app → Activation screen appears
- Enter the license key → App unlocks for the full duration

> **Note:** The pre-built duration version (`APP_EXPIRY_DAYS=N`) doesn't need any key at all — just build and send the installer.

---

### Distributing the Installer

The built installer is at:
```
dist/pos-installment-erp Setup x.x.x.exe
```

Send this to your customer. They install normally. On first launch:
- **Without duration:** App works immediately
- **With duration:** Works immediately, counts days
- **Needing activation:** Activation screen appears — enter the key

---

## Architecture Overview

```
src/
├── main/              # Electron main process (Node.js)
│   ├── index.ts       # IPC handlers, window management
│   ├── database.ts    # SQLite schema + seed
│   └── license.ts     # License validation + encryption
├── preload/
│   └── index.ts       # Secure context bridge
├── renderer/          # React frontend
│   ├── App.tsx        # Routes + license gate
│   ├── pages/
│   │   ├── Activation.tsx   # License activation screen
│   │   ├── POS.tsx          # Point of Sale (scanner, change calc)
│   │   ├── Products.tsx     # Product management (QR print)
│   │   ├── ...
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── Topbar.tsx    # Finish Day button
│   │   ├── Sidebar.tsx
│   │   └── Layout.tsx
│   └── utils/
│       └── invoicePrinter.ts
├── types/
│   └── index.d.ts
├── keygen.mjs          # CLI license key generator
└── DEVELOPER.md       # This file
```

## New Features Added

### Finish the Day
- Button in the topbar (admin only)
- Opens a modal with today's full sales report
- Saves closing record to DB with timestamp

### QR & Barcode Scanner
- Camera scanner button in POS (uses `html5-qrcode`)
- Global barcode scanner detection (works without input focus)
- QR code print for products (generates printable label)

### Change Calculator
- "Amount Given" input in cash checkout modal
- Auto-calculates change to return

### License System
- AES-256 encrypted license keys
- Machine-locked (hardware ID based)
- Fully offline validation
- Duration options: 1, 2, 3, 6, 12 months
- Pre-built duration versions also supported

## License Key Format

Keys are 20 characters in format: `XXXXX-XXXXX-XXXXX-XXXXX`

They encode:
- Hardware ID (for machine locking)
- Expiration date
- Issue date

Encrypted with AES-256-CBC using a secret key.

## Default Credentials
- **Username:** `admin`
- **Password:** `admin123`
- Default currency: DZD
- Default language: Arabic (RTL)

## Tech Stack
- Electron 33 + electron-vite 5
- React 18 + TypeScript
- TailwindCSS 3
- SQLite (better-sqlite3)
- i18next (AR/FR/EN)
- html5-qrcode (camera scanning)
- qrcode (QR generation)
