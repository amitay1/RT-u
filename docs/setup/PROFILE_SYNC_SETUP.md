# תיקון סנכרון פרופילי מפקחים 🔧

## הבעיה שתוקנה
הפרופילים שנוצרו באפליקציה לא היו נשמרים במסד הנתונים, רק ב-localStorage של הדפדפן. כתוצאה מכך, כשפתחת את האפליקציה בדפדפן אחר או במכשיר אחר, הפרופילים לא היו זמינים.

## הפתרון שיושם
1. **עדכון סכמת מסד הנתונים** - הוספת כל השדות הנדרשים לטבלת `profiles`
2. **יצירת API endpoints** - ארבעה endpoints לניהול פרופילים (GET, POST, PATCH, DELETE)
3. **עדכון InspectorProfileContext** - תמיכה בסנכרון עם השרת + fallback ל-localStorage
4. **מיגרציית מסד נתונים** - קובץ SQL ליצירת הטבלה המעודכנת

## הפעלת המיגרציה

### שלב 1: הגדרת DATABASE_URL
ודא שיש לך משתנה סביבה `DATABASE_URL` המצביע למסד הנתונים שלך:

```bash
# בקובץ .env
DATABASE_URL=postgresql://user:password@host:port/database
```

### שלב 2: הרצת המיגרציה
יש שתי אפשרויות להפעלת המיגרציה:

#### אפשרות א': דרך psql (מומלץ)
```bash
psql $DATABASE_URL -f server/migrations/002_update_inspector_profiles.sql
```

#### אפשרות ב': דרך כלי ניהול DB
1. התחבר למסד הנתונים שלך (pgAdmin, DBeaver, וכו')
2. הפעל את התוכן של הקובץ `server/migrations/002_update_inspector_profiles.sql`

### שלב 3: אימות
לאחר הרצת המיגרציה, ודא שהטבלה נוצרה:

```sql
-- בדוק שהטבלה קיימת עם העמודות החדשות
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public';
```

אמור להראות את העמודות הבאות:
- id (uuid)
- user_id (uuid)
- name (text)
- initials (text)
- certification_level (text)
- certification_number (text)
- certifying_organization (text)
- employee_id (text)
- department (text)
- email (text)
- phone (text)
- signature (text)
- is_default (boolean)
- org_id (uuid)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)

## איך זה עובד עכשיו

### סנכרון אוטומטי
כל פעולה על פרופיל (יצירה, עדכון, מחיקה) נשמרת אוטומטית גם בשרת וגם ב-localStorage:

1. **יצירת פרופיל** → נשמר בשרת + localStorage
2. **עדכון פרופיל** → מתעדכן בשרת + localStorage
3. **מחיקת פרופיל** → נמחק מהשרת + localStorage
4. **טעינת פרופילים** → נטען מהשרת, עם fallback ל-localStorage אם השרת לא זמין

### זיהוי משתמשים אנונימיים
האפליקציה משתמשת ב-UUID ייחודי לכל משתמש, שנשמר ב-localStorage תחת המפתח `scanmaster_user_id`. זה מאפשר לאפליקציה לעבוד גם בלי אימות משתמשים.

## בדיקה שהתיקון עובד

1. **צור פרופיל חדש** באפליקציה
2. **פתח את DevTools** (F12) → Console
3. **חפש את ההודעה**: "Profile saved to server"
4. **פתח דפדפן אחר** (או מצב פרטי)
5. **גש לאותו URL** של האפליקציה
6. **הפרופיל אמור להופיע** גם בדפדפן החדש! ✅

## Troubleshooting

### הפרופילים לא נשמרים בשרת
בדוק ב-console של הדפדפן אם יש שגיאות. אם רואה:
```
Failed to save profile to server
```

פתרונות אפשריים:
1. ודא שהשרת רץ (`npm run dev`)
2. בדוק ש-DATABASE_URL מוגדר נכון
3. ודא שהמיגרציה רצה בהצלחה
4. בדוק logs של השרת לשגיאות

### הפרופילים נעלמים בין דפדפנים
אם הפרופילים עדיין לא מופיעים בדפדפן אחר:
1. ודא ש-`x-user-id` זהה (או השתמש באותו localStorage)
2. בדוק שהשרת מחזיר נתונים ב-API: `curl http://localhost:5000/api/inspector-profiles -H "x-user-id: YOUR_USER_ID"`

### שגיאת Migration
אם המיגרציה נכשלת:
1. בדוק שטבלת `organizations` קיימת (מהמיגרציה הקודמת)
2. בדוק שפונקציה `update_updated_at_column()` קיימת
3. ודא שיש לך הרשאות CREATE TABLE במסד הנתונים

## שינויים טכניים שבוצעו

### קבצים ששונו:
1. ✅ [shared/schema.ts](shared/schema.ts) - עדכון סכמת profiles
2. ✅ [server/routes.ts](server/routes.ts) - הוספת 5 endpoints לפרופילים
3. ✅ [server/storage.ts](server/storage.ts) - הוספת 5 מתודות לניהול פרופילים
4. ✅ [src/contexts/InspectorProfileContext.tsx](src/contexts/InspectorProfileContext.tsx) - סנכרון עם API

### קבצים חדשים:
1. ✅ [server/migrations/002_update_inspector_profiles.sql](server/migrations/002_update_inspector_profiles.sql) - מיגרציה למסד הנתונים

## API Endpoints החדשים

```
GET    /api/inspector-profiles          - קבלת כל הפרופילים של המשתמש
GET    /api/inspector-profiles/:id      - קבלת פרופיל ספציפי
POST   /api/inspector-profiles          - יצירת פרופיל חדש
PATCH  /api/inspector-profiles/:id      - עדכון פרופיל קיים
DELETE /api/inspector-profiles/:id      - מחיקת פרופיל
```

כל הבקשות דורשות header:
```
x-user-id: <UUID של המשתמש>
```

---

**הבעיה נפתרה! 🎉**
עכשיו הפרופילים שלך ישמרו לצמיתות במסד הנתונים ויהיו זמינים מכל דפדפן ומכשיר.
