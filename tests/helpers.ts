import { test as base, errors, expect, Page } from "@playwright/test";
import { BlobReader, BlobWriter, ZipWriter } from "@zip.js/zip.js";
import { createHash, randomUUID } from "crypto";
import { encode } from "upng-js";

export const OPENSEARCH_TIMEOUT = 15000;
export const PLUGIN_TIMEOUT = 90000;
export const PURGE_TIMEOUT = 60000;
const UPLOAD_TIMEOUT = 15000;

/**
 * Generates a filename with the given extension.
 */
export function generateFileName(extension: string): string {
  return randomUUID() + "." + extension;
}

/**
 * Generates a random JSON file.
 */
export function generateTextFile(): ArrayBuffer {
  const object = {};

  for (let i = 0; i < 5; i++) {
    object[randomUUID()] = randomUUID();
  }

  const jsonDoc = JSON.stringify(object);
  const encoder = new TextEncoder();

  return encoder.encode(jsonDoc);
}

/**
 * Generates a random PNG.
 */
export function generatePNG(): ArrayBuffer {
  // Generate a test PNG
  const IMAGE_WIDTH = 128;
  const IMAGE_HEIGHT = 128;
  const IMAGE_PITCH = 4; // rgba

  const buffer = new Uint8Array(IMAGE_WIDTH * IMAGE_HEIGHT * IMAGE_PITCH);
  for (let y = 0; y < IMAGE_HEIGHT; y++) {
    for (let x = 0; x < IMAGE_WIDTH; x++) {
      const idx = (IMAGE_WIDTH * y + x) * IMAGE_PITCH;

      // Rainbow!
      buffer[idx] = Math.floor(Math.random() * 0xff);
      buffer[idx + 1] = Math.floor(Math.random() * 0xff);
      buffer[idx + 2] = Math.floor(Math.random() * 0xff);
      buffer[idx + 3] = 0xff;
    }
  }

  return encode([buffer.buffer], IMAGE_WIDTH, IMAGE_HEIGHT, 0);
}

/**
 * Generates a .zip containing some number of .json files.
 *
 * @param count The number of JSON files to include.
 * @param password A password for the .zip (optional).
 */
export async function generateZipOfTextFiles(
  count: number = 1,
  password?: string | undefined,
): Promise<ArrayBuffer> {
  const zipFileWriter = new BlobWriter();
  const zipWriter = new ZipWriter(zipFileWriter, { password: password });

  for (let i = 0; i < count; i++) {
    const fileName = generateFileName("json");
    const file = generateTextFile();

    const blobReader = new BlobReader(new Blob([file]));
    await zipWriter.add(fileName, blobReader);
  }

  await zipWriter.close();
  const blobData = await zipFileWriter.getData();

  return await blobData.arrayBuffer();
}

/**
 * Opens a top level tab.
 */
export async function openTab(
  page: Page,
  dropdownName: string,
  entryName: string,
) {
  // Hovering is unreliable, select the hover element in the dropdown and rip it open
  // This is likely needed because Firefox doesn't set cursor capabilities in headless modes
  const dropdownParentElem = page.locator(".group", {
    has: page.getByRole("tab", { name: dropdownName }),
  });

  await expect(dropdownParentElem).toBeVisible();

  const dropdownElem = dropdownParentElem.locator(
    ".group-hover\\:block.border",
  );

  const entry = page.getByRole("tab", { name: entryName });

  // Continual retry to wait for page to settle.
  while (true) {
    await dropdownElem.evaluate((node) => {
      console.log(node.classList);
      node.classList.remove("hidden");
    });

    await page.waitForTimeout(100);

    try {
      await entry.click({ position: { x: 10, y: 10 }, timeout: 1000 });
      break;
    } catch (e) {
      if (e instanceof errors.TimeoutError) {
        continue;
      } else {
        throw e;
      }
    }
  }

  // Unselect the tab menu
  while (true) {
    await dropdownElem.evaluate((node) => node.classList.add("hidden"));
    await page.waitForTimeout(100);
    if (entry.isHidden()) {
      break;
    }
  }
}

interface UploadParams {
  page: Page;

  fileName: string;
  file: ArrayBuffer;
  mimeType: string;

  batchSubmission?: boolean;
  batchSubmissionPassword?: string;

  navigateToBinary: boolean;
}

/**
 * Finishes uploading a binary when already on the upload binary page. This can be
 * used in conjunction with custom parameters or uploading child binaries.
 */
export async function uploadFileExistingUploadPage({
  page,
  fileName,
  file,
  mimeType,
  batchSubmission,
  batchSubmissionPassword,
  navigateToBinary,
}: UploadParams) {
  // Select a file to upload
  const fileChooserPromise = page.waitForEvent("filechooser");
  const uploadButton = page.getByRole("button", {
    name: "Upload",
    exact: true,
  });
  await uploadButton.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    {
      name: fileName,
      mimeType: mimeType,
      buffer: Buffer.from(file),
    },
  ]);

  if (batchSubmission) {
    await page
      .getByRole("row", { name: "Batch submission" })
      .getByRole("checkbox")
      .check();
    await page
      .getByRole("button", { name: "This archive is trusted, continue." })
      .click();

    if (batchSubmissionPassword !== undefined) {
      await page
        .getByRole("row", { name: "Batch submission archive password" })
        .getByRole("textbox")
        .fill(batchSubmissionPassword);
    }
  }

  // Select the security label desired
  const securityLabelSelector = page
    .locator("azco-security-picker")
    .getByRole("combobox");
  await securityLabelSelector.scrollIntoViewIfNeeded();
  // index 0 = select message, index 1 = first valid security label
  await securityLabelSelector.selectOption({ index: 1 });

  // Proceed to upload
  await page
    .getByRole("button", { name: "I confirm that all files are" })
    .click();
  await page.getByRole("button", { name: "Upload all files at" }).click();

  if (batchSubmission) {
    const linkSelector = page
      .getByRole("button", { name: "View Submission" })
      .first();
    await expect(linkSelector).toBeVisible({ timeout: UPLOAD_TIMEOUT });

    if (navigateToBinary) {
      await linkSelector.click();
      await page.waitForLoadState();

      // Pick the first binary avaialble
      const binaryLink = page
        .getByRole("table")
        .locator("div")
        .getByRole("link")
        .first();

      await binaryLink.click();
      await page.waitForLoadState();
    }
  } else {
    // Wait for the file to upload
    const linkSelector = page
      .getByRole("link", { name: "View Entity" })
      .first();
    await expect(linkSelector).toBeVisible({ timeout: UPLOAD_TIMEOUT });

    if (navigateToBinary) {
      // The link opens in a new tab - avoid this for the purposes of this test
      await linkSelector.evaluate((el) => el.removeAttribute("target"));
      await linkSelector.click();

      await page.waitForLoadState();

      await expect(
        page.getByRole("cell", { name: mimeType, exact: true }).first(),
      ).toBeVisible({ timeout: OPENSEARCH_TIMEOUT });
    }
  }
}

export interface AzulBinary {
  fileName: string;
  sha256: string;
}

/**
 * Uploads a binary to Azul and navigates to that binary's page.
 */
export async function uploadBinary(params: UploadParams): Promise<AzulBinary> {
  const { page, fileName, file } = params;
  const hash = createHash("sha256").update(new Int8Array(file)).digest("hex");

  // Navigate to the file upload page
  await page.goto("/pages/home");

  // Open binary explore (first the menu then the specific item.)
  await openTab(page, "Binaries", "Upload");

  await expect(
    page.getByText(
      "The source information of uploaded files represents the 'where/when/why' of the files. ",
    ),
  ).toBeVisible();

  // Select the "testing" source
  const sourceBox = page.locator("az-loading-content").getByRole("combobox");

  await sourceBox.selectOption("testing");

  await uploadFileExistingUploadPage(params);

  return {
    fileName: fileName,
    sha256: hash,
  };
}

/**
 * Shortcut to upload a JSON file.
 */
export function uploadTextFile(page: Page): Promise<AzulBinary> {
  const fileName = generateFileName("json");
  const fileBuffer = generateTextFile();
  return uploadBinary({
    page,
    fileName,
    file: fileBuffer,
    mimeType: "application/json",
    navigateToBinary: true,
  });
}

/**
 * Test fixture that enables including a random binary for a given test.
 */
export const test = base.extend<{ binary: AzulBinary }>({
  binary: async ({ page }, use) => {
    const binary = await uploadTextFile(page);
    await use(binary);
  },
});
