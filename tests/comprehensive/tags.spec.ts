import { Dialog, expect, Page } from "@playwright/test";
import { OPENSEARCH_TIMEOUT, openTab, test, uploadTextFile } from "../helpers";
import { randomUUID } from "crypto";

async function addTagToBinary(
  page: Page,
  tagName: string,
  expectedCount: number,
) {
  // Add UUID tag to current binary
  await page.getByRole("button", { name: "Add tag" }).click();

  const createButton = page.getByRole("button", { name: "Create" });
  await expect(createButton).toBeDisabled();

  await page.getByRole("textbox", { name: "my-tag-" }).fill(tagName);

  // Select the first valid classification
  await page.getByRole("combobox").selectOption({ index: 1 });

  await expect(createButton).toBeEnabled();
  await createButton.click();

  await expect(
    page.getByRole("button", { name: tagName + " (" + expectedCount + ")" }),
  ).toBeVisible({ timeout: OPENSEARCH_TIMEOUT });
}

async function acceptDialogHandler(dialog: Dialog) {
  await dialog.accept();
}

async function removeTag(page: Page, tagName: string) {
  page.on("dialog", acceptDialogHandler);

  await page.getByRole("button", { name: tagName }).click();

  await page.getByRole("button", { name: "Remove" }).click();

  // Wait for dialog to close
  await expect(page.getByText("Tag '" + tagName + "'")).toHaveCount(0, {
    timeout: OPENSEARCH_TIMEOUT,
  });
  await expect(page.getByRole("button", { name: tagName })).toHaveCount(0);

  page.off("dialog", acceptDialogHandler);
}

test("Test Linking Binaries", async ({ page, binary: _binary }) => {
  // This takes a while as we are waiting for OpenSearch to do stuff
  test.slow();

  const tagName = randomUUID().substring(0, 10);

  const firstBinaryPage = page.url();

  // Add the tag to the current binary
  await addTagToBinary(page, tagName, 1);

  // Upload new binary
  await test.step("Upload Second Binary", async () => {
    await uploadTextFile(page);
  });

  const secondBinaryPage = page.url();

  // Add the tag to the second binary
  await addTagToBinary(page, tagName, 2);

  // go to tags tab
  await openTab(page, "Binaries", "Tags");

  // Click the current tag
  await page.getByRole("button", { name: tagName }).click();

  await expect(page.getByText("Displaying 2 of")).toBeVisible({
    timeout: OPENSEARCH_TIMEOUT,
  });

  // remove both tags
  await page.goto(firstBinaryPage);
  await removeTag(page, tagName);

  await page.goto(secondBinaryPage);
  await removeTag(page, tagName);

  // should be gone from tags tab
  await openTab(page, "Binaries", "Tags");

  await expect(page.getByText("Your content is loading")).toHaveCount(0, {
    timeout: OPENSEARCH_TIMEOUT,
  });
  await expect(page.getByRole("button", { name: tagName })).toHaveCount(0, {
    timeout: OPENSEARCH_TIMEOUT,
  });
});
