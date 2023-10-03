/**
 * ESLint Configuration
 */
/** @type {import('eslint').ESLint.ConfigData} */
const config = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  parserOptions: {
    project: "./tsconfig.eslint.json",
  },
  env: { node: true, es2021: true },
  rules: {
    // custom
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
  },
};

module.exports = config;
