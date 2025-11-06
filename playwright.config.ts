import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

const rawComprehensive =
  process.env.COMPREHENSIVE?.toLowerCase() ?? "undefined";
const rawCi = process.env.CI?.toLowerCase() ?? "undefined";
const rawDevCi = process.env.CI_DEV?.toLowerCase() ?? "undefined";

console.log(
  "COMPREHENSIVE = %s, CI = %s, CI_DEV = %s",
  rawComprehensive,
  rawCi,
  rawDevCi,
);

const comprehensive = rawComprehensive === "true";
const ci = rawCi === "true";
const devCi = rawDevCi === "true";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  outputDir: "test-results",
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: ci,
  /* Retry on CI only */
  retries: ci ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: ci ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // Use junit in CI and html outside of CI.
  reporter: ci
    ? [["junit", { outputFile: "test-results/e2e-junit-results.xml" }]]
    : "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:4200",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for just firefox and chrome */
  projects: [
    // Setup authentication for all other t
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // Load storage state from the output of auth.setup.ts
        storageState: "test-cache/.auth/user.json",
      },
      testIgnore: comprehensive ? undefined : "**/comprehensive/**",
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Load storage state from the output of auth.setup.ts
        storageState: "test-cache/.auth/user.json",
      },
      testIgnore: comprehensive ? undefined : "**/comprehensive/**",
      dependencies: ["setup"],
    },
    /* Test against branded browsers. */
    // {
    //   name: "Microsoft Edge",
    //   use: {
    //     ...devices["Desktop Edge"],
    //     channel: "msedge",
    //     // Load storage state from the output of auth.setup.ts
    //     storageState: "test-cache/.auth/user.json",
    //   },
    //   dependencies: ["setup"],
    // },
    // {
    //   name: "Google Chrome",
    //   use: {
    //     ...devices["Desktop Chrome"],
    //     channel: "chrome",
    //     // Load storage state from the output of auth.setup.ts
    //     storageState: "test-cache/.auth/user.json",
    //   },
    //   dependencies: ["setup"],
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // run dev if CI_DEV=true otherwise run against QA.
    command: devCi ? "npm run remote-dev" : "npm run remote",
    url: "http://localhost:4200",
    reuseExistingServer: !ci,
  },
});
