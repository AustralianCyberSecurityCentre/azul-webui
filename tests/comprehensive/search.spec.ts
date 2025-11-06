import { expect } from "@playwright/test";
import { OPENSEARCH_TIMEOUT, openTab, test } from "../helpers";

test("Test Hash Search", async ({ page, binary }) => {
  // We have an uploaded binary (in 'binary'); search for it!
  await page.goto("/pages/home");
  await openTab(page, "Binaries", "Explore");

  await page
    .getByRole("textbox", { name: "Search binary metadata" })
    .fill(binary.sha256);

  await page.getByRole("button", { name: "Search" }).click();

  await expect(
    page.getByText(
      /Displaying 1 of (([0-9,]+)|\?) binaries matching the search parameters\./,
    ),
  ).toBeVisible({
    timeout: OPENSEARCH_TIMEOUT,
  });
});

test("Test Complex Search", async ({ page }) => {
  await page.goto("/pages/home");
  await openTab(page, "Binaries", "Explore");

  await page
    .getByRole("textbox", { name: "Search binary metadata" })
    .fill('entity.file_format:"python/bytecode"');

  await page.getByRole("button", { name: "Search" }).click();

  await expect(
    page.getByText(
      /Displaying [0-9,]+ of [.0-9,]+ binaries matching the search parameters./,
    ),
  ).toBeVisible({ timeout: OPENSEARCH_TIMEOUT });
});
