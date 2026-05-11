# תיקון בעיית כפתור "Restart & Update"

## הבעיה שתוקנה
כפתור ה-"Restart & Update" בדיאלוג העדכון לא הגיב ולא עשה דבר.

## מה תוקן

### 1. electron/main.js
- הוספתי את `ipcMain` ל-imports
- הוספתי את `electron-updater` עם auto-updater
- הוספתי event handlers לכל שלבי העדכון (checking, available, downloading, downloaded, error)
- הוספתי IPC handlers:
  - `check-for-updates` - בודק עדכונים
  - `install-update` - מתקין עדכון ומפעיל מחדש
  - `get-app-version` - מחזיר גרסה נוכחית
- העדכון בודק אוטומטית 3 שניות אחרי הפעלת האפליקציה (רק ב-production)

### 2. electron/preload.js
- הוספתי `contextBridge.exposeInMainWorld('electron', {...})` שחושף:
  - `getAppVersion()` - מקבל גרסה
  - `checkForUpdates()` - בודק עדכונים
  - `installUpdate()` - מתקין ומפעיל מחדש
  - `onUpdateStatus(callback)` - מאזין לסטטוסים
  - `removeUpdateListener(callback)` - מסיר מאזין

### 3. package.json
- תיקנתי את `main` מ-`electron/main.cjs` ל-`electron/main.js`
- תיקנתי את הסקריפטים `electron` ו-`electron:dev`
- הוספתי קונפיגורציית `build` עבור electron-builder עם:
  - הגדרות publish ל-GitHub releases
  - הגדרות עבור Windows, Mac, Linux

## איך לבדוק את התיקון

### בדיקה במצב פיתוח (Development)
```bash
npm run electron:dev
```
במצב פיתוח, העדכונים לא יפעלו (כי זה רק לפרודקשן).

### בדיקה במצב ייצור (Production)
1. בנה את האפליקציה:
```bash
npm run dist:win
```

2. פרסם גרסה חדשה ל-GitHub:
```bash
npm run release
```

3. התקן את הגרסה הישנה ופתח אותה
4. כשיש גרסה חדשה, תקבל התראה
5. לחץ על "Restart & Update" - האפליקציה תסגר ותפתח מחדש עם הגרסה החדשה

## הערות חשובות

1. **GitHub Releases**: העדכונים פועלים דרך GitHub Releases. צריך:
   - Repository ב-GitHub
   - Token עם הרשאות לפרסם releases
   - הגדרת GH_TOKEN כמשתנה סביבה

2. **גרסה**: הגרסה הנוכחית היא 1.0.24 (מ-package.json)

3. **Auto-download**: העדכון מוריד אוטומטית ברקע

4. **מתקדם**: ניתן להגדיר update server פרטי במקום GitHub

## קבצים ששונו
- ✅ [electron/main.js](electron/main.js)
- ✅ [electron/preload.js](electron/preload.js)
- ✅ [package.json](package.json)

## הקומפוננטה שעובדת עם השינויים
- ✅ [src/components/UpdateNotification.tsx](src/components/UpdateNotification.tsx) - לא השתנתה, עובדת מול ה-API החדש
