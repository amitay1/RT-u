# Project Structure

ScanMaster is organized as a full-stack desktop/web application for ultrasonic NDT technique sheets, reports, standards compliance, CAD/STEP generation, and licensing.

## Root

The repository root is reserved for entrypoint files and toolchain configuration:

- `README.md`, `LICENSE.txt`, `CLAUDE.md`, `QUICK_CONTEXT.md`
- `package.json`, lockfiles, TypeScript/Vite/Vitest/Tailwind/ESLint config
- Docker, serverless, Electron Builder, nginx, Replit, and environment templates

Project documentation, references, generated diagnostics, old work files, and helper scripts should live in the folders below instead of the root.

## Main Folders

| Path | Purpose |
| --- | --- |
| `src/` | React application, UI components, hooks, services, utilities, and frontend types. |
| `server/` | Express API, middleware, routes, storage, migrations, and server logging. |
| `shared/` | Shared schema and contract files used by frontend and backend. |
| `electron/` | Desktop shell, preload bridge, offline updater, and license manager. |
| `drawing-engine/` | Python CAD and drawing engine for geometry, STEP, and drawing generation. |
| `standards/` | Source and processed NDT standard references used by rules and validation. |
| `public/` | Static assets served by Vite/Electron, including standards, documents, icons, and splash assets. |
| `docs/` | Product, technical, deployment, licensing, reference, and archived documentation. |
| `scripts/` | Release, deployment, PDF, licensing, debug, and maintenance scripts. |
| `database/` | SQL schema and seed/reference data. |
| `supabase/` | Supabase config, migrations, and edge functions. |
| `tests/` | Test fixtures and API/CAD test scripts. |
| `update-server/` | Standalone update server and admin page. |
| `marketing/` | Presentation, audit, license demo, and marketing media assets. |
| `legal/` | EULA, privacy policy, and terms templates. |
| `vendor/` | Third-party package archives kept for reproducibility. |

## Runtime And Generated Folders

These folders are expected to exist locally and should not be treated as source structure:

- `node_modules/`, `dist/`, `release/`, `release-build/`
- `logs/`, `tmp/`, `output/`, `data/`
- `cad-engine-jobs/`, `cad-3d-output/`
- `licenses/` when generated locally by the license generator

Old release folders are archived under `release/archive/`.

## Documentation Areas

| Path | Purpose |
| --- | --- |
| `docs/licensing/` | Licensing, update-server, and production licensing deployment docs. |
| `docs/project/` | Project scans, implementation notes, and planning documentation. |
| `docs/reference/` | Source PDFs/DOCX/reference files that are not app-served public assets. |
| `docs/inbox/` | Unprocessed customer/reference files that previously lived in `ToDo/`. |
| `docs/archive/` | Old diagnostics, exported cards, uploaded archives, attached assets, and historical agent cwd markers. |
| `docs/setup/` | Setup and integration guides. |
| `docs/release/` | Release notes and update-fix notes. |
