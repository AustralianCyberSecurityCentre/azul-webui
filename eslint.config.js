// @ts-check

// Allows us to bring in the recommended core rules from eslint itself
const eslint = require("@eslint/js");

// Allows us to use the typed utility for our config, and to bring in the recommended rules for TypeScript projects from typescript-eslint
const tseslint = require("typescript-eslint");

// Allows us to bring in the recommended rules for Angular projects from angular-eslint
const angular = require("angular-eslint");

// Export our config array, which is composed together thanks to the typed utility function from typescript-eslint
module.exports = tseslint.config(
  {
    ignores: [".angular/**", "node_modules/**", "dist/**"],
  },
  {
    // Everything in this config object targets our TypeScript files (Components, Directives, Pipes etc)
    files: ["src/**/*.ts"],
    ignores: [
      "**/*.test.ts",
      "**/*.generated.ts",
      "frontend/generated/*",
      "eslint.config.js",
      "src/**/*.spec.ts",
      "tests/**/*",
    ],
    extends: [
      // Apply the recommended core rules
      eslint.configs.recommended,
      // Apply the recommended TypeScript rules
      ...tseslint.configs.recommended,
      // Optionally apply stylistic rules from typescript-eslint that improve code consistency
      ...tseslint.configs.stylistic,
      // Apply the recommended Angular rules
      ...angular.configs.tsRecommended,
    ],
    // IMPORTANT: Set the custom processor to enable inline template linting
    // This allows your inline Component templates to be extracted and linted with the same
    // rules as your external .html template files
    processor: angular.processInlineTemplates,
    // Override specific rules for TypeScript files (these will take priority over the extended configs above)
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: ["app", "flow", "az", "azco", "azec"],
          style: "camelCase",
        },
      ],
      // "@angular-eslint/component-selector": [
      //   "error",
      //   {
      //     type: "element",
      //     prefix: "app",
      //     style: "kebab-case",
      //   },
      // ],
      "@typescript-eslint/no-empty-function": "off",
      "@angular-eslint/component-selector": "off",
      "@angular-eslint/prefer-standalone": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/consistent-generic-constructors": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Everything in this config object targets our HTML files (both external template files,
    // AND inline templates thanks to the processor set in the TypeScript config above)
    files: ["**/*.html"],
    extends: [
      // Apply the recommended Angular template rules
      ...angular.configs.templateRecommended,
      // Apply the Angular template rules which focus on accessibility of our apps
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  },
);
