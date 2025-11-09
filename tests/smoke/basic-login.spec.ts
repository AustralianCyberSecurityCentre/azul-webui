import { expect, test } from "@playwright/test";
import { openTab } from "../helpers";

test("Has Title", async ({ page }) => {
  /* Check the title is correct, this works regardless of auth status. */
  await page.goto("/pages/home");
  // Expect a title "to contain" the word Azul.
  await expect(page).toHaveTitle(/Azul/);
});

test("Navigate To Explore", async ({ page }) => {
  /*Navigate from the home page to binary explore (auth required.)*/
  await page.goto("/pages/home");

  // Click the get started link.
  await expect(
    page.getByText("Discover, analyse and correlate malware at scale."),
  ).toBeVisible({timeout: 10000});

  // Open binary explore (first the menu then the specific item.)
  await openTab(page, "Binaries", "Explore");

  // Verify we've navigated to the binary explore page.
  await expect(page.getByText("Binary Explorer")).toBeVisible();
  // Example taking screenshot.
  await page.screenshot({ path: "test-results/binary-explore-pg.png" });
});

test("Verify LocalStorage", async ({ page }) => {
  /*Verify local storage is working as expected.*/
  const storageState = await page.context().storageState();
  const localStorageArray = storageState.origins[0].localStorage;

  // Just verifying there is at least one value present in local storage.
  console.log(storageState.origins[0].localStorage[0]);
  expect(localStorageArray.length).toBeGreaterThan(0);
  expect(localStorageArray[0].name.length).toBeGreaterThan(0);
  expect(localStorageArray[0].value.length).toBeGreaterThan(0);
});
