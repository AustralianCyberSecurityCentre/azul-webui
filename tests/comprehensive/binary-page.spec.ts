import { expect } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  generateFileName,
  generatePNG,
  OPENSEARCH_TIMEOUT,
  PLUGIN_TIMEOUT,
  test,
  uploadBinary,
} from "../helpers";

test("Test Data Tab", async ({ page }) => {
  // This takes a while to finish as this is dependent on plugins
  test.setTimeout(PLUGIN_TIMEOUT * 5);

  // We specifically need a PNG for this test
  await test.step("Upload PNG Binary", async () => {
    await uploadBinary({
      page,
      fileName: generateFileName("png"),
      file: generatePNG(),
      mimeType: "image/png",
      navigateToBinary: true,
    });
  });

  const safeImage = page.getByRole("img", { name: "Safe image to display." });

  // Switch to the data tab to wait for the ImageConvert plugin to be ready
  await page.getByRole("link", { name: "Data" }).click();

  let shouldReload = false;

  // Should eventually pass once the plugin is there:
  await expect(async () => {
    // Reload the page on the second iteration and after
    if (shouldReload) {
      await page.reload();
    }
    shouldReload = true;

    await expect(page.getByText("Views")).toBeVisible();

    // Wait for either the image preview tab OR the new results dialog
    const haveResults = page.getByText("Image Preview").first();
    const shouldRefresh = page.getByText(/new results/).first();

    await expect(haveResults.or(shouldRefresh)).toBeVisible({
      timeout: OPENSEARCH_TIMEOUT,
    });

    if (await haveResults.isVisible()) {
      // Ensure the tab is now open (should be automatic)
      await expect(safeImage).toBeVisible();
    } else {
      throw "Retry; new results found";
    }
  }).toPass();

  // Wait for the image to load
  await expect(safeImage).toHaveJSProperty("complete", true);
});

test("Test File Download", async ({ page, binary: _binary }) => {
  // Wait for the page to be ready
  await page.getByRole("link", { name: "Overview" }).click();

  // Download the parent file
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("main").getByRole("button").nth(1).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();

  // See what we downloaded
  const fileData = fs.readFileSync(downloadedPath);
  // 'CART'
  if (
    !(
      fileData[0] == 0x43 &&
      fileData[1] == 0x41 &&
      fileData[2] == 0x52 &&
      fileData[3] == 0x54
    )
  ) {
    throw "Downloaded something that wasn't a CaRT!";
  }

  await download.delete();
});

test("Test Features Tab", async ({ page, binary }) => {
  await page.getByRole("link", { name: "Features" }).click();

  // We should be able to filter for the filename which we specified before
  const filterBox = page.getByRole("textbox", { name: "Filter" });
  await filterBox.fill(binary.fileName);

  await expect(
    page.getByText(/Viewing 1 of [0-9,]+ feature values/),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: binary.fileName })).toBeVisible();

  // Remove the filter and it should be gone
  await filterBox.fill("");

  await expect(
    page.getByText(/Viewing [0-9,]+ of [0-9,]+ feature values/),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: binary.fileName })).toBeVisible();

  // Fill the box with content that we know won't be there
  await filterBox.fill(randomUUID());

  await expect(
    page.getByText(/Viewing 0 of [0-9,]+ feature values/),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: binary.fileName })).toHaveCount(
    0,
  );
});

test("Test Relations Tab", async ({ page, binary: _binary }) => {
  await page.getByRole("link", { name: "Relations" }).click();

  // This file should have been uploaded once
  await expect(page.getByRole("tab", { name: "testing 1 |" })).toBeVisible();
});

test("Test Status Tab", async ({ page, binary: _binary }) => {
  await page.getByRole("link", { name: "Status" }).click();

  await expect(page.getByRole("cell", { name: "Entropy" })).toBeVisible();
});

test("Test Debug Tab", async ({ page, binary: _binary }) => {
  await page.getByRole("button", { name: "User Settings" }).click();

  await page
    .locator("label")
    .filter({ hasText: "Show Debug Tab" })
    .locator("div")
    .click();

  await page
    .locator(".cdk-overlay-backdrop")
    .click({ position: { x: 0, y: 0 } });

  await page.getByRole("link", { name: "Debug" }).click();

  await page.getByRole("button", { name: "New Query Tab" }).click();

  await page.locator("#inputEventType").selectOption([{ label: "sourced" }]);

  await page.getByRole("button", { name: "Add" }).click();

  // This file should only ever be uploaded once
  await expect(page.getByText("sourced (1)")).toBeVisible();

  // Open the tab
  await page.getByLabel("sourced").click();

  // The VSCode view messes with this a bit because of syntax highlighting
  // Just check that there is a vscode view with more than one line of text (which
  // would indicate a valid value)
  await expect(page.locator(".view-line").nth(3)).toBeVisible();
});
