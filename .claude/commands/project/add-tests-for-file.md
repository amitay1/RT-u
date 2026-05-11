# Add or improve tests for a given source file

When this command is run with a file path argument, for example:

  /project:add-tests-for-file src/modules/techniqueSheet/generator.ts

do the following:

1. Inspect the source file and search the repo for existing tests:
   - Look for `*.test.ts`, `*.spec.ts` or a dedicated `__tests__` folder.
   - Inspect `package.json` to detect the configured test framework and scripts.
   - If there is no test script defined in `package.json`, DO NOT invent one silently.
     Instead:
     - Propose a test setup (framework, script name and command).
     - Ask for confirmation before modifying `package.json`.

2. Locate or create the matching test file:
   - Prefer the same directory pattern already used in the project
     (e.g. `__tests__` folders or `*.test.ts` in the same folder).

3. Design tests that focus on:
   - Correct handling of UT standards and acceptance classes.
   - Correct interpretation of geometry (OD/ID/thickness, scan directions, etc.).
   - Realistic edge cases based on docs in `standards/` and `docs/AUTO_FILL_DOCUMENTATION.md`.

4. Implement the tests:
   - Keep them deterministic and fast.
   - Only mock external services (DB, Supabase, network); avoid over-mocking.

5. If a test script exists in `package.json`, run it (for example `npm test` or `npm run test:unit`)
   and ensure it passes. If there is no script yet, explain clearly what needs to be run manually.

6. Show the new/updated test file as a diff and summarise what behaviours are now covered.
