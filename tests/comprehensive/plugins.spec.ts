import { expect } from "@playwright/test";
import { OPENSEARCH_TIMEOUT, openTab, test } from "../helpers";

const UNBOX_FEATURE_COUNT = 24;

test("Test Unbox Plugin", async ({ page }) => {
  await page.goto("/pages/home");

  await openTab(page, "Plugins", "Explore");

  await expect(page.getByText("Your content is loading")).toHaveCount(0, {
    timeout: OPENSEARCH_TIMEOUT,
  });

  const unboxZipRow = page.locator('tr:has-text("Unbox-arj")');

  await expect(unboxZipRow).toBeVisible();

  await unboxZipRow.scrollIntoViewIfNeeded();

  // The unbox-arj plugin should have 24 features
  await expect(
    unboxZipRow
      .locator("td:nth-child(6)")
      .first()
      .getByText("" + UNBOX_FEATURE_COUNT, { exact: true }),
  ).toBeVisible();

  // See what features the plugin has
  await unboxZipRow.getByRole("link", { name: "Unbox-arj" }).click();
  await expect(page.getByText("Your content is loading")).toHaveCount(0, {
    timeout: OPENSEARCH_TIMEOUT,
  });

  await page
    .getByRole("link", { name: "View " + UNBOX_FEATURE_COUNT + " features" })
    .click();
  await expect(page.getByText("Your content is loading")).toHaveCount(0, {
    timeout: OPENSEARCH_TIMEOUT,
  });

  await expect(page.getByText("box_password")).toBeVisible();
});
