# Scan Master - ספר מידע טכני וארכיטקטוני

מסמך זה מרכז תמונת מצב מקצועית של מערכת Scan Master: מטרת המוצר, ארכיטקטורה, רכיבי תוכנה, שכבות אבטחה, יכולות NDT/Aerospace, רישוי, הפצה, פערים ידועים, ואפשרות חיבור עתידית ל-CSI / רובוט ScanMaster.

המסמך מיועד לשמש כ-reference טכני. הוא אינו מסמך שיווקי, אינו מסמך הסמכה רגולטורי, ואינו מחליף review מקצועי של NDT Level III, צוות איכות, צוות אבטחה או ייעוץ משפטי. מטרתו להציג בצורה שקופה את מה שקיים במערכת, מה נמצא בתשתית ראשונית, ומה דורש השלמה לפני production חיצוני או שימוש enterprise.

## ניווט מהיר

| נושא | סעיפים |
| --- | --- |
| תקציר מערכת | 1-3 |
| ארכיטקטורה וטכנולוגיות | 4-8 |
| נתונים, הרשאות ו-storage | 9-13 |
| אבטחה ו-production hardening | 14-20 |
| רישוי, תשלומים, עדכונים והפצה | 21-25 |
| איכות קוד, בדיקות ו-CI | 26-29 |
| NDT/Aerospace readiness | 30-43 |
| חיבור ל-CSI / רובוט ScanMaster | 44-58 |
| פערים ידועים ותוכנית סגירה | 59-61 |
| מפת קבצים ומקורות | 62-64 |

## 1. תקציר מנהלים

Scan Master היא מערכת תוכנה ליצירת Technique Sheets ו-Inspection Reports עבור בדיקות Ultrasonic Testing / NDT. המערכת משלבת UI עשיר, חישובי דומיין, תמיכה בתקנים, פרטי ציוד וכיול, שרטוטים טכניים, יצוא מסמכים, Electron desktop mode, ויכולת תשתיתית לחיבור עתידי ל-CSI / תוכנת שליטה של ScanMaster.

מצב המערכת הנוכחי:

| תחום | מצב נוכחי |
| --- | --- |
| מוצר ודומיין | קיימת יכולת משמעותית ליצירת מסמכי NDT, חישובים, auto-fill, שרטוטים ויצוא |
| Frontend | React + TypeScript + Vite עם context/hooks ורכיבי UI רבים |
| Backend | Express API, Drizzle/Postgres/Supabase, routes ל-storage, CAD, licensing ועוד |
| Desktop | Electron עם preload bridge, local storage, offline license manager ו-update mechanisms |
| בדיקות | `npm test` עבר עם 291 בדיקות; `npm run typecheck` עבר |
| אבטחה | קיימות שכבות Helmet, CORS, rate limit, validation, Supabase RLS וחלק מ-Electron hardening |
| פערים | dev/mock auth, CSP רחב, update-server לא מוקשח, audit findings, lint errors, installer לא חתום |
| CSI/Robot | קיים `csiExporter` ראשוני, patch generation, OEM rules ו-DAC/TCG calculators; נדרש מידע מ-ScanMaster לפני אינטגרציה אמיתית |

## 2. הגדרת מוצר

ליבת המוצר היא יצירת מסמכי עבודה ובדיקה עבור תהליכי UT/NDT. המערכת מסייעת בתיעוד והכנת נתונים כגון:

- פרטי חלק: part number, part name, material, dimensions, drawing reference.
- תקן או procedure: AMS, ASTM, BS-EN, MIL-STD, NDIP/MRO assets ועוד.
- פרטי ציוד: instrument, transducer, wedge, couplant, calibration blocks.
- פרמטרי סריקה: method, scan type, speed, index, water path, PRF, gain, gates.
- קריטריוני קבלה: discontinuity limits, back reflection loss, noise level, special requirements.
- דוקומנטציה: inspector, certification, procedure number, revision, inspection date.
- יצוא: PDF, DOCX, שרטוטים טכניים, ויכולת ראשונית ל-CSI setup export.

המערכת צריכה להיות ממוצבת ככלי decision-support, documentation ו-traceability. החלטות מקצועיות סופיות בבדיקות NDT נשארות באחריות אנשי המקצוע המוסמכים, הנהלים הפנימיים וה-Level III הרלוונטי.

## 3. יכולות מרכזיות

| יכולת | פירוט |
| --- | --- |
| Technique Sheet generation | יצירת setup מלא עם חלק, ציוד, כיול, סריקה, acceptance ו-documentation |
| Inspection Report generation | יצירת דוח בדיקה עם cover, equipment, diagrams, indications, results ו-certification |
| Standards support | תמיכה בדאטה ו-assets עבור תקנים ונהלים שונים |
| Auto-fill and calculations | מנועי חישוב, המלצות כיול, התאמות תקן, DAC/TCG ו-coverage |
| Technical diagrams | רכיבי שרטוט עבור גאומטריות שונות ויצוא שרטוטים |
| Desktop/offline | Electron mode עם שמירה מקומית ורישוי offline |
| Cloud path | Supabase/Postgres ו-Edge Functions עבור SaaS עתידי |
| CSI preparation | skeleton ליצוא setup עבור CSI / מערכת סריקה |

## 4. ארכיטקטורה ברמה גבוהה

```text
React/Vite UI
  |
  |-- Contexts/Hooks: state, license, organization, inspector profile, saved cards
  |
  |-- Browser/Web mode
  |     |
  |     |-- Express API: technique sheets, profiles, standards, CAD, licensing
  |     |-- Supabase Edge Functions: JWT-based standard access and Lemon Squeezy checkout/webhook
  |     |-- PostgreSQL via Drizzle schema
  |
  |-- Electron/Desktop mode
        |
        |-- Electron main process + preload bridge
        |-- Embedded localhost Express server
        |-- Local JSON storage under userData
        |-- Offline license manager
        |-- Optional update checks and USB/offline updater
```

המערכת בנויה כך שאותו מוצר יכול לרוץ במסלול Web/SaaS ובמסלול Desktop/offline. שני המסלולים אינם זהים מבחינת סיכוני אבטחה, deployment, רישוי, data retention ודרישות support.

## 5. Tech Stack

| שכבה | טכנולוגיות |
| --- | --- |
| UI | React 18, TypeScript, Vite |
| Styling/UI | Tailwind/shadcn-style components, custom diagrams, charts |
| State | React Contexts, custom hooks, local storage fallback |
| Backend | Express 5, TypeScript |
| DB | Drizzle ORM, PostgreSQL, Supabase |
| Desktop | Electron, preload bridge, local userData storage |
| Export | jsPDF, docx, custom exporters |
| CAD/geometry | Python drawing engine, STEP/CAD output areas |
| Testing | Vitest/unit tests, typecheck |
| Release | Electron Builder, release scripts, update-server, download gate |

## 6. קבצים מרכזיים

| אזור | קבצים |
| --- | --- |
| Frontend entry | `src/App.tsx`, `src/main.tsx`, `src/pages/Index.tsx` |
| State/Context | `src/contexts/*.tsx`, `src/hooks/*.ts(x)` |
| Backend | `server/index.ts`, `server/routes.ts`, `server/storage.ts`, `server/middleware/*` |
| DB schema | `shared/schema.ts`, `database/01-schema.sql`, `supabase/migrations/*` |
| Supabase | `src/integrations/supabase/client.ts`, `supabase/functions/*` |
| Electron | `electron/main.cjs`, `electron/preload.cjs`, `electron/license-manager.cjs`, `electron/offline-updater.cjs` |
| CSI integration | `src/utils/exporters/csiExporter.ts`, `src/utils/patchGenerator.ts`, `src/utils/oemRuleEngine.ts`, `src/utils/dacCalculator.ts` |
| Release/licensing | `scripts/release.ps1`, `scripts/license-generator.cjs`, `update-server/index.js`, `docs/licensing/*` |
| Download gate | `download-gate/*`, `download-gate/drive-uploader/*` |

## 7. Web מול Desktop

| מצב | שימוש עיקרי | מאפיינים |
| --- | --- | --- |
| Web/SaaS | עבודה עתידית בענן, Supabase, auth/payment/cloud DB | דורש production auth, tenant isolation, monitoring, backups ו-hardening |
| Electron/Desktop | מפעלים, עמדות עבודה, offline, סביבת רשת מוגבלת | מאפשר local storage, רישוי offline, הפצה מבוקרת והפחתת תלות בענן |

הבחנה זו חשובה משום שמערכת שמוכנה להפעלה מקומית אינה בהכרח מוכנה לחשיפה כ-SaaS ציבורי.

## 8. ניהול State וזרימת UI

המערכת משתמשת ב-React Contexts ו-custom hooks במקום state manager מרכזי מסוג Redux. החלוקה כוללת:

- `LicenseContext` עבור סטטוס רישוי ויכולות זמינות.
- `OrganizationContext` עבור organizations ו-multi-tenant context.
- `InspectorProfileContext` עבור פרטי בודק ופרופיל.
- `SavedCardsContext` עבור שמירות/כרטיסים.
- hooks עבור technique sheet state, persistence, export workflow, standard auto-fill ועוד.

הבחירה מתאימה למבנה מודולרי שבו רוב state הוא domain-specific ולא global application state כללי.

## 9. שמירת נתונים

| מצב | Storage |
| --- | --- |
| Cloud/SaaS | PostgreSQL דרך Supabase/Drizzle |
| Browser/dev fallback | `localStorage` |
| Electron/offline | JSON files תחת `app.getPath('userData')` |
| License local | `license.dat` ו-`license.bak` |
| Draft/recovery | localStorage ו-recovery contexts |

נתונים רגישים אפשריים כוללים שמות בודקים, מספרי הסמכה, אימיילים, טלפונים, חתימות, פרטי ציוד, מספרי חלקים, דוחות inspection, תמונות ושרטוטים.

## 10. Multi-Tenant ו-Organization Model

ה-schema כולל entities כגון organizations, org_members, profiles ו-technique_sheets עם `orgId`. ב-`server/storage.ts` קיימות בדיקות לפי `orgId` עבור פעולות technique sheets.

מצב נוכחי:

- Supabase migrations כוללים RLS policies לפי org/user.
- חלק מה-Express routes משתמשים ב-`mockAuth` שמקבל `x-user-id` ו-`x-org-id`.
- המשמעות היא שהמודל קיים, אך enforcement מלא ב-Express דורש החלפת dev/mock auth ב-JWT middleware אמיתי.

## 11. Authentication והרשאות

| אזור | מצב |
| --- | --- |
| Supabase client | משתמש ב-`VITE_SUPABASE_URL` ו-`VITE_SUPABASE_PUBLISHABLE_KEY` |
| Supabase functions | חלק מה-functions בודקות Bearer token מול Supabase |
| Frontend dev auth | `src/hooks/useAuth.tsx` מפעיל dev session כברירת מחדל אם `dev_mode` לא `false` |
| Express routes | קיימת `mockAuth` שמסתמכת על headers |

דרישה לפני production:

- JWT middleware אמיתי לכל Express API רגיש.
- הסרת dev defaults מ-production build.
- enforcement של user/org מתוך token חתום בלבד.
- RBAC ל-admin/licensing/update operations.

## 12. API ו-Backend

ה-Express server כולל:

- Helmet/security headers.
- CORS configuration.
- compression.
- JSON body limit.
- rate limiting בסיסי על `/api`.
- health/metrics endpoints.
- static/Vite serving.
- error handling.

נקודות שדורשות hardening:

- rate limiter הוא in-memory ואינו distributed.
- `validateApiKey` קיים אך לא מופעל באופן רחב.
- `preventSqlInjection` קיים אך אינו מופעל בפועל.
- חלק מה-routes אינם מוגנים מספיק כאשר Express נחשף לאינטרנט.

## 13. Supabase ו-Edge Functions

קיימות פונקציות כגון:

- `validate-standard-access`.
- `get-user-standards`.
- `create-lemon-squeezy-checkout`.
- `lemon-squeezy-webhook`.

נקודות חיוביות:

- חלק מה-functions מאמתות Bearer token.
- service role נמצא בצד server/edge ולא ב-client.
- RLS policies קיימות במיגרציות.

פערים:

- webhook signature צריך להיות mandatory ולא optional.
- CORS ו-logging צריכים review לפני production.
- secrets ו-deployment validation צריכים להיות חלק מ-CI/CD.

## 14. אבטחה קיימת

| שכבה | מנגנונים קיימים |
| --- | --- |
| HTTP | Helmet, security headers, CORS, compression |
| API | Zod validation בחלק מהנתיבים, Drizzle ORM במקום string SQL |
| Rate limit | middleware בסיסי |
| Supabase | JWT verification בחלק מה-functions, RLS migrations |
| Electron | `nodeIntegration: false`, `contextIsolation: true`, preload bridge |
| Licensing | HMAC SHA-256 signatures, AES-256-CBC local storage |
| Updates | checksum verification, optional signature verification |

## 15. פערי אבטחה לפני Production

| עדיפות | נושא | מצב נוכחי | פעולה נדרשת |
| --- | --- | --- | --- |
| P0 | Express auth | `mockAuth` ו-dev session | JWT middleware אמיתי, הסרת dev mode ב-production |
| P0 | Dependencies | `npm audit` מצא 20 vulnerabilities | שדרוג מבוקר והרצת regression |
| P0 | Secrets/archive | `.env` לא tracked, אך קיימים archive/license artifacts לבדיקה | ניקוי/rotation לפני שיתוף או production |
| P0 | Signed reports | אין immutable audit trail/cryptographic signature מלא | report lock, hash, revision, audit events |
| P0 | Standards versioning | לא מספיק לשמור שם תקן כללי | revision, effective date ו-rule snapshot בכל sheet |
| P0 | Update server | admin APIs ללא auth, storage בזיכרון | admin auth, DB persistent, rate limit, audit log |
| P0 | Desktop signing | Windows `signAndEditExecutable=false` | code signing certificate וחתימת releases |
| P1 | Electron security | `no-sandbox`, CSP רחב, window-open filtering חלקי | sandbox review, CSP הקשחה, protocol filtering |
| P1 | Webhook | signature verification לא מחויבת בכל מצב | דחיית webhook ללא signature תקין |
| P1 | Local server | Electron server על port 5000 | bind ל-`127.0.0.1`, מניעת גישה מרשת מקומית |
| P1 | CSI/robot integration | exporter ראשוני בלבד | schema/sample/API/machine limits ו-safety workflow |
| P2 | Tests | unit tests קיימים, חסרים E2E/API/security | Playwright/API/security regression |

## 16. Secrets ו-sensitive files

ממצאי hygiene:

- `git ls-files` מציג `.env.example` ו-`.env.production.template`, לא `.env` ולא `.env.local`.
- `download-gate/drive-uploader/config.local.json` קיים מקומית ומוחרג על ידי `.gitignore`.
- קיימים קבצי license archive תחת `docs/archive/licenses/` שדורשים review אם הם אינם test-only.
- קוד גישה של download gate מופיע במסמכי setup/scripts מקומיים ולכן נדרש rotation לפני הפצה או handoff.

מסמך זה אינו כולל את ערך קוד הגישה עצמו.

## 17. SQL Injection ו-Input Validation

הגישה המרכזית ל-DB עוברת דרך Drizzle ORM ושימוש ב-`eq`, `and`, `where`. קיימים גם Zod validations בחלק מה-routes. שימוש ב-raw SQL נראה מוגבל ולא מבוסס ישירות על input חופשי מהמשתמש ברוב המקומות שנבדקו.

דרישות להמשך:

- API inventory מלא.
- validation אחיד לכל endpoints.
- בדיקות security regression.
- הפעלה או החלפה של middleware נגד input מסוכן בהתאם ל-false positives.

## 18. XSS ו-CSP

המערכת משתמשת ב-React שמבצע escaping כברירת מחדל. עם זאת, קיימים רכיבי viewer/export/chart שבהם יש לוודא שאין הכנסת HTML לא מסונן.

נקודות לשיפור:

- CSP production כולל כיום `unsafe-inline` ו-`unsafe-eval` במקומות מסוימים.
- Electron CSP רחב יחסית.
- יש לבצע review ל-document viewers, HTML export, Markdown/HTML rendering ו-chart labels.

## 19. Electron Security

נקודות חיוביות:

- `nodeIntegration: false`.
- `contextIsolation: true`.
- preload bridge מוגדר.
- `webSecurity: true`.

פערים:

- קיימים `no-sandbox` ו-`disable-gpu-sandbox`.
- CSP רחב.
- `setWindowOpenHandler` צריך filtering קשיח של protocols.
- embedded server צריך להיות bound ל-loopback בלבד.
- installer לא חתום.

## 20. CAD/Python Engine

ה-CAD endpoints מפעילים Python דרך `spawn` ולא דרך shell string. output paths מוגדרים בצד server, ויש Zod validation בחלק מהנתיבים.

דרישות hardening:

- timeout לתהליכי Python.
- resource limits.
- ניקוי temporary files.
- validation מלאה ל-input geometry.
- בדיקות path traversal ו-output isolation.

## 21. Licensing

רישוי desktop/offline כולל:

- HMAC SHA-256 license signatures.
- AES-256-CBC local encrypted license storage.
- `license.dat` ו-backup מקומי.
- Electron license manager.

פערים:

- fallback/default secret קיים אם env חסר.
- web license enforcement אינו מלא.
- `canUseStandard` מחזיר `true` בהקשר מסוים ולכן standard locking אינו enforced end-to-end.
- נדרש revocation model, grace period ו-read-only behavior כאשר license פג.

## 22. Payments / Lemon Squeezy

קיימות שתי שכבות:

| אזור | מצב |
| --- | --- |
| Supabase checkout function | מימוש אמיתי מול Lemon Squeezy |
| Supabase webhook | קיים אך signature חייב להיות mandatory |
| Express `/api/create-checkout` | mock URL |

לפני production יש לבחור canonical checkout path, להסיר/לסמן mock endpoints, לבצע E2E checkout test ולוודא secrets/webhook validation.

## 23. Updates ו-Installer

קיימים:

- Electron Builder config.
- GitHub publish config.
- update-server.
- offline updater.
- checksum verification.
- optional signature verification.

פערים:

- Windows signing disabled.
- update-server admin APIs לא מוקשחים.
- storage בזיכרון ב-update-server.
- signature verification צריכה להיות חובה עבור release artifacts.

## 24. Download Gate

קיים מנגנון gated download סביב Google Drive/upload flow.

נקודות רלוונטיות:

- `config.local.json` מוחרג מגיט.
- יש access code במסמכי setup/scripts מקומיים.
- לפני הפצה חיצונית נדרש rotate ל-access code.
- מומלץ להפריד בין beta download gate לבין production distribution.

## 25. Privacy, Logs ו-Data Retention

נתונים אפשריים במערכת:

- שמות בודקים ופרטי הסמכה.
- אימיילים וטלפונים.
- חתימות.
- מספרי חלקים ושרטוטים.
- פרטי ציוד וכיול.
- דוחות inspection.
- תמונות ו-evidence.
- crash/log data.

דרישות לפני SaaS:

- privacy policy.
- retention policy.
- data export/delete workflow.
- log scrubbing.
- support access policy.
- backup encryption ו-restore testing.

## 26. איכות קוד ובדיקות

תוצאות בדיקות שנעשו עבור מצב המסמך:

| פקודה | תוצאה |
| --- | --- |
| `npm run typecheck` | עבר |
| `npm test` | עבר: 14 test files, 291 tests |
| `npm audit --omit=dev --audit-level=moderate` | נכשל: 20 vulnerabilities, מתוכן 2 critical ו-11 high |
| `npm run lint` | נכשל; כלל גם `.claude/worktrees` |
| `npx eslint . --ignore-pattern ".claude/**"` | נכשל: 45 errors, 303 warnings |

## 27. Dependency Audit

נמצאו vulnerabilities ב-packages כגון:

- `jspdf`.
- `drizzle-orm`.
- `react-router` / `@remix-run/router`.
- `express-rate-limit`.
- `dompurify`.
- `lodash`.
- `makerjs`.
- `postcss`.
- `qs`.
- `yaml`.

שדרוגים צריכים להתבצע באופן מבוקר בשל סיכון breaking changes ב-export, routing ו-DB.

## 28. CI/CD

מצב מומלץ לפני handoff/production:

- CI שמריץ `npm test`.
- CI שמריץ `npm run typecheck`.
- CI שמריץ lint עם ignore מוגדר ל-generated/worktree directories.
- audit gate לפי severity מוסכם.
- build smoke ל-Web ול-Electron.
- release checklist עם signing, changelog, checksums ו-signatures.

## 29. Generated Artifacts ו-Repository Hygiene

הריפו מכיל assets, docs, reference materials, archives ו-generated outputs. לפני מסירת repo או מעבר ל-production מומלץ לבצע:

- הפרדת source code מ-reference/archive materials.
- בדיקת זכויות שימוש ל-standards PDFs.
- ניקוי license archives שאינם test-only.
- בדיקת קבצים גדולים שאינם נדרשים.
- יצירת README handoff קצר.

## 30. NDT/Aerospace Positioning

המערכת תומכת בדומיין NDT, אך אינה מסמיכה תהליך, בודק או ארגון.

| תחום | מיקום מקצועי נכון |
| --- | --- |
| Nadcap | המערכת יכולה לתמוך בתיעוד ועקיבות, אך אינה מספקת Nadcap accreditation |
| AS9100 | המערכת יכולה להשתלב תחת QMS, אך אינה מחליפה QMS |
| NAS 410 / EN 4179 | הסמכת בודקים נשארת אצל הארגון וה-Level III |
| 21 CFR Part 11 | רלוונטי רק אם נכנסים ל-regulated electronic records/signatures |

## 31. Audit Trail וחתימות

מצב נוכחי: אין להניח שקיים immutable audit trail מלא או חתימה קריפטוגרפית משפטית לדוחות חתומים.

מודל production מומלץ:

| רכיב | דרישה |
| --- | --- |
| Report state | `draft`, `reviewed`, `signed`, `voided` |
| Hash | SHA-256 על payload קנוני של דוח וקבצים מצורפים |
| Signature | חתימה קריפטוגרפית או אישור משתמש מאומת |
| Audit log | append-only events: מי, מתי, device/IP, שינוי |
| Revision | שינוי אחרי חתימה יוצר revision חדש |
| Export | PDF כולל report id, revision, hash, timestamp ומאשר |

## 32. Standards Versioning

כל sheet/report צריך לשמור:

- standard id.
- שם התקן.
- revision.
- effective date.
- rule snapshot.
- מי אישר שימוש ברוויזיה.

כאשר יוצאת רוויזיה חדשה של תקן, מסמכים קיימים צריכים להישאר מקושרים לרוויזיה המקורית. migration לרוויזיה חדשה צריך להיות פעולה מודעת ומתועדת.

## 33. Data Residency, ITAR ו-Export Control

לקוחות aerospace עשויים לעבוד עם נתוני חלקים רגישים, מספרי serial, שרטוטים או מידע export-controlled. SaaS רגיל אינו בהכרח מתאים לכך.

דרישות תפעוליות:

- בחירת region ל-DB/Supabase.
- DPA/privacy policy.
- תמיכה ב-on-prem/offline כאשר נדרש.
- הגבלת גישה לתמיכה וללוגים.
- encryption ו-retention policy.
- review משפטי לנושאי ITAR/export control.

## 34. Disaster Recovery ו-Backup

עבור SaaS נדרש להגדיר:

- RTO.
- RPO.
- backup frequency.
- encryption.
- restore owner.
- restore test schedule.

עבור Electron/offline נדרש export/backup מקומי ברור כדי שמחשב תקול לא יגרום לאובדן נתונים.

## 35. Telemetry ו-Crash Reports

בסביבת NDT/Aerospace יש להניח ש-crash data עלול לכלול PII או מידע לקוח רגיש כגון file paths, part numbers, serial numbers או שמות לקוחות.

מדיניות מומלצת:

- opt-in או יכולת כיבוי מלאה.
- שליחת metadata טכני בלבד.
- ניקוי PII/log payload.
- אי שליחת דוחות, תמונות או scan data ללא אישור מפורש.

## 36. License Expiry ו-Revocation

התנהגות רישוי צריכה להיות מוגדרת:

- read-only mode כאשר license פג.
- grace period.
- revocation list או online validation כאשר קיים חיבור.
- שמירה על גישה לנתונים קיימים.
- מדיניות ל-Electron offline.

## 37. Concurrent Editing

בארגון מרובה משתמשים יש סיכון ל-last-write-wins אם שני משתמשים עורכים אותו sheet במקביל.

פתרונות מומלצים:

- optimistic locking באמצעות version/updatedAt.
- conflict detection.
- soft lock בזמן עריכה.
- audit event לכל שינוי.
- merge/revision workflow כאשר נדרש.

## 38. Instrument Integration

המערכת אינה acquisition system ואינה מחליפה תוכנות מכשיר כגון OmniScan/Eddyfi/Sonatest. מיקום נכון:

- planning.
- setup generation.
- documentation.
- reporting.
- export/import integration.

אינטגרציה לכלי acquisition דורשת פורמטים, API/SDK, sample data ו-validation מול היצרן או הלקוח.

## 39. Customer-Supplied Standards

לקוחות aerospace משתמשים לעיתים בתקנים פנימיים כגון BPS, ABP או internal procedures. תמיכה בכך דורשת:

- organization-specific standards.
- owner.
- revision.
- approval workflow.
- access control.
- rights/legal review.
- traceability לכל auto-fill מבוסס תקן לקוח.

## 40. Units ו-Internationalization

ב-NDT/Aerospace טעות יחידות היא סיכון מקצועי.

נדרש להגדיר:

- metric/imperial.
- rounding policy.
- unit display בכל שדה ו-export.
- conversion validation.
- UI language roadmap.
- support matrix לדפדפנים ו-OS.

## 41. Calibration Traceability

כדי לתמוך ב-audit-ready calibration workflow נדרש לקשר:

- equipment serial number.
- calibration block serial.
- certificate file.
- calibration date.
- expiration date.
- approving person.
- validity at time of report generation.

## 42. Image / Evidence Handling

כאשר מעלים indications, C-scan images או A-scan evidence יש להגדיר:

- allowed formats.
- max size.
- original preservation.
- thumbnail generation.
- EXIF/metadata stripping.
- האם evidence נכלל ב-report hash.
- compression policy.

## 43. PLM/MES/QMS Integration

אינטגרציה למערכות כגון SAP, Teamcenter, Windchill או QMS פנימי היא יכולת enterprise עתידית. נדרש API יציב, mapping ל-work orders, part IDs, approval status ו-result pushback.

## 44. חיבור ל-CSI / רובוט ScanMaster - תמונת מצב

קיימת תשתית ראשונית לחיבור עתידי:

```text
Scan-Master -> CSI / ScanMaster control software -> UT scanner / robot / machine
```

עם זאת, אין להניח שהחיבור קיים בפועל עד לקבלת פורמט, פרוטוקול, דוגמאות קבצים, מגבלות מכונה ומודל בטיחות מ-ScanMaster.

## 45. רכיבים קיימים לטובת CSI

| רכיב | קובץ | מצב |
| --- | --- | --- |
| CSI exporter | `src/utils/exporters/csiExporter.ts` | XML skeleton ל-part, material, equipment, calibration, scan plan, OEM, kinematics ו-validation |
| Patch generator | `src/utils/patchGenerator.ts` | patches לפי geometry, coverage, overlap, probe footprint ומגבלות scanner |
| DAC/TCG calculator | `src/utils/dacCalculator.ts` | תשתית לחישובי DAC/TCG |
| OEM rule engine | `src/utils/oemRuleEngine.ts` | framework לחוקי OEM |
| Requirements form | `docs/michaels-plan/SCANMASTER_INTEGRATION_REQUIREMENTS.md` | שאלון בסיסי לאיסוף מידע |
| Full integration form | `docs/michaels-plan/ScanMaster_Integration_Form.html` | טופס רחב: פורמט, תקשורת, קואורדינטות, results, security |

## 46. מסך MCI/O Instrument מתוך המדריך

נמצא בריפו מדריך רשמי:

`standards/pdfs/MCIO Instrument Manual GB50010130.pdf`

המסך המרכזי נמצא ב-PDF page 15, manual page 3-13, תחת `The INSTRUMENT Window`.

לפי המדריך, חלון `INSTRUMENT` מציג A-scan signals ו-selected UT Setup parameters, כולל toolbar, status display, FSH display, A-scan display, gain slider, timebase axis, status bar ו-messages area.

![MCIO Instrument Window from ScanMaster manual](docs/assets/mcio-instrument-window-manual-page-15.png)

הערת גבול: המדריך מתאר את שכבת MCI/O Instrument ו-UT display. נדרש אישור האם אותה שכבה שולטת גם בתנועת robot/machine, או שיש CSI/PLC/motion controller נוסף.

## 47. System Boundary לחיבור

יש למפות את גבולות המערכת לפני תכנון אינטגרציה:

| שאלה | משמעות |
| --- | --- |
| מה שם התוכנה המדויק ששולטת בסריקה | CSI, MCI/O או מוצר אחר |
| האם אותה תוכנה שולטת גם ב-UT וגם ב-motion | קובע האם נדרש API אחד או כמה interfaces |
| האם יש PLC/motion controller נפרד | משפיע על safety, commands ו-axis mapping |
| האם נדרש file export בלבד או real-time commands | קובע רמת סיכון ומורכבות |
| מי מפעיל Run בפועל | operator בתוך CSI או מערכת חיצונית |

## 48. רמות אינטגרציה אפשריות

| רמה | זרימה | נדרש | סיכון |
| --- | --- | --- | --- |
| A - File Export | Scan-Master -> `.csi`/XML -> CSI Import -> operator runs scan | schema, sample setup files, import rules | נמוך |
| B - Watch Folder | Scan-Master כותב קובץ לתיקייה, CSI טוען אוטומטית | folder convention, file lock, naming, status | בינוני |
| C - CSI API/SDK | Scan-Master שולח setup דרך API | API docs, auth, errors, versioning | בינוני |
| D - Results Loop | setup החוצה, results חזרה לדוח | result schema, export formats, indication list | בינוני |
| E - Direct Robot Control | Scan-Master שולח motion/scan commands | PLC/motion protocol, safety, simulation, approvals | גבוה |

מסלול מומלץ ל-pilot הוא A או B. שליטה ישירה בזמן אמת צריכה להגיע רק לאחר safety review ו-dry-run מוכח.

## 49. מידע נדרש על פורמט CSI / Setup File

| מידע | סיבה |
| --- | --- |
| file extension | `.csi`, `.xml`, `.prg`, `.stp`, binary או אחר |
| schema/spec | שמות שדות, סדר, types, enums, required/optional |
| empty template | בסיס ל-exporter תקין |
| completed setup sample | השוואה מול setup שעובד במכונה |
| failed setup sample | הבנת validation/errors |
| units | mm/inch, MHz, dB, us, %, rpm, mm/s |
| encoding | UTF-8, ASCII, Windows-1252 |
| decimal format | נקודה/פסיק, precision, rounding |
| allowed ranges | gain, PRF, speed, gates, water path |
| import validation | success/warning/error reporting |

## 50. מידע נדרש על תקשורת/API

| תחום | מידע נדרש |
| --- | --- |
| Connection method | manual import, watch folder, TCP/IP, serial RS-232/485, OPC-UA, SDK/API |
| TCP/IP | IP, port, protocol, message framing, timeout, retry, ACK/NAK |
| Serial | COM port, baud rate, parity, stop bits, flow control |
| OPC-UA | endpoint, node IDs, namespace, certificates, write permissions |
| API/SDK | docs, sample code, supported language, version compatibility |
| Authentication | none, user/pass, API key, certificate, Windows domain |
| Error handling | error codes, status endpoint, logs, recovery steps |
| Versioning | CSI versions supported and compatibility constraints |

## 51. מידע נדרש על המכונה/רובוט/צירים

| תחום | מידע נדרש |
| --- | --- |
| Axis count | X/Y/Z/C/rotary/tilt/water path |
| Origin | tank corner, fixture, part center או אחר |
| Positive directions | כיוון חיובי לכל ציר |
| Units | mm/inch, degrees/radians, rpm |
| Travel limits | X/Y/Z travel, rotary limits, forbidden zones |
| Speeds | max scan speed, index speed, rotation speed |
| Acceleration | max acceleration/deceleration, jerk limits |
| Homing | home, touch-off, probe alignment |
| Fixtures | rotary table, V-block, flat table, custom fixtures |
| Tank | length, width, depth, water path limits |
| Collision model | הגנות probe/part/fixture |

## 52. מידע נדרש על UT Acquisition

| תחום | שדות נדרשים |
| --- | --- |
| Channels | channel count, active/visible channels, names |
| Transducer | model, frequency, diameter, focus, serial, element count |
| Pulser/Receiver | damping, voltage/amplitude, filter, receiver mode |
| Timebase | delay, range, samples, units, depth mode |
| Material | velocity, attenuation, acoustic mode |
| Gates | start, width, threshold, alarm logic |
| Gain | total gain, receiver gain, DAC/TCG points |
| PRF/Sampling | PRF, sample rate, dwell time |
| Water path | nominal path, tolerance, couplant/water settings |
| Calibration | block type, serial, FBH table, DAC/TCG, target amplitude |

## 53. Operator Workflow

יש למפות את ה-workflow הקיים של CSI/MCI/O:

- Global Setup מול Channel Setup.
- tabs נדרשים: Timebase, Zoom/Trig, Pulser, Gain, Receiver, Display, Gates, TCG, Files, Global, IO.
- import behavior: החלפת setup קיים או יצירת setup חדש.
- save/load נפרד ל-Global Setup, Channel Setup, Gate Setup, TCG Setup ו-Logic Setup.
- default setup שממנו מתחילים.
- approval לפני Run.
- הרשאות operator / Level II / Level III.

## 54. Results Import

| Output מ-CSI | מידע נדרש |
| --- | --- |
| C-scan image | PNG/BMP/TIFF, resolution, color scale, units |
| C-scan raw data | CSV/binary, grid size, axis mapping, amplitude/TOF |
| A-scan waveforms | format, sample rate, channel mapping |
| Indication list | position, amplitude, TOF, size, gate, channel |
| CSI report | PDF/HTML, metadata, signature/status |
| Logs | machine state, alarms, operator actions |
| Auto-export | האם ניתן לייצא אוטומטית בסיום scan |

כאשר results חוזרים למערכת, ניתן לסגור loop מלא: setup -> scan -> evidence -> inspection report -> audit trail.

## 55. Safety, Validation ו-Dry-Run

שליטה במכונה פיזית היא safety-critical. הדרישות לפני כל direct control:

- simulation/dry-run לטעינת setup בלי תנועה.
- validate setup command.
- speed/acceleration limits enforced by CSI/controller.
- forbidden zones/collision zones.
- emergency stop behavior.
- interlocks למכסה, מים, fixture, probe, rotary table.
- approval לפני run.
- audit log לטעינת setup והרצה.

## 56. Pilot Acceptance Criteria

| שלב | הצלחה נמדדת ב- |
| --- | --- |
| Sample import | קובץ מ-Scan-Master נטען ל-CSI ללא error |
| Parameter match | ערכי part/equipment/gates/gain/speed זהים ל-setup ידני |
| Dry-run | CSI מאשר setup ללא תנועה |
| Manual run | operator מריץ scan מתוך CSI עם setup שנוצר במערכת |
| Results import | C-scan/indications חוזרים לדוח |
| Traceability | report מציג setup id, CSI version, file hash ו-operator |

## 57. ערך עסקי וטכני של חיבור ל-CSI

| יתרון | ערך |
| --- | --- |
| פחות הקלדה ידנית | הפחתת טעויות בהעברת פרמטרים מה-techsheet ל-CSI |
| setup מהיר יותר | מעבר מתהליך ידני לתהליך חצי-אוטומטי |
| עקיבות מלאה | תקן/OEM -> technique sheet -> CSI setup -> scan results -> report |
| pre-flight validation | זיהוי בעיות לפני תנועת מכונה |
| coverage planning | patches, overlap, scan index ו-estimated time מתוך גאומטריה |
| שימוש ב-CSI הקיים | הזנת תוכנת השליטה הקיימת במקום החלפתה |
| MRO/production packs | setup, techsheet, inspection plan ו-report template בחבילה אחת |
| audit readiness | operator, CSI version, setup hash ותוצאות בדוח |
| feedback loop | דוח מבוסס evidence ולא copy-paste |
| scale | יכולת לשכפל תהליך לחלקים, לקוחות ותקנים שונים |

## 58. רשימת בקשות טכניות ל-ScanMaster

1. CSI software version/build ו-product name מדויק.
2. דוגמת setup file אמיתי שעובד במכונה.
3. empty setup template.
4. schema/spec של קובץ setup או API.
5. תיעוד import/export workflow.
6. רשימת required fields עם units ו-valid ranges.
7. דוגמת scan results export: C-scan, A-scan, indication list, report.
8. machine axis map: origin, positive directions, travel limits, speed/acceleration.
9. tank/fixture/rotary table dimensions and limits.
10. gate/TCG/DAC setup examples.
11. error code documentation.
12. dry-run/simulation mode documentation.
13. API/SDK/OPC-UA/TCP/serial capability statement.
14. authentication/network/firewall requirements.
15. אנשי קשר טכניים ל-CSI, מכונה, בטיחות ו-NDT validation.

## 59. נקודות חוזק

- פתרון בעיית דומיין אמיתית ולא רק UI כללי.
- תמיכה במצבי עבודה מרכזיים של NDT: setup, equipment, calibration, scan parameters, acceptance, documentation.
- בדיקות יחידה רבות לליבת חישובים ודאטה.
- יכולת Electron/offline המתאימה למפעלים וסביבות מוגבלות רשת.
- schema מסודר ל-organizations, profiles, technique sheets, standards, equipment ו-licenses.
- תשתית release/licensing/update קיימת.
- הפרדה יחסית ברורה בין UI, hooks, services, server, shared schema ו-Electron.
- בסיס ראשוני לאינטגרציה עתידית עם CSI.

## 60. פערים ידועים

| תחום | פער |
| --- | --- |
| Auth | Express auth עדיין dev/mock |
| License enforcement | web standard locking אינו enforced end-to-end |
| Payments | Express checkout mock מול Supabase checkout אמיתי |
| Update server | demo/local ולא production hardened |
| Dependencies | vulnerabilities דורשות upgrade |
| Lint | קיימים errors/warnings ו-`@ts-nocheck` |
| Electron | CSP רחב, sandbox כבוי, installer לא חתום |
| Legal/privacy | נדרש review ל-standards PDFs, EULA, privacy ו-data retention |
| Audit trail | אין immutable audit trail מלא לדוחות חתומים |
| Standards versioning | נדרש revision snapshot מלא |
| CSI integration | תלוי ב-schema/protocol/sample files/machine limits מ-ScanMaster |

## 61. תוכנית סגירה מומלצת

| עדיפות | פעולה |
| --- | --- |
| P0 | החלפת dev/mock auth ב-JWT middleware |
| P0 | ניקוי secrets/archive ו-rotation ל-download gate |
| P0 | dependency upgrades קריטיים עם regression |
| P0 | בחירת checkout canonical והקשחת webhook signature |
| P0 | report lock, hash, revision ו-audit events |
| P0 | standards revision snapshot בכל sheet/report |
| P1 | update-server auth, persistent DB ו-audit log |
| P1 | code signing ל-Windows installer |
| P1 | Electron CSP/sandbox/protocol hardening |
| P1 | backup/restore policy ו-restore test |
| P1 | API inventory/OpenAPI |
| P1 | CSI file import pilot לפני direct control |
| P2 | E2E/API/security regression |
| P2 | PLM/MES/QMS integration roadmap |

## 62. מפת קבצים לשאלות המשך

| תחום | קבצים |
| --- | --- |
| טכנולוגיות/scripts | `package.json` |
| UI ראשי | `src/pages/Index.tsx`, `src/App.tsx` |
| Auth frontend | `src/hooks/useAuth.tsx` |
| Supabase client | `src/integrations/supabase/client.ts` |
| API backend | `server/index.ts`, `server/routes.ts` |
| DB schema | `shared/schema.ts` |
| Multi-tenant checks | `server/storage.ts` |
| Security middleware | `server/middleware/security.ts`, `server/middleware/rateLimiter.ts` |
| Electron | `electron/main.cjs`, `electron/preload.cjs` |
| License | `electron/license-manager.cjs`, `scripts/license-generator.cjs` |
| Offline updater | `electron/offline-updater.cjs` |
| Update server | `update-server/index.js` |
| Payments | `supabase/functions/create-lemon-squeezy-checkout/index.ts`, `supabase/functions/lemon-squeezy-webhook/index.ts` |
| CSI exporter | `src/utils/exporters/csiExporter.ts` |
| Patch generation | `src/utils/patchGenerator.ts` |
| OEM rules | `src/utils/oemRuleEngine.ts` |
| DAC/TCG | `src/utils/dacCalculator.ts` |
| CSI requirements | `docs/michaels-plan/*` |
| MCI/O manual | `standards/pdfs/MCIO Instrument Manual GB50010130.pdf` |
| Tests | `src/utils/__tests__/*`, `src/data/__tests__/*` |

## 63. מקורות רשמיים ורפרנסים

| נושא | מקור |
| --- | --- |
| Nadcap accreditation ו-NDT | PRI Nadcap accreditation: `https://www.p-r-i.org/nadcap/accreditation?lang=en` |
| AS9100 | IAQG 9100 QMS requirements: `https://iaqg.org/standard/9100-qms-requirements-for-aviation-space-and-defense-organizations/` |
| NAS 410 | AIA NAS410 Revision 6 release note: `https://www.aia-aerospace.org/news/aia-and-accuris-release-nas410-revision-6-advancing-aerospace-safety-and-workforce-development/` |
| 21 CFR Part 11 | eCFR Part 11: `https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11` |
| Supabase regions | Supabase regions docs: `https://supabase.com/docs/guides/platform/regions` |
| Supabase backups/PITR | Supabase backups docs: `https://supabase.com/docs/guides/platform/backups` |

## 64. סטטוס מסמך

| פריט | סטטוס |
| --- | --- |
| סוג מסמך | ספר מידע טכני וארכיטקטוני |
| שפה | עברית |
| כולל תמונת MCI/O | כן, מתוך `MCIO Instrument Manual GB50010130.pdf` |
| כולל קוד גישה download gate | לא |
| מתאים להדפסה/שיתוף מקצועי | כן, בכפוף לכך שהוא מתאר גם פערים ידועים ודרישות hardening |
