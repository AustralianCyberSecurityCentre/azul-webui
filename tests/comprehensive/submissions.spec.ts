import { expect } from "@playwright/test";
import {
  generateFileName,
  generateTextFile,
  generateZipOfTextFiles,
  OPENSEARCH_TIMEOUT,
  openTab,
  PURGE_TIMEOUT,
  test,
  uploadBinary,
  uploadFileExistingUploadPage,
  uploadTextFile,
} from "../helpers";
import { randomUUID } from "crypto";

test("Test Uploading Zip", async ({ page }) => {
  const fileName = generateFileName("zip");
  const file = await generateZipOfTextFiles(3, undefined);

  await uploadBinary({
    page,
    fileName,
    file,
    mimeType: "application/zip",
    batchSubmission: true,
    navigateToBinary: true,
  });
});

test("Test Uploading Passworded Zip", async ({ page }) => {
  const password = randomUUID();

  const fileName = generateFileName("zip");
  const file = await generateZipOfTextFiles(3, password);

  await test.step("Upload Binary", async () => {
    await uploadBinary({
      page,
      fileName,
      file,
      mimeType: "application/zip",
      batchSubmission: true,
      batchSubmissionPassword: password,
      navigateToBinary: true,
    });
  });
});

test("Test Uploading Child", async ({ page, binary: _binary }) => {
  await page.getByRole("main").getByRole("button").nth(2).click();

  // Fill in the relationship value
  await page.getByRole("textbox", { name: "Field Value" }).fill("test action");

  const fileName = generateFileName("json");
  const file = generateTextFile();

  await test.step("Finish Uploading Binary", async () => {
    await uploadFileExistingUploadPage({
      page,
      fileName,
      file,
      mimeType: "application/json",
      navigateToBinary: true,
    });
  });
});

test("Test File With Limited Security", async ({ page }) => {
  await page.goto("/pages/home");

  // The security picker shouldn't be filtered by default:
  await expect(
    page.getByLabel("Max Security Picker").getByText("MAX:"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Max Security Picker" }).click();

  // Filter by the first valid security option
  await page.getByRole("listbox").first().selectOption({ index: 1 });
  await page.getByRole("button", { name: "Set", exact: true }).click();

  // The security picker should now have MAX in *
  await expect(
    page.getByLabel("Max Security Picker").getByText("*MAX*:"),
  ).toBeVisible();

  // Try to upload a file and see what happens!
  await uploadTextFile(page);
});

test("Test Purge Submission", async ({ page, binary }) => {
  // Purging takes a while!
  test.slow();

  await page.getByRole("link", { name: "Relations" }).click();
  // Purge just this submission
  await page.getByRole("link", { name: "Purge this submission from" }).click();

  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.getByText("Calculating damage")).toHaveCount(0, {
    timeout: PURGE_TIMEOUT,
  });

  const purgeButton = page.getByRole("button", { name: "Purge" });

  // The purge button should only get enabled after the confirm checkbox is checked
  await expect(purgeButton).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(purgeButton).toBeEnabled();

  await purgeButton.click();

  await expect(page.getByText("Opening the airlock")).toHaveCount(0, {
    timeout: PURGE_TIMEOUT,
  });

  await expect(page.getByText("Purge successfully completed")).toBeVisible();

  // See if we can now search for this binary
  await page.goto("/pages/home");
  await openTab(page, "Binaries", "Explore");

  await page
    .getByRole("textbox", { name: "Search binary metadata" })
    .fill(binary.sha256);

  await page.getByRole("button", { name: "Search" }).click();

  await expect(
    page.getByText("No binaries match the search criteria"),
  ).toBeVisible({
    timeout: OPENSEARCH_TIMEOUT,
  });
});
