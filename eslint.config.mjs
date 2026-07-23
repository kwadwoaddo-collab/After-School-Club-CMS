import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.*/**", // Ignore all dot folders like another .next
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/*.js", // Ignore raw JS scripts
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/set-state-in-effect": "off",
      "no-console": "error"
    }
  },
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/__tests__/**",
      "src/lib/logger.ts",
      "scripts/**",
      "src/scripts/**",
      "tests/**",
      "scratch/**",
      "prev_bookings.tsx",
      "*.config.ts",
      "*.config.mjs",
      "**/*.mjs"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off"
    }
  }
]);

export default eslintConfig;
