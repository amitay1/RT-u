# 🔐 Scan Master - Complete Licensing & Update System

**Professional licensing and update management system for Scan Master Inspection Pro**

---

## 📋 Overview

This is a complete, production-ready licensing and update system built specifically for Scan Master - a desktop application sold to factories bundled with ultrasonic inspection machines.

### Key Features

✅ **Offline-First Licensing** - No internet required for license validation
✅ **Pay-Per-Standard Model** - Monetize individual standards (AMS, ASTM, BS3, BS4, MIL)
✅ **Per-Factory Updates** - Control which factories get which updates
✅ **Admin Dashboard** - Web-based management interface
✅ **Standards Locking** - Lock unpurchased standards with upsell UI
✅ **Multi-Language Support** - Hebrew and English release notes
✅ **Cryptographically Signed** - HMAC-SHA256 signatures prevent tampering

---

## 🚀 Quick Start (5 Minutes)

### 1. Generate Your First License

```bash
cd Scan-Master-16-12-25-main

node scripts/license-generator.cjs \
  --factory "Acme Corporation" \
  --standards AMS,ASTM \
  --lifetime
```

**Output:**
```
LICENSE KEY: SM-FAC-ACMECO-M9X2K1-AMSASTM-LIFETIME-A8F3D9E2C1B4
```

### 2. Test in Electron

```bash
npm run build
npm run electron
```

1. Enter license key in activation screen
2. ✅ App unlocks
3. AMS & ASTM standards are available
4. Other standards show 🔒 locked with "Contact Sales"

### 3. Start Update Server

```bash
cd update-server
npm install
node index.js
```

Visit: `http://localhost:3001/admin` - Admin Dashboard

---

## 📁 System Architecture

```
Scan-Master-16-12-25-main/
│
├── 📄 LICENSING_QUICKSTART.md          # 5-minute quickstart guide
├── 📄 LICENSING_SYSTEM.md              # Complete licensing documentation
├── 📄 UPDATE_SERVER_INTEGRATION.md     # Update server integration guide
├── 📄 PRODUCTION_DEPLOYMENT.md         # Production deployment guide
│
├── scripts/
│   ├── license-generator.cjs            # CLI tool to generate licenses
│   ├── example-licenses.bat/sh         # Generate example licenses
│
├── electron/
│   ├── main.cjs                        # Electron main process (✅ integrated)
│   ├── license-manager.cjs             # License validation & storage
│   ├── preload.cjs                     # IPC bridge for license operations
│
├── src/
│   ├── contexts/
│   │   └── LicenseContext.tsx          # React context for license state
│   ├── components/
│   │   ├── LicenseActivation.tsx       # Activation screen UI
│   │   └── StandardSelector.tsx        # Standards selector (✅ integrated)
│
├── update-server/
│   ├── index.js                        # Update server with per-factory logic
│   ├── public/
│   │   └── admin.html                  # Admin dashboard (web UI)
│   └── package.json
│
└── licenses/                           # Generated license files (gitignored)
```

---

## 🎯 What Each Component Does

### 1. License Generator (`scripts/license-generator.cjs`)

**Purpose:** Generate cryptographically signed license keys for customers

**Features:**
- Generates unique factory IDs from company names
- Creates HMAC-SHA256 signatures
- Supports 5 standards: AMS, ASTM, BS3, BS4, MIL
- Lifetime or time-limited licenses
- Verification mode

**Usage:**
```bash
# Generate license
node scripts/license-generator.cjs \
  --factory "Boeing Defense" \
  --standards AMS,ASTM,BS3,BS4,MIL \
  --lifetime

# Verify license
node scripts/license-generator.cjs \
  --verify "SM-FAC-BOEING-XXYYZZ-AMSASTMBS3BS4MIL-LIFETIME-ABC123"
```

**Output:**
- License key string (give to customer)
- JSON file saved to `licenses/` folder
- Pricing calculation

### 2. License Manager (`electron/license-manager.cjs`)

**Purpose:** Validates and manages licenses in the Electron app

**Features:**
- Offline-first validation (no internet required)
- AES-256 encryption for local license storage
- Expiry date checking
- Standards catalog management
- IPC handlers for React integration

**API:**
```javascript
// In Electron app
const license = await window.electron.license.check();
// Returns: { activated: true, valid: true, factoryId: "...", purchasedStandards: [...] }

await window.electron.license.activate(licenseKey);
// Validates and saves license

const canUse = await window.electron.license.hasStandard("AMS-STD-2154E");
// Returns: true/false
```

### 3. License Context (`src/contexts/LicenseContext.tsx`)

**Purpose:** React context providing license state to all components

**Features:**
- Loads license on app startup
- Provides `canUseStandard()` function
- Works in both web (dev) and Electron (production) modes
- Automatic refresh after activation

**Usage in Components:**
```typescript
import { useLicense } from '@/contexts/LicenseContext';

function MyComponent() {
  const { license, canUseStandard } = useLicense();

  if (!canUseStandard("MIL-STD-2154")) {
    return <LockedStandardUI />;
  }

  return <StandardContent />;
}
```

### 4. Activation Screen (`src/components/LicenseActivation.tsx`)

**Purpose:** Professional UI for license activation

**Features:**
- Clean, modern design
- Real-time validation feedback
- Error handling with clear messages
- Success state with auto-reload

**Flow:**
1. User enters license key
2. Click "Activate License"
3. Validation happens (offline)
4. Success → App reloads with unlocked standards
5. Error → Clear message shown

### 5. Standards Locking (`src/components/StandardSelector.tsx`)

**Purpose:** Lock unpurchased standards and show upsell UI

**Features:**
- Shows 🔒 lock icons for unpurchased standards
- Prevents selection of locked standards
- Toast notification with pricing and "Contact Sales" button
- Visual indicators (green checkmark for owned, amber lock for locked)

**UI:**
```
┌─────────────────────────────────────┐
│ Standard Selector                   │
│                                     │
│ ✅ AMS-STD-2154E  (Included)        │
│ ✅ ASTM-A388     (Included)        │
│ 🔒 BS-EN-10228-3 (Locked - $500)   │
│ 🔒 BS-EN-10228-4 (Locked - $500)   │
│ 🔒 MIL-STD-2154  (Locked - $800)   │
│                                     │
│ [ Contact Sales to Purchase ]       │
└─────────────────────────────────────┘
```

### 6. Update Server (`update-server/index.js`)

**Purpose:** Manage per-factory software updates

**Features:**
- Factory-specific update channels (stable/beta/custom)
- Version comparison logic
- Multi-language release notes
- Platform-specific installers (Windows/macOS/Linux)
- Admin APIs for factory management
- Statistics and monitoring

**APIs:**

```bash
# Client: Check for updates
POST /api/updates/check
Body: { factoryId, currentVersion, platform }

# Admin: Get all factories
GET /api/admin/factories

# Admin: Change factory channel
POST /api/admin/set-channel
Body: { factoryId, channel: "beta" }

# Admin: Push custom update
POST /api/admin/push-update
Body: { factoryId, version: "1.0.25" }

# Statistics
GET /api/stats
```

**How it works:**
1. Electron app sends factory ID (from license) to update server
2. Server checks factory config → determines channel (stable/beta/custom)
3. Server compares current version vs available version
4. If update available → returns download URL + release notes
5. Electron downloads and installs update

### 7. Admin Dashboard (`update-server/public/admin.html`)

**Purpose:** Web-based UI for managing licenses and updates

**Features:**
- View all factories and their configurations
- See recent check-ins (last hour activity)
- Change factory update channels
- Push custom updates to specific factories
- Statistics dashboard
- Real-time refresh

**Access:**
```
http://localhost:3001/admin
```

**UI Sections:**
- **Stats Cards:** Total factories, stable/beta counts, recent check-ins
- **Factories Tab:** Table of all factories with actions
- **Updates Tab:** Manage versions and push custom updates

---

## 💼 Business Model & Pricing

### Supported Standards

| Code | Full Name | Price |
|------|-----------|-------|
| **AMS** | AMS-STD-2154E (Aerospace Material Spec) | $500 |
| **ASTM** | ASTM-A388 (Steel Forgings) | $500 |
| **BS3** | BS-EN-10228-3 (European Ferritic) | $500 |
| **BS4** | BS-EN-10228-4 (European Austenitic) | $500 |
| **MIL** | MIL-STD-2154 (Military Standard) | $800 |

### Pricing Models

**Model 1: Pay-Per-Standard (Recommended)**
- Base: AMS + ASTM = $1,000
- Add BS3 = +$500
- Add BS4 = +$500
- Add MIL = +$800
- **Full package:** $3,300

**Benefits:**
- Upsell opportunities
- Flexible pricing
- Incremental revenue from existing customers

**Model 2: Tiered Bundles**
- Basic ($2,000): 2 standards
- Professional ($4,000): All 5 standards
- Enterprise ($8,000): All standards + custom support

---

## 🔄 Update System Workflows

### Scenario 1: Global Stable Release

**Goal:** Release new version to all factories on stable channel

**Steps:**
1. Build and test new version locally
2. Upload to CDN/S3:
   ```bash
   aws s3 cp Scan-Master-Setup-1.0.22.exe \
     s3://scanmaster-releases/v1.0.22/
   ```
3. Update server configuration:
   ```javascript
   versions.stable = '1.0.22';
   releaseNotes['1.0.22'] = { ... };
   ```
4. All factories on stable channel receive update

### Scenario 2: Beta Testing

**Goal:** Test new version with select factories

**Steps:**
1. Upload beta build to CDN
2. Set version:
   ```javascript
   versions.beta = '1.0.23-beta.1';
   ```
3. Move factories to beta channel:
   ```bash
   curl -X POST https://updates.scanmaster.com/api/admin/set-channel \
     -H "X-API-Key: xxx" \
     -d '{"factoryId": "FAC-ACMECO-M9X2K1", "channel": "beta"}'
   ```
4. Beta factories receive beta version
5. After testing → promote to stable

### Scenario 3: Emergency Hotfix

**Goal:** Send critical fix to single factory

**Steps:**
1. Build hotfix version
2. Upload to CDN
3. Push to specific factory:
   ```bash
   curl -X POST https://updates.scanmaster.com/api/admin/push-update \
     -H "X-API-Key: xxx" \
     -d '{"factoryId": "FAC-PROBLEM", "version": "1.0.21-hotfix"}'
   ```
4. Only that factory receives hotfix
5. Others continue on stable

---

## 🛠️ Development Workflow

### Testing Licenses Locally

**1. Generate test license:**
```bash
node scripts/license-generator.cjs \
  --factory "Test Company" \
  --standards AMS,ASTM \
  --lifetime
```

**2. Build and run Electron:**
```bash
npm run build
npm run electron
```

**3. Activate license in app**

**4. Test locked standards:**
- Try to select BS3 (should show lock)
- Click "Contact Sales" (should open email)

### Testing Updates Locally

**1. Start update server:**
```bash
cd update-server
npm install
node index.js
```

**2. Configure test factory:**
```javascript
// In update-server/index.js
factoryConfigs.set('FAC-TEST-X1Y2Z3', {
  channel: 'stable',
  customUpdates: []
});

versions.stable = '1.0.22'; // Higher than current
```

**3. Run Electron with local update server:**
```bash
UPDATE_SERVER_URL=http://localhost:3001 npm run electron
```

**4. Check for updates:**
- Menu → Help → Check for Updates
- Should see update available

**5. Monitor server logs:**
```
Update check from: FAC-TEST-X1Y2Z3 (v1.0.21, win32)
Factory on stable channel: 1.0.22
Update available
```

---

## 📚 Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| **LICENSING_QUICKSTART.md** | 5-minute getting started | New users, sales team |
| **LICENSING_SYSTEM.md** | Complete licensing docs | Developers, integrators |
| **UPDATE_SERVER_INTEGRATION.md** | Update server guide | DevOps, developers |
| **PRODUCTION_DEPLOYMENT.md** | Production deployment | DevOps, system admins |
| **README_LICENSING.md** | This file - overview | Everyone |

---

## 🔐 Security Features

### 1. Cryptographic Signatures

**All license keys are signed with HMAC-SHA256:**

```
License Key Format:
SM-{factoryId}-{standards}-{expiry}-{signature}

Signature = HMAC-SHA256(secret, "{factoryId}:{standards}:{expiry}")
```

**Benefits:**
- Prevents tampering
- Can't be forged without secret key
- Offline validation possible

### 2. Encrypted Storage

**License data encrypted with AES-256-CBC before storage:**

```javascript
// Encryption
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
const encrypted = cipher.update(JSON.stringify(license), 'utf8', 'hex');

// Decryption (in app)
const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
const decrypted = decipher.update(encrypted, 'hex', 'utf8');
```

**Stored location:**
- Windows: `C:\Users\{user}\AppData\Roaming\Scan Master\license.dat`
- macOS: `~/Library/Application Support/Scan Master/license.dat`
- Linux: `~/.config/Scan Master/license.dat`

### 3. Offline-First

**App works without internet:**
- License validation is local (no server check required)
- Update checks are optional
- Factory can be offline indefinitely

**Optional online features:**
- Update checks
- License server validation (can be added)
- Usage analytics (can be added)

---

## 🌍 Multi-Language Support

### Release Notes

**Update server supports multiple languages:**

```javascript
releaseNotes['1.0.21'] = {
  changes: {
    en: [
      '✨ Added license activation system',
      '🔒 Added standards locking mechanism'
    ],
    he: [
      '✨ נוספה מערכת הפעלת רישיון',
      '🔒 נוספה נעילת תקנים'
    ]
  }
};
```

**App automatically shows release notes in factory's language:**

```javascript
const language = factoryConfig.language || 'en';
const changes = release.changes[language] || release.changes.en;
```

---

## 💰 Revenue Opportunities

### 1. Initial Sales

**Software bundled with machines:**
- Base price: $2,000 (2 standards)
- Full package: $3,300 (all standards)
- Sold with each Scan Master machine

### 2. Upsells

**Existing customers can upgrade:**
- Customer has AMS + ASTM
- Needs BS3 for European client
- Generate new license with AMS + ASTM + BS3
- Invoice $500
- Customer enters new license → BS3 unlocks

### 3. Renewals (if using time-limited licenses)

**Annual licenses:**
- Generate license with `--expiry 2026-12-31`
- After expiry, customer must renew
- Recurring revenue stream

### 4. Support Contracts

**Optional paid support:**
- Basic: $500/year
- Professional: $2,000/year
- Enterprise: $5,000/year

---

## 📊 Analytics & Insights

### Track Key Metrics

**From update server logs:**
- Total active installations
- Update adoption rate (% of factories on latest version)
- Average time to update
- Channel distribution (stable vs beta)
- Most popular standards

**Example queries:**

```sql
-- Active factories (checked in last 7 days)
SELECT COUNT(*) FROM factory_configs
WHERE last_check_in > NOW() - INTERVAL '7 days';

-- Update adoption rate
SELECT
  version,
  COUNT(*) as factory_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM (
  SELECT factory_id,
    (SELECT version FROM update_checks
     WHERE factory_id = f.factory_id
     ORDER BY checked_at DESC LIMIT 1) as version
  FROM factory_configs f
) t
GROUP BY version;

-- Standards popularity
SELECT standard, COUNT(*) as purchases
FROM (
  SELECT factory_id, jsonb_array_elements_text(purchased_standards) as standard
  FROM factory_configs
) t
GROUP BY standard
ORDER BY purchases DESC;
```

---

## 🎓 Training & Onboarding

### For Sales Team

**What to tell customers:**
1. Software requires activation with license key
2. License key sent via email after purchase
3. One-time activation process (< 2 minutes)
4. Works offline after activation
5. Standards can be added later if needed

**Demo flow:**
1. Show activation screen
2. Enter demo license key
3. Show unlocked standards (green checkmarks)
4. Show locked standards (amber locks)
5. Show "Contact Sales" workflow

### For Customers

**Activation Instructions (send with license):**

```
Thank you for purchasing Scan Master!

Your License Key:
SM-FAC-ACMECO-M9X2K1-AMSASTM-LIFETIME-A8F3D9E2C1B4

Activation Steps:
1. Open Scan Master application
2. Enter your license key when prompted
3. Click "Activate License"
4. Application will unlock automatically

Purchased Standards:
✅ AMS-STD-2154E (Aerospace Material Spec)
✅ ASTM-A388 (Steel Forgings)

Need additional standards? Contact sales@scanmaster.com

Support: support@scanmaster.com
```

---

## 🐛 Troubleshooting

### "Invalid license signature"

**Cause:** License key corrupted or tampered with

**Fix:** Re-send license key to customer, ask them to copy carefully

### "License has expired"

**Cause:** Time-limited license reached expiry date

**Fix:** Generate renewal license with new expiry:
```bash
node scripts/license-generator.cjs \
  --factory "Same Factory Name" \
  --standards AMS,ASTM \
  --expiry 2026-12-31
```

### "License file corrupted"

**Cause:** Encrypted license file damaged

**Fix:** Customer can re-activate with same license key

### Standard still locked after activation

**Cause:** License doesn't include that standard

**Check:**
```bash
node scripts/license-generator.cjs --verify "SM-FAC-..."
```

**Fix:** Generate new license with additional standard

### App not checking for updates

**Cause:** No license activated (factory ID missing)

**Fix:** Activate license first, then check for updates

---

## 🚀 Next Steps

### Phase 1: Testing (Current)
- [x] Generate test licenses
- [x] Test activation flow
- [x] Test locked standards UI
- [x] Test update server locally
- [ ] Test update flow end-to-end

### Phase 2: Production Deployment
- [ ] Set strong `LICENSE_SECRET`
- [ ] Deploy update server to VPS/cloud
- [ ] Configure domain and SSL
- [ ] Upload first release to CDN
- [ ] Test with real factory installation

### Phase 3: Customer Rollout
- [ ] Generate licenses for first customers
- [ ] Send activation instructions
- [ ] Monitor first activations
- [ ] Collect feedback
- [ ] Iterate on UX

### Phase 4: Enhancements
- [ ] Admin dashboard authentication
- [ ] Database migration (PostgreSQL)
- [ ] Advanced analytics
- [ ] License transfer system
- [ ] Usage tracking (optional)

---

## 📞 Support

**For Development Issues:**
- Check documentation files listed above
- Review code comments in source files
- Test with example licenses

**For Production Issues:**
- Monitor update server logs
- Check admin dashboard statistics
- Review database logs (if using PostgreSQL)

**Common Commands:**

```bash
# Generate license
node scripts/license-generator.cjs --factory "Name" --standards AMS,ASTM --lifetime

# Verify license
node scripts/license-generator.cjs --verify "SM-FAC-..."

# Start update server
cd update-server && node index.js

# View admin dashboard
http://localhost:3001/admin

# Check server health
curl http://localhost:3001/health
```

---

## 🎉 Summary

You now have a **complete, production-ready licensing and update system** with:

✅ Offline-first license validation
✅ Pay-per-standard monetization
✅ Standards locking with upsell UI
✅ Per-factory update control
✅ Admin dashboard for management
✅ Multi-language support
✅ Cryptographic security
✅ Professional documentation

**The system is ready to:**
1. Generate licenses for customers
2. Activate in Electron app
3. Lock/unlock standards based on purchase
4. Manage updates per factory
5. Deploy to production

**Start generating licenses and selling Scan Master! 🚀**

For detailed guides, see:
- [LICENSING_QUICKSTART.md](LICENSING_QUICKSTART.md) - Get started in 5 minutes
- [LICENSING_SYSTEM.md](LICENSING_SYSTEM.md) - Complete licensing docs
- [UPDATE_SERVER_INTEGRATION.md](UPDATE_SERVER_INTEGRATION.md) - Update server guide
- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - Production deployment

---

**Built with ❤️ for Scan Master Inspection Pro**
