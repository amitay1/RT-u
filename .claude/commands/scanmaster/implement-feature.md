# Implement a new Scan-Master feature end-to-end

When this command is run with a short feature description, do the following:

1. Read the feature description and search the repo for:
   - Relevant modules in `src/`, `server/`, `tasks/`, `drawing-engine/`.
   - Any mentions in `docs/ROADMAP.md`, `docs/AUTO_FILL_DOCUMENTATION.md`, `docs/TECHNIQUE_SHEET_ANALYSIS.md`
     or other UT/standard-related docs.

2. Propose a concrete implementation plan:
   - List the main steps.
   - List which files and directories will be changed.
   - Call out any risks to UT standards or geometry correctness.

3. Execute the plan in small batches:
   - First update types and shared domain models in `shared/` and `standards/` if needed.
   - Then implement backend logic (`server/`, `serverless/`, `tasks/`).
   - Then update frontend UI in `src/`.
   - Finally, update drawing logic in `drawing-engine/` or CAD jobs if the feature affects sketches.

4. After each batch:
   - Show diffs for all changed files.
   - Run lint using the appropriate command:
     - `npm run lint`, `pnpm lint` or `bun run lint` depending on the detected package manager.
   - Stop if tests or lint fail, and ask for clarification before proceeding.

5. At the end:
   - Ensure `npm run lint` (or equivalent) and `npm run build` succeed.
   - Update any relevant docs (README, ROADMAP, UT docs) to reflect the new feature.
   - Provide a short summary plus a checklist of what was changed.
