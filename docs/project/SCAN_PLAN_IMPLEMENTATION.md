# Scan Plan Tab - Implementation Guide

## סקירה כללית
הוספנו טאב חדש בשם "Scan Plan" לאפליקציית Scan Master. הטאב מציג מדריכים ומסמכים PDF בתוך האפליקציה.

## מה שהוסף

### 1. קומפוננטים חדשים
- **ScanPlanTab.tsx** - קומפוננט הטאב הראשי עם:
  - רשימת מסמכים בצד שמאל
  - PDF viewer משובץ בצד ימין
  - פקדי זום (50%-300%)
  - ניווט בין עמודים
  - הורדת מסמכים
  - פתיחה בחלון חיצוני
  - מצב מסך מלא

### 2. טיפוסים (Types)
נוסף ל-`src/types/techniqueSheet.ts`:
```typescript
export interface ScanPlanDocument {
  id: string;
  title: string;
  description: string;
  filePath: string;
  category?: string;
  order: number;
  isActive: boolean;
}

export interface ScanPlanData {
  documents: ScanPlanDocument[];
}
```

### 3. טכנולוגיה
- משתמש ב-**iframe** מובנה של הדפדפן להצגת PDF
- פשוט, מהיר ואמין
- אין צורך בספריות חיצוניות מיוחדות

### 4. מבנה תיקיות
```
public/
  documents/
    scan-plan-guide.pdf   <- המסמך שהמרת
```

## איך להוסיף מסמכים נוספים

### שלב 1: הוסף את קובץ ה-PDF
שים את הקובץ בתיקייה:
```
public/documents/your-document.pdf
```

### שלב 2: עדכן את State ב-Index.tsx
בקובץ `src/pages/Index.tsx`, מצא את ההגדרה של `scanPlan` (שורה ~243) והוסף מסמך חדש:

```typescript
const [scanPlan, setScanPlan] = useState<ScanPlanData>({
  documents: [
    {
      id: "scan-plan-1",
      title: "Scan Master - Scan Plan Guide",
      description: "Complete guide for scan planning and execution",
      filePath: "/documents/scan-plan-guide.pdf",
      category: "Planning",
      order: 1,
      isActive: true,
    },
    // הוסף מסמך חדש כאן:
    {
      id: "scan-plan-2",
      title: "שם המסמך החדש",
      description: "תיאור המסמך",
      filePath: "/documents/your-document.pdf",
      category: "קטגוריה",
      order: 2,
      isActive: true,
    }
  ]
});
```

### שלב 3: עשה את אותו הדבר ל-Part B
עדכן גם את `scanPlanB` באותו אופן (שורה ~257).

## תכונות מתקדמות

### קטגוריות
ניתן לארגן מסמכים לפי קטגוריות:
- "Planning" - תכנון
- "Procedures" - נהלים
- "Standards" - תקנים
- "Training" - הדרכה

### סדר תצוגה
המסמכים מוצגים לפי שדה `order` (מהקטן לגדול).

### הסתרת מסמכים
כדי להסתיר מסמך ללא למחוק אותו, שנה את `isActive: false`.

## פתרון בעיות

### PDF לא נטען
1. בדוק שהקובץ קיים ב-`public/documents/`
2. בדוק שה-`filePath` מתחיל ב-`/documents/` (עם סלאש)
3. בדוק שהקובץ הוא PDF תקין

### שגיאות Worker
אם יש שגיאה עם PDF.js worker, הקוד כבר מוגדר להשתמש ב-worker המקומי של react-pdf.

### בעיות ביצועים
- PDF גדולים (מעל 10MB) עלולים להיטען לאט
- נסה לדחוס את ה-PDF או לפצל למסמכים קטנים יותר

## מאפיינים נוספים שניתן להוסיף בעתיד

1. **חיפוש בתוך מסמכים** - הוסף TextLayer
2. **הדגשות והערות** - השתמש ב-AnnotationLayer
3. **העלאת מסמכים** - אפשר למשתמשים להעלות PDF משלהם
4. **ניהול דינמי** - ממשק לניהול רשימת המסמכים
5. **תרגומים** - תמיכה בשפות נוספות
6. **היסטוריית צפייה** - עקוב אחרי מה המשתמש צפה
7. **מועדפים** - אפשר לסמן מסמכים חשובים

## קבצים שעודכנו

1. `src/components/tabs/ScanPlanTab.tsx` - קומפוננט חדש
2. `src/types/techniqueSheet.ts` - טיפוסים חדשים
3. `src/pages/Index.tsx` - אינטגרציה עם הטאב
4. `package.json` - ספריות חדשות
5. `public/documents/scan-plan-guide.pdf` - המסמך

## שימוש

1. פתח את האפליקציה
2. לך לטאב "Technique Sheet"
3. לחץ על הטאב "Scan Plan" (הכי מימין)
4. בחר מסמך מהרשימה בצד שמאל
5. השתמש בפקדים כדי:
   - לזום פנימה/החוצה
   - לעבור בין עמודים
   - להוריד את המסמך
   - לפתוח בחלון חיצוני
   - לעבור למסך מלא

---

נוצר על ידי Claude Code
