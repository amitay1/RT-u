# Automatic Setup Generation - Handoff Document

> **מסמך זה מיועד ל-AI הבא או למפתח שימשיך את העבודה.**
> קרא אותו במלואו לפני שמתחיל לעבוד.

---

## מה זה בכלל?

אנחנו בונים מערכת **Automatic Setup Generation** לבדיקות UT של דיסקים למנועי מטוסים.

**המטרה:** להפחית זמן הכנת setup מימים לשעות על ידי אוטומציה של:
- בחירת ציוד לפי חוקי OEM (GE/RR/PW)
- יצירת patches אוטומטית מגאומטריה
- יצירת techsheet מלא
- ייצוא לתוכנת CSI (מערכת סריקה)

---

## מה כבר נבנה (January 2026)

### קבצים חדשים שנוצרו:

| קובץ | מיקום | מה הוא עושה |
|------|-------|-------------|
| **Types** | `src/types/techniqueSheet.ts` | הוספנו ~260 שורות של טיפוסים חדשים: OEM, Patch, DAC/TCG |
| **OEM Rule Engine** | `src/utils/oemRuleEngine.ts` | מנוע חוקים עם placeholder ל-GE/RR/PW |
| **Patch Generator** | `src/utils/patchGenerator.ts` | אלגוריתם יצירת patches אוטומטי |
| **DAC Calculator** | `src/utils/dacCalculator.ts` | מחשבון DAC/TCG עם פיזיקה מלאה |
| **CSI Exporter** | `src/utils/exporters/csiExporter.ts` | ייצוא לפורמט XML (skeleton) |

### קבצים שעודכנו:

| קובץ | שינוי |
|------|-------|
| `src/types/exportTypes.ts` | הוספת 'csi' ל-ExportFormat |
| `src/utils/exporters/exportManager.ts` | תמיכה ב-CSI export |

---

## מה חסר ומחכה ל-INPUT חיצוני

### 1. חוקי PW (Pratt & Whitney) - מחכה ל-SPEC

**מה יגיע:** מסמך P&W 127 או PWA-36604 עם:
- Coverage requirements (כמה % כיסוי נדרש)
- Overlap requirements (כמה % חפיפה בין passes)
- רשימת transducers מאושרים
- רשימת calibration blocks מאושרים
- דרישות DAC/TCG
- תבנית techsheet

**איפה למלא:** `src/utils/oemRuleEngine.ts` שורות 70-130

```typescript
const PW_RULES: OEMRuleSet = {
  vendorId: 'PW',
  vendorName: 'Pratt & Whitney',
  version: '1.0.0',
  effectiveDate: '2024-01-01',
  specReference: 'P&W 127 / PWA-36604',  // ← עדכן לפי spec

  coverageRequirements: {
    minCoverage: 100,        // ← עדכן לפי spec
    overlapRequirement: 25,  // ← עדכן לפי spec
    criticalZoneMultiplier: 1.5,
    edgeExclusion: 5,
  },

  frequencyConstraints: {
    min: 2.25,               // ← עדכן לפי spec
    max: 15,                 // ← עדכן לפי spec
    preferred: [5, 10],      // ← עדכן לפי spec
  },

  approvedTransducers: [
    // ← הוסף רשימה מה-spec:
    // { id: 'PW-T001', manufacturer: 'Olympus', model: 'V309', ... }
  ],

  approvedBlocks: [
    // ← הוסף רשימה מה-spec:
    // { id: 'PW-B001', type: 'flat_fbh', material: 'Ti-6Al-4V', ... }
  ],

  calibrationRules: {
    interval: 8,
    temperatureCheckRequired: true,  // ← עדכן לפי spec
    dacCurveRequired: true,          // ← עדכן לפי spec
    tcgRequired: false,
    transferCorrectionMax: 4,
    periodicVerificationHours: 2,
  },
  // ...
};
```

---

### 2. פורמט CSI - מחכה ל-SPEC מצוות ScanMaster

**מה יגיע:** XML Schema או דוגמת קובץ .csi עם:
- מבנה ה-XML המדויק
- שמות השדות (element names)
- סדר השדות
- ערכים אפשריים (enums)
- units (mm, inch, MHz, etc.)

**איפה לעדכן:** `src/utils/exporters/csiExporter.ts`

**מבנה נוכחי (placeholder):**
```xml
<CSISetup version="1.0">
  <Part>...</Part>
  <Material>...</Material>
  <Equipment>...</Equipment>
  <Calibration>...</Calibration>
  <ScanPlan>...</ScanPlan>
  <AcceptanceCriteria>...</AcceptanceCriteria>
  <Documentation>...</Documentation>
</CSISetup>
```

**כשמגיע ה-spec, צריך:**
1. להשוות את המבנה שלנו לנדרש
2. לשנות שמות elements אם צריך
3. להוסיף/להסיר שדות
4. לעדכן את ה-units

---

### 3. חלקים לפיילוט (Part Numbers)

**מה יגיע:** 2-4 part numbers של דיסקים אמיתיים עם:
- מידות (OD, ID, thickness, length)
- חומר
- דרישות בדיקה
- techsheet קיים (לצורך השוואה)

**מה לעשות כשמגיע:**
1. ליצור test case לכל part
2. להריץ את המערכת
3. להשוות output ל-techsheet הקיים
4. לתקן אם יש פערים

---

## הוראות שלב-אחר-שלב

### כשמגיעים חוקי PW:

```
שלב 1: פתח את src/utils/oemRuleEngine.ts
שלב 2: מצא את const PW_RULES (שורה ~70)
שלב 3: עדכן את הערכים הבאים מתוך ה-spec:
        - coverageRequirements.minCoverage
        - coverageRequirements.overlapRequirement
        - frequencyConstraints (min, max, preferred)
        - calibrationRules (כל השדות)
שלב 4: הוסף את רשימת ה-transducers המאושרים ל-approvedTransducers
שלב 5: הוסף את רשימת ה-blocks המאושרים ל-approvedBlocks
שלב 6: הסר את ה-warnings שאומרים "placeholder values"
שלב 7: הרץ npm run lint
שלב 8: בדוק עם: getOEMRules('PW') בקונסול
```

### כשמגיע spec של CSI:

```
שלב 1: השווה את ה-XML שב-spec ל-csiExporter.ts
שלב 2: עדכן את class CSIXMLBuilder אם צריך שינויים במבנה
שלב 3: עדכן את הפונקציות:
        - buildPartSection()
        - buildMaterialSection()
        - buildEquipmentSection()
        - buildCalibrationSection()
        - buildScanPlanSection()
        - buildAcceptanceSection()
        - buildDocumentationSection()
שלב 4: שנה element names אם נדרש
שלב 5: הוסף/הסר שדות לפי ה-spec
שלב 6: עדכן את version ב-CSIExportOptions
שלב 7: בדוק עם export לקובץ והשוואה ל-spec
```

### כשמגיעים parts לפיילוט:

```
שלב 1: צור קובץ בדיקה: src/tests/pilot-parts.test.ts
שלב 2: הגדר את ה-parts:
        const PILOT_PARTS = [
          { partNumber: 'XXX', geometry: 'disk_forging', ... },
          ...
        ];
שלב 3: הרץ את generatePatchPlan() לכל part
שלב 4: הרץ את calculateDACCurve() לכל part
שלב 5: הרץ את exportToCSI() לכל part
שלב 6: השווה outputs ל-techsheets קיימים
שלב 7: תקן פערים
```

---

## API Reference - איך להשתמש בקוד שנבנה

### OEM Rule Engine

```typescript
import {
  getOEMRules,
  validateAgainstOEMRules,
  getCoverageRequirements,
  getRecommendedSettings
} from '@/utils/oemRuleEngine';

// קבלת חוקים
const rules = getOEMRules('PW');
console.log(rules.coverageRequirements.minCoverage); // 100

// וולידציה
const result = validateAgainstOEMRules('PW', {
  coverage: 95,
  frequency: 5,
  hasDAC: true,
});
if (!result.isValid) {
  console.log(result.errors); // ["Coverage 95% is below PW minimum of 100%"]
}

// המלצות
const settings = getRecommendedSettings('PW', 'bore');
console.log(settings.overlap); // 30 (bore has higher overlap)
```

### Patch Generator

```typescript
import { generatePatchPlan } from '@/utils/patchGenerator';
import { getOEMRules } from '@/utils/oemRuleEngine';

const plan = generatePatchPlan({
  partGeometry: 'disk_forging',
  dimensions: {
    length: 50,      // mm (axial)
    width: 300,      // mm (not used for disk)
    thickness: 50,   // mm
    outerDiameter: 300,
    innerDiameter: 100,
  },
  material: 'titanium',
  coverageTarget: 100,
  overlapRequired: 25,
  probeFootprint: {
    width: 10,  // mm
    length: 10, // mm
  },
  frequency: 5, // MHz
  oemRules: getOEMRules('PW'), // Optional: apply OEM rules
});

console.log(`Total patches: ${plan.totalPatches}`);
console.log(`Coverage: ${plan.totalCoverage}%`);
console.log(`Est. time: ${plan.estimatedTotalTime} seconds`);

plan.patches.forEach(patch => {
  console.log(`${patch.id}: ${patch.scanStrategy}, ${patch.passes} passes`);
});
```

### DAC Calculator

```typescript
import { calculateDACCurve, generateAMSDAC } from '@/utils/dacCalculator';

// Method 1: Custom DAC
const { curve, tcgCurve, rawData } = calculateDACCurve({
  material: 'titanium',
  frequency: 5,
  fbhDiameters: ['3/64', '5/64', '8/64'],
  depths: [25, 50, 75, 100],
  referenceDepth: 50,
  referenceAmplitude: 80,
  referenceGain: 0,
  blockTransferCorrection: 2, // dB
});

// Method 2: Standard AMS DAC
const { curve: amsCurve } = generateAMSDAC('titanium', 5, 100);

// Use the curve
console.log(`Attenuation: ${curve.attenuation} dB/mm`);
curve.points.forEach(p => {
  console.log(`Depth ${p.depth}mm: ${p.amplitude}% FSH, ${p.gain} dB`);
});

// TCG for equipment
tcgCurve.points.forEach(p => {
  console.log(`Time ${p.time}μs: +${p.gain} dB`);
});
```

### CSI Exporter

```typescript
import { exportToCSI, generateCSIXML } from '@/utils/exporters/csiExporter';

// Full export (downloads file)
await exportToCSI({
  standard: 'AMS-STD-2154E',
  inspectionSetup: { /* ... */ },
  equipment: { /* ... */ },
  calibration: { /* ... */ },
  scanParameters: { /* ... */ },
  acceptanceCriteria: { /* ... */ },
  documentation: { /* ... */ },
  patchPlan: plan,      // From patch generator
  dacCurve: curve,      // From DAC calculator
  tcgCurve: tcgCurve,   // Optional
  oemVendor: 'PW',
});

// Preview XML (no download)
const xml = generateCSIXML(data);
console.log(xml);
```

---

## מבנה הקבצים

```
src/
├── types/
│   └── techniqueSheet.ts     # OEM, Patch, DAC/TCG types (lines 284-546)
│
├── utils/
│   ├── oemRuleEngine.ts      # OEM rules (GE/RR/PW)
│   ├── patchGenerator.ts     # Auto patch generation
│   ├── dacCalculator.ts      # DAC/TCG calculations
│   │
│   └── exporters/
│       ├── csiExporter.ts    # CSI XML export
│       └── exportManager.ts  # Updated to support CSI
│
└── components/
    └── tabs/
        └── InspectionSetupTab.tsx  # TODO: Add OEM selector dropdown
```

---

## מה עוד צריך לפתח (לא הושלם)

### 1. OEM Selector UI (עדיפות גבוהה)

**מה:** Dropdown שמאפשר לבחור OEM (Generic/GE/RR/PW)

**איפה:** `src/components/tabs/InspectionSetupTab.tsx`

**קוד לדוגמה:**
```tsx
import { getAvailableVendors } from '@/utils/oemRuleEngine';

// בתוך הקומפוננטה:
const vendors = getAvailableVendors();

<Select
  value={selectedOEM}
  onValueChange={(value) => setSelectedOEM(value as OEMVendor)}
>
  <SelectTrigger>
    <SelectValue placeholder="Select OEM..." />
  </SelectTrigger>
  <SelectContent>
    {vendors.map((v) => (
      <SelectItem key={v.id} value={v.id}>
        {v.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 2. Patch Visualizer (עדיפות בינונית)

**מה:** תצוגה גרפית של ה-patches על הגאומטריה

**איפה:** רכיב חדש `src/components/PatchVisualizer.tsx`

### 3. DAC Curve Display (עדיפות בינונית)

**מה:** גרף שמציג את עקומת ה-DAC

**איפה:** `src/components/tabs/CalibrationTab.tsx`

### 4. CSI Export Button (עדיפות גבוהה)

**מה:** כפתור ב-UnifiedExportDialog שמאפשר ייצוא CSI

**איפה:** `src/components/export/UnifiedExportDialog.tsx`

---

## טיפים חשובים

### 1. אל תשנה את ה-framework
הקוד בנוי בצורה extensible. כשמגיעים specs חדשים, רק **מוסיפים נתונים** - לא משנים את המבנה.

### 2. השתמש ב-types
כל ה-types מוגדרים ב-`techniqueSheet.ts`. תמיד השתמש בהם:
```typescript
import type { OEMVendor, PatchPlan, DACCurve } from '@/types/techniqueSheet';
```

### 3. בדוק עם lint
לפני commit:
```bash
npm run lint
```

### 4. אל תמציא חוקים
אם משהו לא ברור ב-spec - שאל. אל תנחש ערכים.

---

## שאלות נפוצות

**ש: איפה להוסיף חוקים של GE/RR?**
ת: `src/utils/oemRuleEngine.ts` - יש כבר placeholders ל-GE_RULES ו-RR_RULES

**ש: איך להוסיף גאומטריה חדשה ל-Patch Generator?**
ת: הוסף case חדש ב-`generatePatchPlan()` switch statement

**ש: למה אין unit tests?**
ת: לא הספקנו. צריך להוסיף ב-`src/tests/`

**ש: איך לבדוק את ה-CSI output?**
ת: השתמש ב-`generateCSIXML()` שמחזיר string ולא מוריד קובץ

---

## Timeline Reference

| אבן דרך | תאריך יעד | תלוי ב- |
|---------|-----------|---------|
| Pilot 2-4 parts PW | Mid 2026 | PW specs + pilot parts |
| Beta | End 2026 | All Phase 1 features |
| Final v1 | Mid 2027 | Testing + validation |
| Phase 2 (Production) | Mid-End 2028 | Phase 1 complete |

---

## קישורים למסמכים קשורים

- [תוכנית מפורטת](../plans/jolly-sauteeing-feather.md) - Implementation plan
- [מסמך דרישות מקורי](../src/components/Automated%20Setup%20Software.pdf) - Original requirements
- [AUTO_CALIBRATION_RECOMMENDATION.md](../AUTO_CALIBRATION_RECOMMENDATION.md) - Calibration system docs
- [CLAUDE.md](../../CLAUDE.md) - Project guidelines

---

**נכתב:** January 2026
**גרסה:** 1.0
**מחבר:** Claude (Opus 4.5)
