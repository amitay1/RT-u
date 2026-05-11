# ScanMaster - NDT Ultrasonic Testing Software

**Professional Technique Sheet Generator for Non-Destructive Testing**

ScanMaster is a comprehensive web application for creating, managing, and exporting ultrasonic testing technique sheets compliant with aerospace and industrial NDT standards.

## 🚀 Features

### Standards Compliance
- ✅ **AMS-STD-2154E** (Aerospace Material Specification)
- ✅ **ASTM A388** (Steel Forgings)
- ✅ **BS-EN-10228-3** (European Steel Standards)
- ✅ **BS-EN-10228-4** (European Steel Standards)

### Shape Library (27+ Geometries)
- Cylinders, Tubes, Rings, Disks
- Plates, Bars, Boxes, Spheres
- Cones, Pyramids, Hexagons, Ellipses
- Forgings, Profiles, Irregular shapes
- Real-time technical drawing generation

### Key Capabilities
- 📊 **Automated technique sheets** with smart field dependencies
- 🎨 **Live technical drawings** with dimension annotations
- 📝 **PDF/DOCX export** with professional formatting
- 🔍 **Calibration block catalog** with recommendations
- 📐 **A-Scan & C-Scan generators**
- 🎯 **Scan coverage visualization**
- 🔐 **Multi-tenant SaaS** with Supabase authentication
- 💳 **Lemon Squeezy payment integration** (in progress)
- 📱 **PWA support** with offline mode
- 🖥️ **Electron desktop app**

## 🛠️ Tech Stack

- **Frontend:** React 18.3.1 + TypeScript + Vite 7.0.5
- **UI:** shadcn/ui + Tailwind CSS + Radix UI
- **Backend:** Express + Supabase PostgreSQL
- **Drawing:** Konva.js for technical drawings
- **3D:** Three.js for shape visualization
- **Export:** jsPDF + Docxtemplater
- **Deployment:** Docker, AWS, GCP, Netlify

## 📦 Installation

```sh
# Clone the repository
git clone https://github.com/amitay1/ScanMasterMain.git

# Navigate to project
cd ScanMasterMain

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

## 🔧 Environment Setup

Required environment variables:
```env
DATABASE_URL=your_supabase_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
LEMON_SQUEEZY_API_KEY=your_lemon_squeezy_key
```

See `.env.production.template` for complete configuration guide.

## 📚 Documentation

- [Project Structure](./docs/PROJECT_STRUCTURE.md) - repository layout and ownership
- [Production Readiness Report](./docs/PRODUCTION_READINESS_REPORT.md) - 83% ready, see critical fixes
- [Completion Report](./docs/COMPLETION_REPORT_OPTION_B.md) - Recent updates summary
- [Auto-Fill Documentation](./docs/AUTO_FILL_DOCUMENTATION.md) - Smart field logic
- [Advanced Drawing Status](./docs/ADVANCED_DRAWING_STATUS.md) - Technical drawing capabilities
- [Deployment Guide](./docs/DEPLOYMENT.md) - Docker, AWS, GCP instructions
- [Roadmap](./docs/ROADMAP.md) - Future features
- [Licensing System](./docs/licensing/README_LICENSING.md) - licensing and update-server overview

## 🚢 Deployment

### Docker
```sh
docker-compose up -d
```

### AWS Lambda
```sh
npm run deploy:aws
```

### Google Cloud Run
```sh
npm run deploy:gcp
```

### Desktop App (Electron)
```sh
npm run electron:build
```

## 📄 Legal

- [Terms of Service Template](./legal/TERMS_OF_SERVICE_TEMPLATE.md)
- [Privacy Policy Template](./legal/PRIVACY_POLICY_TEMPLATE.md)
- [EULA Template](./legal/EULA_TEMPLATE.md)

**⚠️ These templates require attorney review before use!**

## 🤝 Contributing

This is a private commercial project. For inquiries: amitay.mail@gmail.com

## 📝 License

Proprietary - All Rights Reserved

## 🔐 Security

- Environment-based configuration
- JWT authentication
- Rate limiting & CORS protection
- Input validation & sanitization
- SQL injection prevention

## 📞 Support

For technical support or sales inquiries, contact: amitay.mail@gmail.com

---

**Built with ❤️ for NDT professionals worldwide**

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
