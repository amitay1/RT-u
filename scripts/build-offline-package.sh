#!/bin/bash
# ============================================================================
# ScanMaster - Offline Installation Package Builder
# Creates a complete installation package for air-gapped factory deployment
# ============================================================================

set -e

VERSION="${1:-1.0.0}"
OUTPUT_DIR="ScanMaster_Enterprise_v${VERSION}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "=============================================="
echo "  ScanMaster Offline Package Builder"
echo "  Version: ${VERSION}"
echo "  Output: ${OUTPUT_DIR}"
echo "=============================================="

# Create directory structure
echo "Creating directory structure..."
mkdir -p "${OUTPUT_DIR}/installers"
mkdir -p "${OUTPUT_DIR}/server"
mkdir -p "${OUTPUT_DIR}/database"
mkdir -p "${OUTPUT_DIR}/licenses"
mkdir -p "${OUTPUT_DIR}/documentation"
mkdir -p "${OUTPUT_DIR}/scripts"

# ============================================================================
# 1. Build Desktop Applications
# ============================================================================
echo ""
echo "Step 1: Building Desktop Applications..."

# Build the Vite frontend first
npm run build

# Build Electron apps for all platforms
echo "Building Windows installer..."
npm run dist:win 2>/dev/null || echo "Windows build skipped (not on Windows or cross-compile not available)"

echo "Building macOS installer..."
npm run dist:mac 2>/dev/null || echo "macOS build skipped (not on macOS)"

echo "Building Linux installer..."
npm run dist:linux 2>/dev/null || echo "Linux build skipped"

# Copy installers if they exist
[ -f "dist-electron/Scan Master Setup.exe" ] && cp "dist-electron/Scan Master Setup.exe" "${OUTPUT_DIR}/installers/ScanMaster-Setup-${VERSION}-win-x64.exe"
[ -f "dist-electron/Scan Master.dmg" ] && cp "dist-electron/Scan Master.dmg" "${OUTPUT_DIR}/installers/ScanMaster-${VERSION}-mac.dmg"
[ -f "dist-electron/scan-master.AppImage" ] && cp "dist-electron/scan-master.AppImage" "${OUTPUT_DIR}/installers/ScanMaster-${VERSION}-linux.AppImage"

# ============================================================================
# 2. Build and Save Docker Images
# ============================================================================
echo ""
echo "Step 2: Building and exporting Docker images..."

# Build the application Docker image
docker build -t scanmaster-app:v${VERSION} .

# Tag as latest
docker tag scanmaster-app:v${VERSION} scanmaster-app:latest

# Save Docker images to tar files
echo "Saving scanmaster-app image..."
docker save scanmaster-app:v${VERSION} -o "${OUTPUT_DIR}/server/scanmaster-app.tar"

echo "Pulling and saving postgres image..."
docker pull postgres:15-alpine
docker save postgres:15-alpine -o "${OUTPUT_DIR}/server/postgres-15-alpine.tar"

echo "Pulling and saving nginx image..."
docker pull nginx:alpine
docker save nginx:alpine -o "${OUTPUT_DIR}/server/nginx-alpine.tar"

# ============================================================================
# 3. Copy Server Configuration Files
# ============================================================================
echo ""
echo "Step 3: Copying server configuration..."

cp docker-compose-offline.yml "${OUTPUT_DIR}/server/"
cp nginx-offline.conf "${OUTPUT_DIR}/server/"

# Create .env.example for offline deployment
cat > "${OUTPUT_DIR}/server/.env.example" << 'EOF'
# ScanMaster Offline Environment Configuration
# Copy this file to .env and fill in the values

# Database (leave default for local PostgreSQL)
DB_PASSWORD=ChangeThisSecurePassword123

# Security Keys (generate unique ones for each installation)
JWT_SECRET=generate-a-256-bit-secret-key-here
SESSION_SECRET=generate-another-secret-key-here

# License (provided by ScanMaster)
LICENSE_KEY=XXXX-XXXX-XXXX-XXXX

# Factory Information
FACTORY_NAME=Your Factory Name
FACTORY_ID=factory-unique-id

# Optional Settings
LOG_LEVEL=info
BACKUP_RETENTION_DAYS=30
EOF

# ============================================================================
# 4. Export Database Schema and Data
# ============================================================================
echo ""
echo "Step 4: Exporting database schema and initial data..."

# Create schema SQL (you would normally export from your actual schema)
cat > "${OUTPUT_DIR}/database/01-schema.sql" << 'EOF'
-- ScanMaster Database Schema
-- Run this first to create tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for local auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'inspector',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Technique sheets table
CREATE TABLE IF NOT EXISTS technique_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    standard VARCHAR(50) NOT NULL,
    shape_type VARCHAR(50),
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inspection reports table
CREATE TABLE IF NOT EXISTS inspection_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technique_sheet_id UUID REFERENCES technique_sheets(id),
    inspector_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'draft',
    findings JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Calibration blocks table
CREATE TABLE IF NOT EXISTS calibration_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_number VARCHAR(100),
    block_type VARCHAR(50),
    dimensions JSONB,
    material VARCHAR(100),
    standard VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log for compliance
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create default admin user (password: ChangeMe123!)
INSERT INTO users (email, password_hash, full_name, role) 
VALUES ('admin@factory.local', '$2b$10$example-hash-change-on-first-login', 'Administrator', 'admin')
ON CONFLICT (email) DO NOTHING;
EOF

# Create standards data SQL
cat > "${OUTPUT_DIR}/database/02-standards-data.sql" << 'EOF'
-- ScanMaster Standards Reference Data
-- Pre-loaded standards information

-- This would contain all your FBH data, metal travel options, etc.
-- Example structure (actual data from fbhStandardsData.ts would go here)

CREATE TABLE IF NOT EXISTS standards_reference (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    description TEXT,
    requirements JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO standards_reference (id, name, version, description) VALUES
('AMS-STD-2154E', 'Aerospace Material Specification', 'Rev E', 'Ultrasonic Inspection of Wrought Metals'),
('ASTM-A388', 'ASTM A388/A388M', '2024', 'Standard Practice for Ultrasonic Examination of Steel Forgings'),
('BS-EN-10228-3', 'BS EN 10228-3', '2016', 'Non-destructive testing of steel forgings - Ultrasonic testing of ferritic or martensitic steel forgings'),
('BS-EN-10228-4', 'BS EN 10228-4', '2016', 'Non-destructive testing of steel forgings - Ultrasonic testing of austenitic and austenitic-ferritic stainless steel forgings')
ON CONFLICT (id) DO NOTHING;
EOF

# Create calibration blocks data
cat > "${OUTPUT_DIR}/database/03-calibration-blocks.sql" << 'EOF'
-- ScanMaster Calibration Blocks Reference Data
-- Standard calibration block catalog

-- FBH Reference Blocks per ASTM E127
INSERT INTO calibration_blocks (part_number, block_type, dimensions, material, standard) VALUES
('E127-1-64', 'FBH', '{"diameter_inch": "1/64", "diameter_mm": 0.40, "depth_options": [3.05, 6.35, 12.70]}', 'Aluminum 7075-T6', 'ASTM E127'),
('E127-2-64', 'FBH', '{"diameter_inch": "2/64", "diameter_mm": 0.79, "depth_options": [6.35, 12.70, 25.40]}', 'Aluminum 7075-T6', 'ASTM E127'),
('E127-3-64', 'FBH', '{"diameter_inch": "3/64", "diameter_mm": 1.19, "depth_options": [12.70, 25.40, 50.80]}', 'Aluminum 7075-T6', 'ASTM E127'),
('E127-4-64', 'FBH', '{"diameter_inch": "4/64", "diameter_mm": 1.59, "depth_options": [19.05, 38.10, 76.20]}', 'Aluminum 7075-T6', 'ASTM E127'),
('E127-5-64', 'FBH', '{"diameter_inch": "5/64", "diameter_mm": 1.98, "depth_options": [25.40, 50.80, 101.60]}', 'Aluminum 7075-T6', 'ASTM E127'),
('E127-6-64', 'FBH', '{"diameter_inch": "6/64", "diameter_mm": 2.38, "depth_options": [38.10, 76.20, 152.40]}', 'Aluminum 7075-T6', 'ASTM E127'),
('E127-7-64', 'FBH', '{"diameter_inch": "7/64", "diameter_mm": 2.78, "depth_options": [50.80, 101.60, 177.80]}', 'Aluminum 7075-T6', 'ASTM E127'),
('E127-8-64', 'FBH', '{"diameter_inch": "8/64", "diameter_mm": 3.18, "depth_options": [76.20, 152.40, 228.60]}', 'Aluminum 7075-T6', 'ASTM E127')
ON CONFLICT DO NOTHING;
EOF

# ============================================================================
# 5. Create License Generator (placeholder)
# ============================================================================
echo ""
echo "Step 5: Creating license tools..."

cat > "${OUTPUT_DIR}/licenses/README.txt" << 'EOF'
ScanMaster License Information
==============================

Your license key should be provided in the file: license-key.txt

To activate:
1. Copy license-key.txt to the server directory
2. Add the key to your .env file as LICENSE_KEY=XXXX-XXXX-XXXX-XXXX
3. Restart the application

For license renewal or issues, contact:
- Email: licensing@scanmaster.pro
- Phone: +1-XXX-XXX-XXXX

License Terms:
- This license is valid for the specified factory only
- Cannot be transferred without written permission
- Includes updates for the licensed version
EOF

# ============================================================================
# 6. Copy Documentation
# ============================================================================
echo ""
echo "Step 6: Copying documentation..."

# Copy existing docs
cp docs/PRODUCTION_TO_INSTALLATION_GUIDE.md "${OUTPUT_DIR}/documentation/"
cp README.md "${OUTPUT_DIR}/documentation/"
cp docs/DEPLOYMENT.md "${OUTPUT_DIR}/documentation/"

# Copy legal docs
cp legal/*.md "${OUTPUT_DIR}/documentation/"

# Create quick-start guide
cat > "${OUTPUT_DIR}/documentation/QUICK_START.md" << 'EOF'
# ScanMaster Quick Start Guide (Offline Installation)

## Prerequisites
- Windows Server 2019+ or Ubuntu 22.04+
- Docker Desktop (Windows) or Docker Engine (Linux)
- 8GB RAM, 100GB Storage

## Installation Steps

### 1. Copy Files
Copy the entire ScanMaster_Enterprise folder to your server.

### 2. Load Docker Images
```bash
cd ScanMaster_Enterprise_v1.0.0/server
docker load -i scanmaster-app.tar
docker load -i postgres-15-alpine.tar
docker load -i nginx-alpine.tar
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Start Services
```bash
docker-compose -f docker-compose-offline.yml up -d
```

### 5. Access Application
Open browser: http://YOUR_SERVER_IP

### 6. Login
Default admin:
- Email: admin@factory.local
- Password: ChangeMe123! (change immediately!)

## Desktop Client Installation
Run the appropriate installer from the installers/ folder.

## Support
Contact: support@scanmaster.pro
EOF

# ============================================================================
# 7. Create Helper Scripts
# ============================================================================
echo ""
echo "Step 7: Creating helper scripts..."

# Backup script
cat > "${OUTPUT_DIR}/scripts/backup.sh" << 'EOF'
#!/bin/bash
# Daily backup script for ScanMaster
BACKUP_DIR="/opt/scanmaster/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p $BACKUP_DIR
docker exec scanmaster-postgres pg_dump -U scanmaster scanmaster | gzip > "$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_${TIMESTAMP}.sql.gz"
EOF

# Update script
cat > "${OUTPUT_DIR}/scripts/update.sh" << 'EOF'
#!/bin/bash
# Update script for ScanMaster
set -e

NEW_VERSION_DIR=$1
if [ -z "$NEW_VERSION_DIR" ]; then
    echo "Usage: ./update.sh /path/to/new/version"
    exit 1
fi

echo "Backing up database..."
./backup.sh

echo "Stopping services..."
docker-compose -f docker-compose-offline.yml down

echo "Loading new images..."
docker load -i "$NEW_VERSION_DIR/scanmaster-app.tar"

echo "Starting services..."
docker-compose -f docker-compose-offline.yml up -d

echo "Update complete!"
EOF

# Health check script
cat > "${OUTPUT_DIR}/scripts/health-check.sh" << 'EOF'
#!/bin/bash
# Health check script

echo "Checking ScanMaster services..."
echo ""

# Check Docker containers
echo "Container Status:"
docker-compose -f docker-compose-offline.yml ps

echo ""
echo "Health Endpoints:"

# Check app health
APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health 2>/dev/null || echo "000")
if [ "$APP_STATUS" = "200" ]; then
    echo "✅ Application: OK"
else
    echo "❌ Application: FAILED (HTTP $APP_STATUS)"
fi

# Check database
DB_STATUS=$(docker exec scanmaster-postgres pg_isready -U scanmaster -d scanmaster 2>/dev/null && echo "OK" || echo "FAILED")
echo "Database: $DB_STATUS"

echo ""
echo "Disk Usage:"
df -h | grep -E "Filesystem|/dev/"
EOF

chmod +x "${OUTPUT_DIR}/scripts/"*.sh

# ============================================================================
# 8. Create README
# ============================================================================
echo ""
echo "Step 8: Creating package README..."

cat > "${OUTPUT_DIR}/README.txt" << EOF
================================================================================
    ScanMaster Inspection Pro - Enterprise Offline Package
    Version: ${VERSION}
    Build Date: $(date +"%Y-%m-%d %H:%M:%S")
================================================================================

CONTENTS:
---------
installers/     - Desktop application installers (Windows, macOS, Linux)
server/         - Docker images and configuration for local server
database/       - Initial database schema and data
licenses/       - License key and licensing information
documentation/  - User manuals and guides
scripts/        - Utility scripts (backup, update, health-check)

INSTALLATION:
-------------
See documentation/QUICK_START.md for step-by-step instructions.

SUPPORT:
--------
Email: support@scanmaster.pro
Phone: +1-XXX-XXX-XXXX

COPYRIGHT:
----------
(c) $(date +%Y) ScanMaster Pro. All rights reserved.
This software is licensed, not sold. See documentation/EULA_TEMPLATE.md

================================================================================
EOF

# ============================================================================
# 9. Create Final Package
# ============================================================================
echo ""
echo "Step 9: Creating final package..."

# Calculate size
PACKAGE_SIZE=$(du -sh "${OUTPUT_DIR}" | cut -f1)

echo ""
echo "=============================================="
echo "  Package Created Successfully!"
echo "=============================================="
echo "  Location: ${OUTPUT_DIR}/"
echo "  Size: ${PACKAGE_SIZE}"
echo ""
echo "  Contents:"
ls -la "${OUTPUT_DIR}/"
echo ""
echo "  To create a zip/tar archive:"
echo "  tar -czvf ${OUTPUT_DIR}.tar.gz ${OUTPUT_DIR}"
echo "  or"
echo "  zip -r ${OUTPUT_DIR}.zip ${OUTPUT_DIR}"
echo "=============================================="
