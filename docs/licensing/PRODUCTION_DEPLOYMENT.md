# 🚀 Production Deployment Guide

Complete guide for deploying Scan Master Licensing & Update System to production.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Update Server Deployment](#update-server-deployment)
4. [File Storage Setup](#file-storage-setup)
5. [Domain & SSL Configuration](#domain--ssl-configuration)
6. [Database Migration](#database-migration)
7. [Security Hardening](#security-hardening)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Maintenance & Updates](#maintenance--updates)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client Side (Customer Machines)                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Scan Master Electron App                         │ │
│  │  - License Manager (offline validation)           │ │
│  │  - Auto-Updater (checks for updates)              │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                      │
                      │ HTTPS
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Production Infrastructure (Your Servers)                │
│                                                           │
│  ┌──────────────────────┐    ┌──────────────────────┐   │
│  │  Nginx Reverse Proxy │    │  CDN / S3            │   │
│  │  - SSL Termination   │    │  - Update files      │   │
│  │  - Rate limiting     │    │  - Installers (.exe) │   │
│  └──────────────────────┘    └──────────────────────┘   │
│            │                                              │
│            ↓                                              │
│  ┌──────────────────────┐    ┌──────────────────────┐   │
│  │  Update Server       │    │  PostgreSQL Database │   │
│  │  - Factory configs   │←───│  - Factory configs   │   │
│  │  - Update logic      │    │  - Check-in logs     │   │
│  │  - Admin Dashboard   │    │  - License history   │   │
│  └──────────────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Pre-Deployment Checklist

### 1. Security Configuration

- [ ] **Change License Secret**
  ```bash
  # Generate strong secret (32 bytes)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  # Set in environment
  export LICENSE_SECRET="your-generated-secret-here"
  ```

- [ ] **Set Admin API Key**
  ```bash
  export ADMIN_API_KEY="your-admin-api-key-here"
  ```

- [ ] **Configure CORS**
  ```javascript
  // In update-server/index.js
  const ALLOWED_ORIGINS = [
    'https://updates.scanmaster.com',
    'https://admin.scanmaster.com'
  ];
  ```

### 2. Domain Setup

- [ ] Purchase domains:
  - `updates.scanmaster.com` - Update server API
  - `cdn.scanmaster.com` - CDN for update files (optional)
  - `admin.scanmaster.com` - Admin dashboard (optional, can use `/admin` path)

- [ ] Configure DNS records:
  ```
  updates.scanmaster.com  →  A  →  Your server IP
  ```

### 3. SSL Certificates

- [ ] Obtain SSL certificates (Let's Encrypt recommended)
- [ ] Auto-renewal configured

### 4. Infrastructure

- [ ] Server provisioned (min: 2GB RAM, 2 CPU cores)
- [ ] PostgreSQL database ready
- [ ] Object storage (S3/CDN) for update files
- [ ] Backup storage configured

---

## Update Server Deployment

### Option 1: Docker (Recommended)

**1. Create Dockerfile:**

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY update-server/package*.json ./
RUN npm install --production

# Copy application
COPY update-server/ ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start server
CMD ["node", "index.js"]
```

**2. Create docker-compose.yml:**

```yaml
version: '3.8'

services:
  update-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - UPDATE_SERVER_PORT=3001
      - LICENSE_SECRET=${LICENSE_SECRET}
      - ADMIN_API_KEY=${ADMIN_API_KEY}
      - DATABASE_URL=${DATABASE_URL}
    restart: unless-stopped
    volumes:
      - ./data:/app/data
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=scanmaster
      - POSTGRES_USER=scanmaster
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - update-server
    restart: unless-stopped

volumes:
  postgres-data:
```

**3. Create .env file:**

```bash
# .env
LICENSE_SECRET=your-32-byte-hex-secret-here
ADMIN_API_KEY=your-admin-api-key-here
DB_PASSWORD=your-db-password-here
DATABASE_URL=postgresql://scanmaster:${DB_PASSWORD}@postgres:5432/scanmaster
```

**4. Deploy:**

```bash
# Build and start
docker-compose up -d

# Check logs
docker-compose logs -f update-server

# Check health
curl http://localhost:3001/health
```

### Option 2: Direct Deployment (VPS)

**1. Install Node.js:**

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v20.x
```

**2. Install PM2 (Process Manager):**

```bash
sudo npm install -g pm2
```

**3. Deploy Update Server:**

```bash
# Clone/copy your code
cd /opt
sudo mkdir scanmaster
cd scanmaster
# Copy update-server/ folder here

# Install dependencies
cd update-server
npm install --production

# Set environment variables
sudo nano /etc/environment
# Add:
LICENSE_SECRET="your-secret"
ADMIN_API_KEY="your-api-key"
UPDATE_SERVER_PORT=3001

# Start with PM2
pm2 start index.js --name "update-server"

# Auto-start on reboot
pm2 startup
pm2 save
```

**4. Check Status:**

```bash
pm2 status
pm2 logs update-server
```

---

## File Storage Setup

### Option 1: AWS S3 (Recommended)

**1. Create S3 Bucket:**

```bash
aws s3 mb s3://scanmaster-releases
```

**2. Configure Bucket Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::scanmaster-releases/*"
    }
  ]
}
```

**3. Upload Release:**

```bash
aws s3 cp Scan-Master-Setup-1.0.21.exe \
  s3://scanmaster-releases/v1.0.21/Scan-Master-Setup-1.0.21.exe \
  --acl public-read
```

**4. Configure CloudFront (optional):**

- Create CloudFront distribution
- Origin: S3 bucket
- Enable HTTPS
- Custom domain: `cdn.scanmaster.com`

**5. Update downloadUrls:**

```javascript
// In update-server/index.js
downloadUrls: {
  win32: 'https://scanmaster-releases.s3.amazonaws.com/v1.0.21/Scan-Master-Setup-1.0.21.exe',
  // Or with CloudFront:
  win32: 'https://cdn.scanmaster.com/v1.0.21/Scan-Master-Setup-1.0.21.exe'
}
```

### Option 2: Self-Hosted

**1. Create releases directory:**

```bash
sudo mkdir -p /var/www/releases
sudo chown www-data:www-data /var/www/releases
```

**2. Upload files:**

```bash
scp Scan-Master-Setup-1.0.21.exe \
  user@server:/var/www/releases/v1.0.21/
```

**3. Configure Nginx:**

```nginx
server {
  listen 443 ssl;
  server_name cdn.scanmaster.com;

  ssl_certificate /etc/letsencrypt/live/cdn.scanmaster.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/cdn.scanmaster.com/privkey.pem;

  root /var/www/releases;

  location / {
    autoindex off;
    add_header Access-Control-Allow-Origin *;
  }
}
```

**4. Update downloadUrls:**

```javascript
downloadUrls: {
  win32: 'https://cdn.scanmaster.com/v1.0.21/Scan-Master-Setup-1.0.21.exe'
}
```

---

## Domain & SSL Configuration

### 1. Nginx Configuration

**Create `/etc/nginx/sites-available/scanmaster-updates`:**

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=updates:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

# Redirect HTTP to HTTPS
server {
  listen 80;
  server_name updates.scanmaster.com;
  return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
  listen 443 ssl http2;
  server_name updates.scanmaster.com;

  # SSL Configuration
  ssl_certificate /etc/letsencrypt/live/updates.scanmaster.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/updates.scanmaster.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  # Security Headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;

  # Logging
  access_log /var/log/nginx/scanmaster-updates-access.log;
  error_log /var/log/nginx/scanmaster-updates-error.log;

  # Admin Dashboard
  location /admin {
    limit_req zone=api burst=20;
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Update Check API
  location /api/updates/check {
    limit_req zone=updates burst=5;
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Admin API (protected)
  location /api/admin/ {
    # Optional: IP whitelist
    # allow 203.0.113.0/24;  # Your office IP
    # deny all;

    limit_req zone=api burst=20;
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Other API endpoints
  location /api/ {
    limit_req zone=api burst=20;
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Health check (no rate limit)
  location /health {
    proxy_pass http://localhost:3001;
    access_log off;
  }
}
```

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/scanmaster-updates /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d updates.scanmaster.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

---

## Database Migration

### 1. Create PostgreSQL Schema

**Create `database/schema.sql`:**

```sql
-- Factory Configurations
CREATE TABLE factory_configs (
  factory_id VARCHAR(50) PRIMARY KEY,
  factory_name VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'stable',
  custom_updates JSONB DEFAULT '[]',
  auto_update BOOLEAN DEFAULT true,
  language VARCHAR(10) DEFAULT 'en',
  purchased_standards JSONB NOT NULL,
  license_valid BOOLEAN DEFAULT true,
  last_check_in TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Update Check Logs
CREATE TABLE update_checks (
  id SERIAL PRIMARY KEY,
  factory_id VARCHAR(50) REFERENCES factory_configs(factory_id),
  current_version VARCHAR(20),
  available_version VARCHAR(20),
  platform VARCHAR(20),
  update_offered BOOLEAN,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- License History
CREATE TABLE license_history (
  id SERIAL PRIMARY KEY,
  factory_id VARCHAR(50),
  license_key TEXT NOT NULL,
  action VARCHAR(50), -- 'issued', 'renewed', 'upgraded'
  standards_before JSONB,
  standards_after JSONB,
  price DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_factory_last_checkin ON factory_configs(last_check_in);
CREATE INDEX idx_update_checks_factory ON update_checks(factory_id);
CREATE INDEX idx_update_checks_date ON update_checks(checked_at);
```

**Run migration:**

```bash
psql -U scanmaster -d scanmaster -f database/schema.sql
```

### 2. Update Server Code to Use Database

**Install PostgreSQL driver:**

```bash
cd update-server
npm install pg
```

**Create `database.js`:**

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Get factory config
async function getFactoryConfig(factoryId) {
  const result = await pool.query(
    'SELECT * FROM factory_configs WHERE factory_id = $1',
    [factoryId]
  );
  return result.rows[0];
}

// Save factory config
async function saveFactoryConfig(config) {
  await pool.query(`
    INSERT INTO factory_configs (factory_id, factory_name, channel, custom_updates,
                                  auto_update, language, purchased_standards, license_valid)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (factory_id)
    DO UPDATE SET
      factory_name = $2,
      channel = $3,
      custom_updates = $4,
      auto_update = $5,
      language = $6,
      purchased_standards = $7,
      license_valid = $8,
      updated_at = NOW()
  `, [config.factoryId, config.factoryName, config.channel,
      JSON.stringify(config.customUpdates), config.autoUpdate,
      config.language, JSON.stringify(config.purchasedStandards),
      config.licenseValid]);
}

// Log update check
async function logUpdateCheck(factoryId, currentVersion, availableVersion, platform, offered) {
  await pool.query(`
    INSERT INTO update_checks (factory_id, current_version, available_version, platform, update_offered)
    VALUES ($1, $2, $3, $4, $5)
  `, [factoryId, currentVersion, availableVersion, platform, offered]);
}

// Update last check-in
async function updateLastCheckIn(factoryId) {
  await pool.query(
    'UPDATE factory_configs SET last_check_in = NOW() WHERE factory_id = $1',
    [factoryId]
  );
}

module.exports = {
  pool,
  getFactoryConfig,
  saveFactoryConfig,
  logUpdateCheck,
  updateLastCheckIn
};
```

**Update `index.js` to use database:**

```javascript
const db = require('./database');

// Replace factoryConfigs.get() with:
const factoryConfig = await db.getFactoryConfig(factoryId);

// Replace factoryConfigs.set() with:
await db.saveFactoryConfig(config);

// Log update check:
await db.logUpdateCheck(factoryId, currentVersion, availableVersion, platform, offered);
```

---

## Security Hardening

### 1. Admin API Authentication

**Add authentication middleware:**

```javascript
// In index.js
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function requireAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Protect admin routes
app.get('/api/admin/*', requireAuth);
app.post('/api/admin/*', requireAuth);
app.put('/api/admin/*', requireAuth);
```

**Usage:**

```bash
curl -H "X-API-Key: your-admin-api-key" \
  https://updates.scanmaster.com/api/admin/factories
```

### 2. Rate Limiting

**Already configured in Nginx, but add application-level too:**

```javascript
const rateLimit = require('express-rate-limit');

const updateCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min
  message: 'Too many update checks, please try again later'
});

app.post('/api/updates/check', updateCheckLimiter, async (req, res) => {
  // ...
});
```

### 3. License Validation

**Verify license key matches factory ID:**

```javascript
const licenseKey = req.headers['x-license-key'];
const factoryId = req.headers['x-factory-id'];

// Parse and verify
const parsed = parseLicenseKey(licenseKey);
if (parsed.factoryId !== factoryId) {
  return res.status(403).json({ error: 'License mismatch' });
}
```

### 4. Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to update server port
sudo ufw deny 3001/tcp

# Enable firewall
sudo ufw enable
```

---

## Monitoring & Logging

### 1. Application Logging

**Use Winston:**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log update checks
logger.info('Update check', {
  factoryId,
  currentVersion,
  availableVersion,
  offered: updateAvailable
});
```

### 2. Health Monitoring

**Setup monitoring service (UptimeRobot, Pingdom, etc.):**

- Monitor: `https://updates.scanmaster.com/health`
- Check interval: 5 minutes
- Alert if down for 3 checks

**Health endpoint should check:**

```javascript
app.get('/health', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

### 3. Analytics Dashboard

**Track key metrics:**

- Total factories
- Active factories (checked in last 24h)
- Update adoption rate
- Average time to update
- Channels distribution

**Create analytics endpoint:**

```javascript
app.get('/api/analytics', requireAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_factories,
      COUNT(CASE WHEN last_check_in > NOW() - INTERVAL '24 hours' THEN 1 END) as active_24h,
      COUNT(CASE WHEN channel = 'stable' THEN 1 END) as stable_count,
      COUNT(CASE WHEN channel = 'beta' THEN 1 END) as beta_count
    FROM factory_configs
  `);

  res.json(result.rows[0]);
});
```

---

## Backup & Recovery

### 1. Database Backups

**Automated daily backups:**

```bash
# Create backup script
sudo nano /usr/local/bin/backup-scanmaster.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backups/scanmaster"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U scanmaster scanmaster | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
sudo chmod +x /usr/local/bin/backup-scanmaster.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
0 2 * * * /usr/local/bin/backup-scanmaster.sh
```

### 2. Configuration Backups

**Backup license secret and configs:**

```bash
# Backup environment variables
sudo cp /etc/environment /backups/environment.backup

# Backup Nginx config
sudo cp /etc/nginx/sites-available/scanmaster-updates /backups/nginx.backup
```

### 3. Recovery Procedure

**Restore database:**

```bash
gunzip < /backups/scanmaster/db_20251229_020000.sql.gz | \
  psql -U scanmaster scanmaster
```

---

## Maintenance & Updates

### 1. Deploying New Server Version

```bash
# Pull new code
cd /opt/scanmaster/update-server
git pull

# Install dependencies
npm install --production

# Restart server
pm2 restart update-server

# Check logs
pm2 logs update-server
```

### 2. Adding New Release Version

**1. Build and test Electron app locally**

**2. Upload to S3/CDN:**

```bash
aws s3 cp Scan-Master-Setup-1.0.23.exe \
  s3://scanmaster-releases/v1.0.23/Scan-Master-Setup-1.0.23.exe \
  --acl public-read
```

**3. Update server configuration:**

```javascript
// In update-server/index.js or via Admin API
versions.stable = '1.0.23';

releaseNotes['1.0.23'] = {
  version: '1.0.23',
  date: '2025-12-29',
  changes: {
    en: ['New features...'],
    he: ['תכונות חדשות...']
  },
  downloadUrls: {
    win32: 'https://cdn.scanmaster.com/v1.0.23/Scan-Master-Setup-1.0.23.exe'
  }
};
```

**4. Test with beta factory first:**

```bash
curl -X POST https://updates.scanmaster.com/api/admin/push-update \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"factoryId": "FAC-TEST", "version": "1.0.23"}'
```

**5. Promote to stable channel after validation**

### 3. Database Maintenance

```bash
# Vacuum and analyze (weekly)
sudo -u postgres psql scanmaster -c "VACUUM ANALYZE;"

# Check database size
sudo -u postgres psql scanmaster -c "SELECT pg_size_pretty(pg_database_size('scanmaster'));"
```

---

## Troubleshooting

### Server Not Responding

```bash
# Check if server is running
pm2 status

# Check logs
pm2 logs update-server --lines 100

# Restart if needed
pm2 restart update-server
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Restart if needed
sudo systemctl restart postgresql
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Renew manually
sudo certbot renew

# Check Nginx configuration
sudo nginx -t
```

### High Memory Usage

```bash
# Check memory
free -h

# Check PM2 processes
pm2 monit

# Restart server
pm2 restart update-server
```

---

## Cost Estimation (Monthly)

**Small deployment (< 100 factories):**

| Service | Provider | Cost |
|---------|----------|------|
| VPS Server (2GB RAM, 2 CPU) | DigitalOcean | $12 |
| PostgreSQL Database | DigitalOcean | $15 |
| S3 Storage (10GB) | AWS | $0.23 |
| S3 Bandwidth (100GB) | AWS | $9 |
| Domain | Namecheap | $1 |
| SSL Certificate | Let's Encrypt | $0 |
| **Total** | | **~$37/month** |

**Medium deployment (100-500 factories):**

| Service | Provider | Cost |
|---------|----------|------|
| VPS Server (4GB RAM, 4 CPU) | DigitalOcean | $24 |
| PostgreSQL Database | DigitalOcean | $25 |
| S3 Storage (50GB) | AWS | $1.15 |
| S3 Bandwidth (500GB) | AWS | $45 |
| **Total** | | **~$95/month** |

---

## Support & Maintenance Contract

Consider offering customers:

1. **Basic Support** ($500/year)
   - Email support
   - Bug fixes
   - Security updates

2. **Premium Support** ($2,000/year)
   - Phone/video support
   - Priority bug fixes
   - Custom feature requests
   - Dedicated account manager

3. **Enterprise Support** ($5,000/year)
   - 24/7 support
   - On-site visits (if needed)
   - Custom integrations
   - Training sessions

---

**You're ready for production deployment! 🚀**

This guide covers everything needed to deploy and maintain the Scan Master licensing and update system in production.
