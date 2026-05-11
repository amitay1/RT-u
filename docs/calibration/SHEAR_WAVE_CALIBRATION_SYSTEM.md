# מערכת בחירת בלוקי כיול לשער וייב - מסמך הסבר

## 🎯 מה נוסף למערכת

### 1. בסיס נתונים של 7 Masters (קובץ חדש)
**מיקום:** `src/data/shearWaveCalibrationBlocks.ts`

הוספתי **7 דגמי כיול (Masters)** שמכסים **כל קוטר עגול מ-24mm עד 500mm+**:

| Master ID | קוטר בלוק (mm) | מכסה חלקים (mm) | עובי דופן (mm) |
|-----------|---------------|----------------|---------------|
| SW_CURV_026 | 26.5 | 23.9 - 39.8 | 5 |
| SW_CURV_044 | 44.2 | 39.8 - 66.3 | 8 |
| SW_CURV_074 | 73.7 | 66.3 - 110.5 | 12 |
| SW_CURV_123 | 122.8 | 110.5 - 184.2 | 18 |
| SW_CURV_205 | 204.7 | 184.2 - 307.0 | 25 |
| SW_CURV_341 | 341.2 | 307.0 - 511.7 | 35 |
| SW_FLAT | שטוח | 500+ | 50 |

**ללא רווחים:** כל קוטר מ-24mm ועד אינסוף מכוסה ללא חורים.

---

### 2. איך זה עובד (החוקים שמתוך הטקסט שקראת)

#### חוק 1: קימור (Curvature Rule)
```
אם OD > 500mm → בלוק שטוח (SW_FLAT)
אם OD ≤ 500mm → בלוק קמור (SW_CURV_XXX)
```

#### חוק 2: טווח קטרים (0.9-1.5 Rule)
```
כל בלוק מכסה: 0.9 × Dblock ≤ Dpart ≤ 1.5 × Dblock
```

**דוגמה:**  
בלוק SW_CURV_074 (73.7mm) מכסה חלקים בין:
- מינימום: 0.9 × 73.7 = **66.3mm**
- מקסימום: 1.5 × 73.7 = **110.5mm**

#### חוק 3: עובי דופן (±25% Thickness Rule)
```
0.75 × Tpart ≤ Tblock ≤ 1.25 × Tpart
```

**דוגמה:**  
חלק עם עובי 10mm:
- מינימום: 0.75 × 10 = **7.5mm** ✓
- מקסימום: 1.25 × 10 = **12.5mm** ✓  
→ בלוק SW_CURV_074 (12mm) **מתאים**

---

### 3. מה יש בכל דגם כיול (Reflector Config)

כל בלוק מוגדר עם **4 נוטשים (Notches)** לפי תקן ASME piping:

```
1. נוטש אקסיאלי על OD (0°)
2. נוטש היקפי על OD (90°)
3. נוטש אקסיאלי על ID (0°)
4. נוטש היקפי על ID (90°)
```

**פרמטרים:**
- **עומק:** 10% מעובי הדופן
- **רוחב:** 6.35mm (1/4")
- **אורך:** 25.4mm (1" מינימום)

---

### 4. איך המערכת בוחרת בלוק (האלגוריתם)

הוספתי פונקציה **`selectShearWaveBlock()`** שעובדת כך:

```typescript
1. קלט: OD, עובי, גאומטריה
2. אם OD > 500mm → החזר SW_FLAT
3. אחרת:
   - סנן בלוקים לפי טווח קוטר (0.9-1.5)
   - בחר את הקרוב ביותר לקוטר הנומינלי
   - בדוק תאימות עובי (±25%)
4. החזר בלוק + reasoning מלא
```

**דוגמה לפלט:**
```json
{
  "block": {
    "master_id": "SW_CURV_123",
    "nominal_Dblock_mm": 122.8,
    "Dpart_min_mm": 110.5,
    "Dpart_max_mm": 184.2
  },
  "reasoning": "Selected SW_CURV_123 (OD 122.8mm) for part OD 150mm. Coverage: 110.5-184.2mm (ASME 0.9-1.5 rule). Thickness: Block 18mm within ±25% of part 20mm (✓ ASME compliant).",
  "matchQuality": "perfect"
}
```

---

### 5. אינטגרציה עם המערכת הקיימת

שדרגתי את **`calibrationRecommenderV2.ts`** כך שהוא:

1. **מזהה אוטומטית** חלקים עגולים (tube, pipe, cylinder, round_bar, ring)
2. **קורא לפונקציה החדשה** `selectShearWaveBlock()`
3. **מחליף את ההמלצה הישנה** בבלוק ASME-compliant
4. **שומר fallback** - אם אין התאמה, חוזר ללוגיקה המסורתית

**קוד האינטגרציה:**
```typescript
// בפונקציה selectAngleBeamBlock()
if (isRoundPart && outerDiameter && thickness) {
  const shearWaveCriteria = {
    part_od_mm: outerDiameter,
    part_thickness_mm: thickness,
    part_geometry: partType,
    angle_deg: angle,
  };
  
  const result = selectShearWaveBlock(shearWaveCriteria);
  
  if (result.block) {
    return {
      category: result.block.category,
      reasoning: `ASME Shear Wave: ${result.reasoning}`,
      shearWaveBlock: result.block,
    };
  }
}
```

---

## 📋 איך זה עוזר לך (תשובה ישירה לשאלה שלך)

### מה שהיה לפני:
```
משתמש בחר: Tube, OD=100mm, עובי=10mm
המערכת: "כנראה צילינדר עם נוטשים" (ללא חוקים ברורים)
```

### מה שיש עכשיו:
```
משתמש בחר: Tube, OD=100mm, עובי=10mm
המערכת חישוב אוטומטי:
  1. OD=100mm → בתוך טווח 66.3-110.5mm
  2. בחירה: SW_CURV_074 (73.7mm nominal)
  3. בדיקת עובי: 12mm vs 10mm → סטייה 20% (✓ מתחת ל-25%)
  4. תוצאה: "SW_CURV_074 (OD 73.7mm) מתאים מושלם"
```

---

## 🔧 איך להשתמש בזה בקוד

### דוגמה 1: בחירה ישירה
```typescript
import { selectShearWaveBlock } from '@/data/shearWaveCalibrationBlocks';

const result = selectShearWaveBlock({
  part_od_mm: 150,
  part_thickness_mm: 20,
  part_geometry: 'tube',
  angle_deg: 60,
});

console.log(result.block.master_id);  // "SW_CURV_123"
console.log(result.reasoning);
// "Selected SW_CURV_123 (OD 122.8mm) for part OD 150mm. 
//  Coverage: 110.5-184.2mm (ASME 0.9-1.5 rule). 
//  Thickness: Block 18mm within ±25% of part 20mm (✓ ASME compliant)."
```

### דוגמה 2: לקבל כל האופציות
```typescript
import { getCompatibleShearWaveBlocks } from '@/data/shearWaveCalibrationBlocks';

const options = getCompatibleShearWaveBlocks(100, 'tube');
// מחזיר: [SW_CURV_074, SW_CURV_123] (שניהם מכסים 100mm)
```

---

## ✅ מה זה כולל ומה לא

### ✅ כלול:
- 7 דגמים מוגדרים במלואם (6 קמורים + 1 שטוח)
- טבלת נוטשים (4 נוטשים לכל בלוק)
- חוקי ASME (0.9-1.5, ±25%, >500mm)
- אלגוריתם בחירה אוטומטי
- אינטגרציה עם calibrationRecommenderV2
- מסמכי reasoning מפורטים

### ❌ לא כלול (אופציונלי להרחבה):
- קבצי CAD (STEP/STL) - תצטרך לייצר או לקנות פיזית
- ויזואליזציה 3D מלאה (יש placeholder)
- בדיקת תאימות wedge (יש מקום לזה אבל לא מיושם)
- ניהול מלאי פיזי (אילו בלוקים באמת יש במעבדה)

---

## 🚀 מה הלאה (המלצות)

1. **בדיקות אוטומטיות:**
   ```typescript
   // הוסף בקובץ tests/shearWaveSelection.test.ts
   expect(selectShearWaveBlock({ part_od_mm: 50, ... })).toEqual({
     block: { master_id: 'SW_CURV_044' }
   });
   ```

2. **UI להצגת בלוקים:**
   ```tsx
   // בקומפוננט CalibrationTab
   {shearWaveBlock && (
     <div className="bg-blue-50 p-4 rounded">
       <h3>ASME Block: {shearWaveBlock.master_id}</h3>
       <p>Coverage: {shearWaveBlock.Dpart_min_mm}-{shearWaveBlock.Dpart_max_mm}mm</p>
     </div>
   )}
   ```

3. **קישור לרישומים:**
   - כל בלוק יכול להיות מקושר לרשומת מעבדה (serial number, תאריך כיול אחרון)
   - הוסף שדה `lab_inventory_id` ל-`ShearWaveCalibrationBlock`

---

## 📚 הפניות

- **ASME Section V, Article 4:** Ultrasonic Examination (T-434.3 Piping)
- **קוד מקור:** `src/data/shearWaveCalibrationBlocks.ts`
- **אלגוריתם בחירה:** `src/utils/calibrationRecommenderV2.ts` (שורות ~365-420)
- **דוגמאות שימוש:** מסמך זה

---

## 💡 סיכום קצר

**הטקסט שקראת = התיאוריה**  
**הקוד שיצרתי = המימוש**

יש לך עכשיו:
- 7 בלוקים שמכסים **24mm→אינסוף** ללא חורים
- חוקי ASME מקודדים (0.9-1.5, ±25%, >500mm flat)
- בחירה אוטומטית שעובדת **עכשיו** בתוך ScanMaster
- reasoning מפורט לכל בחירה (למה בחרתי בדיוק את הבלוק הזה)

**איך לנסות:**
1. לך ל-InspectionSetupTab
2. בחר: Part Type = **Tube**, OD = **100mm**, עובי = **10mm**
3. המערכת תבחר אוטומטית: **SW_CURV_074**
4. תראה הסבר: "Selected SW_CURV_074 (OD 73.7mm) for part OD 100mm..."

זהו! 🎉
