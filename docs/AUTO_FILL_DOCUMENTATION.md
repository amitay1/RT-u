# מערכת מילוי אוטומטי חכם - תיעוד

## סקירה כללית
המערכת מזהה אוטומטית קשרים בין שדות וממלאת ערכים מומלצים בהתאם לבחירות המשתמש.

---

## 1️⃣ בחירת תקן (Standard)

### שדות שמתמלאים אוטומטית:

#### **Acceptance Class (בטאב Acceptance Criteria)**
- **AMS-STD-2154E** → Class A (ברירת מחדל)
- **ASTM-E-114** → Class B (ברירת מחדל)

#### **Scan Coverage (בטאב Scan Parameters)**
- כל התקנים → 100% coverage (ברירת מחדל)

#### **Linearity Requirements**
נקבע אוטומטית בטאב Equipment:
- **AMS-STD-2154E**:
  - Vertical: 5-98%
  - Horizontal: ≥90%
- **ASTM-E-114**:
  - Vertical: 10-95%
  - Horizontal: ≥85%

---

## 2️⃣ בחירת חומר (Material)

### שדות שמתמלאים אוטומטית:

#### **תכונות חומר (מוצגות למשתמש)**
כל חומר מציג:
- **Velocity** - מהירות גל אורכי ורוחבי (mm/µs)
- **Acoustic Impedance** (MRayls)
- **Density** (g/cm³)
- **Surface Condition** - דרישות גימור משטח

#### **Frequency (בטאב Equipment)**
מחושב אוטומטית לפי:
- עובי החלק
- רמת הנחלשות של החומר

דוגמאות:
- אלומיניום 25mm → 5.0 MHz
- פלדה 50mm → 2.25 MHz
- טיטניום 10mm → 10.0 MHz (התאמה לנחלשות גבוהה)

#### **Metal Travel Distance (בטאב Calibration)**
מחושב כ-3x עובי החלק (מעוגל ל-5mm הקרוב):
- עובי 25mm → 75mm metal travel
- עובי 50mm → 150mm metal travel

#### **Couplant Type (בטאב Equipment)**
נבחר אוטומטית לפי:
- סוג המתמר (Immersion/Contact)
- סוג החומר

דוגמאות:
- Immersion + כל חומר → Water (distilled)
- Contact + Aluminum → Commercial ultrasonic gel
- Contact + Magnesium → Water-based gel (non-corrosive)

---

## 3️⃣ בחירת סוג חלק/גיאומטריה (Part Type)

### המלצות שמופיעות:

#### **Calibration Block Type**
המערכת ממליצה:
- **Plate** → Flat Block with FBH
- **Bar** → Flat Block
- **Forging** → Curved Block / Flat Block
- **Tube** → Hollow Cylindrical - FBH
- **Ring** → Curved Block / Hollow Cylindrical
- **Disk** → Flat Block

#### **Scan Pattern (בטאב Scan Parameters)**
המלצות:
- **Plate** → "Raster scan, 0° and 90° directions"
- **Bar** → "Longitudinal scan along bar axis"
- **Forging** → "Contour following, multiple orientations"
- **Tube** → "Helical or circumferential scan"
- **Ring** → "Circumferential scan, axial and radial"
- **Disk** → "Radial and circumferential patterns"

#### **Transducer Type**
המלצה אוטומטית:
- Plate/Tube/Ring/Disk → **Immersion**
- Bar/Forging → **Contact**

#### **Special Considerations**
התראות והמלצות:
- **Plate**: "Check for laminar discontinuities, back reflection loss"
- **Tube**: "Check both ID and OD surfaces, wall thickness variation"
- **Forging**: "Match calibration block to part curvature, check grain structure effects"

---

## 4️⃣ בחירת Acceptance Class

### שדות שמתמלאים אוטומטית:

#### **Acceptance Criteria (כל השדות)**
כאשר בוחרים Class, מתמלאים אוטומטית (FBH-based per AMS-STD-2154E):

**Class AAA** (הכי מחמיר):
- Single Discontinuity: 1/64" (0.4mm) FBH response
- Multiple Discontinuities: 1/64" (0.4mm) FBH (centers <1" apart)
- Linear Discontinuity: 1/64" (0.4mm) FBH, 1/8" max length
- Back Reflection Loss: Per Note 4
- Noise Level: 10% FSH maximum

**Class AA**:
- Single: 3/64" (1.2mm) FBH response
- Multiple: 2/64" (0.8mm) FBH (centers <1" apart)
- Linear: 2/64" (0.8mm) FBH, 1/2" max length
- BRL: 50% maximum
- Noise: 15% FSH maximum

**Class A**:
- Single: 5/64" (2.0mm) FBH response
- Multiple: 2/64" (0.8mm) FBH (centers <1" apart)
- Linear: 3/64" (1.2mm) FBH, 1" max length
- BRL: 50% maximum
- Noise: 20% FSH maximum

**Class B**:
- Single: 8/64" (3.2mm) FBH response
- Multiple: 3/64" (1.2mm) FBH (centers <1" apart)
- Linear: 5/64" (2.0mm) FBH, 1" max length
- BRL: 50% maximum
- Noise: 25% FSH maximum

**Class C** (הכי מקל):
- Single: 8/64" (3.2mm) FBH response
- Multiple: 5/64" (2.0mm) FBH
- Linear: Not applicable
- BRL: 50% maximum
- Noise: 30% FSH maximum

> **Note:** Values updated February 2026 to use FBH-based criteria per AMS-STD-2154E Table VI.
> Previous DAC% notation was replaced in January 2026.

---

## 5️⃣ בחירת Frequency

### שדות שמתמלאים אוטומטית:

#### **Resolution Values (בטאב Equipment)**
מחושב אוטומטית לפי תדר:

| Frequency | Entry Surface | Back Surface |
|-----------|--------------|--------------|
| 1.0 MHz   | 0.5"         | 0.2"         |
| 2.25 MHz  | 0.25"        | 0.1"         |
| 5.0 MHz   | 0.125"       | 0.05"        |
| 10.0 MHz  | 0.05"        | 0.025"       |
| 15.0 MHz  | 0.05"        | 0.025"       |

---

## 6️⃣ בחירת Transducer Type

### שדות שמתמלאים אוטומטית:

#### **Couplant Type**
- **Immersion** → "Water (distilled or deionized)"
- **Contact** → "Commercial ultrasonic gel"
- **Dual Element** → "High-viscosity gel"

עם התחשבות בחומר:
- Magnesium → תמיד Water-based (non-corrosive)

---

## 🎯 תכונות מיוחדות

### התראות חכמות:
1. **Titanium + Class AAA** → התראה מיוחדת על דרישות נוספות
2. **Thickness < 6.35mm** → אזהרה - מתחת לגבול התקן
3. **Material attenuation** → התאמת תדר אוטומטית

### סימונים חזותיים:
- 🌟 **תדר מומלץ** - מסומן בכוכב בתפריט
- 🤖 **Auto-filled** - badge ליד שדות שמולאו אוטומטית
- ℹ️ **Info tooltips** - מידע על תכונות חומר

---

## 📊 מסד נתונים

### Material Database
מכיל עבור כל חומר:
- Longitudinal & Shear Velocity
- Acoustic Impedance
- Attenuation coefficient
- Density
- Surface condition requirements
- Typical specifications

### Standard Rules
מכיל עבור כל תקן:
- Default acceptance class
- Min thickness
- Typical frequencies
- Couplant recommendations
- Scan coverage defaults
- Linearity requirements

### Geometry Recommendations
מכיל עבור כל גיאומטריה:
- Calibration block types
- Scan patterns
- Transducer type
- Special considerations

---

## 🔄 זרימת מילוי אוטומטי

```
Standard Selected
    ↓
    → Acceptance Class
    → Scan Coverage
    → Linearity Requirements
    
Material Selected
    ↓
    → Display Material Properties
    → Calculate Frequency (with Thickness)
    → Calculate Metal Travel
    → Select Couplant (with Transducer Type)
    
Part Geometry Selected
    ↓
    → Recommend Calibration Block
    → Suggest Scan Pattern
    → Recommend Transducer Type
    → Show Special Considerations
    
Acceptance Class Selected
    ↓
    → Fill ALL Acceptance Criteria
    → Set Back Reflection Loss
    → Set Noise Level
    
Frequency Selected
    ↓
    → Calculate Entry Surface Resolution
    → Calculate Back Surface Resolution
```

---

## ✅ סיכום

המערכת מזהה **אוטומטית** וממלאת **למעלה מ-20 שדות** על בסיס:
- 5 בחירות עיקריות (Standard, Material, Geometry, Acceptance Class, Frequency)
- מסד נתונים מקיף של תכונות חומרים
- כללי התקן
- המלצות מומחה NDT

**כל המילויים האוטומטיים** ניתנים לעריכה ידנית אם נדרש!
