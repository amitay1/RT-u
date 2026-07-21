import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", ".claude/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",

      // Dev stabilization: the codebase currently uses `any` in many places.
      // Treat as warning so lint stays actionable; tighten later once types are cleaned up.
      "@typescript-eslint/no-explicit-any": "warn",

      // Similar: keep lint useful without blocking local dev for broader refactors.
      "@typescript-eslint/no-unsafe-function-type": "warn",

      // Keep active legacy suppression visible while the RT/PT surface is stabilized.
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
);
