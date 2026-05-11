# 🔄 Update Server Integration Guide

Complete guide for integrating the per-factory update server with Electron Auto-Updater.

---

## System Overview

```
┌────────────────────────────────────────┐
│  Electron App (Customer Machine)      │
│  ┌──────────────────────────────────┐ │
│  │ License Manager                   │ │
│  │ - Stores factory ID               │ │
│  │ - Stores license key              │ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │ Auto-Updater                      │ │
│  │ - Configured with factory ID      │ │
│  │ - Sends factory info in headers   │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
            │
            │ HTTPS Request with Factory ID
            ↓
┌────────────────────────────────────────┐
│  Update Server (Your Infrastructure)   │
│  ┌──────────────────────────────────┐ │
│  │ Factory Config Manager            │ │
│  │ - FAC-A → stable channel          │ │
│  │ - FAC-B → beta channel            │ │
│  │ - FAC-C → custom v1.0.25          │ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │ Update Decision Engine            │ │
│  │ - Compares versions               │ │
│  │ - Returns appropriate update      │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

## How It Works

### 1. License Activation
When customer activates license:
```javascript
// Customer enters: SM-FAC-ACMECO-M9X2K1-AMSASTM-LIFETIME-ABC123
licenseManager.activateLicense(licenseKey)
// Saves: factoryId = "FAC-ACMECO-M9X2K1"
```

### 2. Update Check on Startup
App starts → Reads license → Configures updater:
```javascript
const license = licenseManager.getLicense();
// license.factoryId = "FAC-ACMECO-M9X2K1"

autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://updates.scanmaster.com/api/updates/check'
});

autoUpdater.requestHeaders = {
  'X-Factory-Id': 'FAC-ACMECO-M9X2K1',
  'X-License-Key': 'SM-FAC-...',
  'X-Platform': 'win32'
};

autoUpdater.checkForUpdates();
```

### 3. Server Receives Request
Update server checks factory config:
```javascript
const factoryId = req.headers['x-factory-id']; // "FAC-ACMECO-M9X2K1"
const factoryConfig = factoryConfigs.get(factoryId);

// Example configs:
// FAC-ACMECO-M9X2K1 → { channel: 'stable' } → v1.0.21
// FAC-BOEING-X7Y2Z3 → { channel: 'beta' } → v1.0.22-beta.1
// FAC-AIRBUS-P3Q4R5 → { customUpdates: ['1.0.23'] } → v1.0.23
```

### 4. Version Comparison
```javascript
if (availableVersion > currentVersion) {
  res.json({
    updateAvailable: true,
    version: '1.0.22',
    releaseNotes: 'Added license activation system...',
    downloadUrl: 'https://updates.scanmaster.com/releases/...'
  });
}
```

### 5. Download & Install
```javascript
// Electron downloads from downloadUrl
autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'New version ready to install. Restart now?'
  });
});
```

---

## Configuration

### Electron App Configuration

**1. Set Update Server URL** (in `electron/main.cjs`):
```javascript
const UPDATE_SERVER_URL = process.env.UPDATE_SERVER_URL || 'https://updates.scanmaster.com';
```

**Production:**
```bash
# Set in environment or build config
UPDATE_SERVER_URL=https://updates.scanmaster.com
```

**Testing locally:**
```bash
# Run update server locally
cd update-server
node index.js
# Server runs on http://localhost:3001

# In another terminal
UPDATE_SERVER_URL=http://localhost:3001 npm run electron
```

### Update Server Configuration

**1. Configure Factory Channels** (in `update-server/index.js`):
```javascript
factoryConfigs.set('FAC-ACMECO-M9X2K1', {
  factoryId: 'FAC-ACMECO-M9X2K1',
  factoryName: 'Acme Corporation',
  channel: 'stable',           // stable | beta | custom
  customUpdates: [],           // Custom version override
  autoUpdate: true,
  language: 'en',
  purchasedStandards: ['AMS-STD-2154E', 'ASTM-A388'],
  licenseValid: true,
  lastCheckIn: null
});
```

**2. Configure Available Versions**:
```javascript
const versions = {
  stable: '1.0.21',
  beta: '1.0.22-beta.1'
};

const releaseNotes = {
  '1.0.21': {
    version: '1.0.21',
    date: '2025-12-29',
    changes: {
      en: [
        '✨ Added license activation system',
        '🔒 Added standards locking mechanism'
      ],
      he: [
        '✨ נוספה מערכת הפעלת רישיון',
        '🔒 נוספה נעילת תקנים'
      ]
    },
    critical: false,
    downloadUrls: {
      win32: 'https://updates.scanmaster.com/releases/v1.0.21/Scan-Master-Setup-1.0.21.exe',
      darwin: 'https://updates.scanmaster.com/releases/v1.0.21/Scan-Master-1.0.21.dmg',
      linux: 'https://updates.scanmaster.com/releases/v1.0.21/Scan-Master-1.0.21.AppImage'
    }
  }
};
```

---

## Admin Operations

### View All Factories
```bash
curl https://updates.scanmaster.com/api/admin/factories
```

**Response:**
```json
{
  "factories": [
    {
      "factoryId": "FAC-ACMECO-M9X2K1",
      "factoryName": "Acme Corporation",
      "channel": "stable",
      "lastCheckIn": "2025-12-29T10:30:00Z"
    }
  ]
}
```

### Change Factory Channel
```bash
curl -X POST https://updates.scanmaster.com/api/admin/set-channel \
  -H "Content-Type: application/json" \
  -d '{
    "factoryId": "FAC-ACMECO-M9X2K1",
    "channel": "beta"
  }'
```

**Result:** Next time this factory checks for updates, they'll get beta version

### Push Custom Update to Specific Factory
```bash
curl -X POST https://updates.scanmaster.com/api/admin/push-update \
  -H "Content-Type: application/json" \
  -d '{
    "factoryId": "FAC-ACMECO-M9X2K1",
    "version": "1.0.23-custom"
  }'
```

**Result:** This factory will receive v1.0.23-custom on next check (overrides channel)

### Get Factory Details
```bash
curl https://updates.scanmaster.com/api/admin/factory/FAC-ACMECO-M9X2K1
```

### View Statistics
```bash
curl https://updates.scanmaster.com/api/stats
```

**Response:**
```json
{
  "totalFactories": 42,
  "byChannel": {
    "stable": 35,
    "beta": 5,
    "custom": 2
  },
  "recentCheckIns": 18,
  "versions": {
    "stable": "1.0.21",
    "beta": "1.0.22-beta.1"
  }
}
```

---

## Deployment

### Running Update Server

**Development:**
```bash
cd update-server
npm install
node index.js
# Server runs on http://localhost:3001
```

**Production (Docker):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY update-server/package*.json ./
RUN npm install --production
COPY update-server/ ./
EXPOSE 3001
CMD ["node", "index.js"]
```

```bash
docker build -t scanmaster-update-server .
docker run -d -p 3001:3001 \
  -e UPDATE_SERVER_PORT=3001 \
  --name update-server \
  scanmaster-update-server
```

**Production (with SSL):**
```bash
# Behind nginx reverse proxy
server {
  listen 443 ssl;
  server_name updates.scanmaster.com;

  ssl_certificate /etc/letsencrypt/live/updates.scanmaster.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/updates.scanmaster.com/privkey.pem;

  location / {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### Hosting Update Files

**Option 1: Static CDN**
```javascript
downloadUrls: {
  win32: 'https://cdn.scanmaster.com/releases/v1.0.21/Scan-Master-Setup-1.0.21.exe',
  darwin: 'https://cdn.scanmaster.com/releases/v1.0.21/Scan-Master-1.0.21.dmg',
  linux: 'https://cdn.scanmaster.com/releases/v1.0.21/Scan-Master-1.0.21.AppImage'
}
```

**Option 2: S3/Cloud Storage**
```javascript
downloadUrls: {
  win32: 'https://scanmaster-releases.s3.amazonaws.com/v1.0.21/Scan-Master-Setup-1.0.21.exe'
}
```

**Option 3: Update Server Serves Files**
```javascript
// In update-server/index.js
app.use('/releases', express.static(path.join(__dirname, 'releases')));

// Place files in:
// update-server/releases/v1.0.21/Scan-Master-Setup-1.0.21.exe
```

---

## Testing

### Test Update Flow Locally

**1. Start Update Server:**
```bash
cd update-server
node index.js
# Running on http://localhost:3001
```

**2. Configure Test Factory:**
```javascript
// In update-server/index.js
factoryConfigs.set('FAC-TEST-X1Y2Z3', {
  factoryId: 'FAC-TEST-X1Y2Z3',
  channel: 'stable',
  customUpdates: []
});

versions.stable = '1.0.22'; // Higher than your current version
```

**3. Generate Test License:**
```bash
node scripts/license-generator.cjs \
  --factory "Test Factory" \
  --standards AMS,ASTM \
  --lifetime
# Outputs: SM-FAC-TEST-X1Y2Z3-AMSASTM-LIFETIME-...
```

**4. Build and Run Electron:**
```bash
npm run build
UPDATE_SERVER_URL=http://localhost:3001 npm run electron
```

**5. Activate License:**
- Enter test license key
- App should activate

**6. Check for Updates:**
- Menu → Help → Check for Updates
- Should see update available (v1.0.22)

**7. Monitor Server Logs:**
```
Update check from: FAC-TEST-X1Y2Z3 (v1.0.21, win32)
Factory on stable channel: 1.0.22
Update available: v1.0.22
```

### Test Different Channels

**Beta Channel:**
```javascript
// Set factory to beta
curl -X POST http://localhost:3001/api/admin/set-channel \
  -H "Content-Type: application/json" \
  -d '{"factoryId": "FAC-TEST-X1Y2Z3", "channel": "beta"}'

// Restart app, check for updates → should get beta version
```

**Custom Update:**
```javascript
// Push custom update
curl -X POST http://localhost:3001/api/admin/push-update \
  -H "Content-Type: application/json" \
  -d '{"factoryId": "FAC-TEST-X1Y2Z3", "version": "1.0.25"}'

// Restart app, check for updates → should get v1.0.25
```

---

## Common Scenarios

### Scenario 1: Global Stable Release
```bash
# Update stable version in server
versions.stable = '1.0.22';

# Add release notes
releaseNotes['1.0.22'] = {
  version: '1.0.22',
  changes: { en: ['New features...'] },
  downloadUrls: { ... }
};

# All factories on stable channel will get v1.0.22
```

### Scenario 2: Beta Testing with Specific Customers
```bash
# Move specific factories to beta
curl -X POST .../api/admin/set-channel -d '{"factoryId": "FAC-A", "channel": "beta"}'
curl -X POST .../api/admin/set-channel -d '{"factoryId": "FAC-B", "channel": "beta"}'

# They'll receive beta updates
# Others remain on stable
```

### Scenario 3: Emergency Hotfix for One Customer
```bash
# Push custom version to single factory
curl -X POST .../api/admin/push-update \
  -d '{"factoryId": "FAC-PROBLEM", "version": "1.0.21-hotfix"}'

# Only this factory gets the hotfix
# Others continue on stable/beta as usual
```

### Scenario 4: Gradual Rollout
```bash
# Week 1: Beta testers
curl -X POST .../api/admin/set-channel -d '{"factoryId": "FAC-A", "channel": "beta"}'

# Week 2: 10% of factories
for factory in $early_adopters; do
  curl -X POST .../api/admin/push-update -d "{\"factoryId\": \"$factory\", \"version\": \"1.0.22\"}"
done

# Week 3: Move to stable
versions.stable = '1.0.22';
```

---

## Monitoring

### Check Factory Activity
```bash
# See which factories checked in recently
curl https://updates.scanmaster.com/api/stats

# Check specific factory
curl https://updates.scanmaster.com/api/admin/factory/FAC-ACMECO-M9X2K1
```

### Server Logs
```bash
# Production logs
docker logs -f update-server

# Watch for:
# - Update checks
# - Version offered
# - Factory channels
# - Errors
```

### Alerts
Set up monitoring for:
- Factories not checking in (may indicate license issues)
- High error rates
- Failed downloads
- Server downtime

---

## Security

### 1. Authentication for Admin APIs
```javascript
// Add API key authentication
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

app.use('/api/admin/*', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 2. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const updateCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Max 100 requests per 15 minutes per IP
});

app.post('/api/updates/check', updateCheckLimiter, async (req, res) => {
  // ...
});
```

### 3. License Validation
```javascript
// Verify license key matches factory ID
const licenseKey = req.headers['x-license-key'];
const factoryId = req.headers['x-factory-id'];

// Parse license and verify it matches
// (prevents factory A from pretending to be factory B)
```

---

## Troubleshooting

### Issue: App not checking for updates
**Check:**
- Is license activated? (no factory ID = no update check)
- Is UPDATE_SERVER_URL correct?
- Is update server running and accessible?
- Check Electron console logs

**Debug:**
```javascript
// In Electron DevTools
console.log(await window.electron.license.check());
// Should show factoryId
```

### Issue: Update available but not downloading
**Check:**
- Is downloadUrl accessible?
- Is file hosted correctly?
- Check network tab in DevTools
- Check autoUpdater logs

### Issue: Wrong version offered
**Check:**
```bash
# Check factory config
curl https://updates.scanmaster.com/api/admin/factory/FAC-XXX

# Verify channel and customUpdates
# Update if needed
```

### Issue: Server not receiving factory ID
**Check:**
```javascript
// In main.cjs
console.log('License:', licenseManager.getLicense());
console.log('Update headers:', autoUpdater.requestHeaders);

// Should show X-Factory-Id header
```

---

## Next Steps

1. ✅ **Update server is ready** - Per-factory management implemented
2. ✅ **Electron integration done** - Factory ID sent in update requests
3. ⏭️ **Build Admin Dashboard** - Web UI for managing factories
4. ⏭️ **Add database** - Replace in-memory storage with persistent DB
5. ⏭️ **Deploy to production** - Docker + SSL + monitoring
6. ⏭️ **Test with real releases** - Build distributable, test full flow

---

**You now have a complete per-factory update system! 🚀**

Each factory gets updates based on their configuration, with full admin control over channels and custom versions.
