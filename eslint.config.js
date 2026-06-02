import next from "@next/eslint-plugin-next";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["**/node_modules/**", ".next/**", "dist/**", "out/**"],
  },
  // Next.js recommended + Core Web Vitals. Registering the plugin via its own
  // flat config is what lets `next build` detect it (silences the
  // "Next.js plugin was not detected" warning).
  next.flatConfig.coreWebVitals,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: process.cwd(),
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      // Cover images and avatars come from arbitrary remote hosts (Blossom,
      // external URLs) that next/image isn't configured to optimize, so plain
      // <img> is intentional throughout the nova components.
      "@next/next/no-img-element": "off",
    },
  },
];
