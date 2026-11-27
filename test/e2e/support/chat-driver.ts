import path from "node:path";
import { chromium, expect, test as base, type Page } from "@playwright/test";

/** Persistent profile, so the downloaded model stays in the browser cache. */
const profileDir = path.join(import.meta.dirname, "..", ".chrome-profile");

export const test = base.extend<object, { chatPage: Page }>({
  chatPage: [
    async ({}, use) => {
      const context = await chromium.launchPersistentContext(profileDir, {
        channel: "chrome",
        headless: false,
        baseURL: "http://localhost:3000",
        args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"],
      });
      const page = context.pages()[0] ?? (await context.newPage());
      await use(page);
      await context.close();
    },
    { scope: "worker" },
  ],
});

export { expect };

/** Opens the shop and waits until the model is downloaded and warmed up. */
export async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("chat")).toHaveAttribute(
    "data-model-ready",
    "true",
    {
      timeout: 5 * 60_000,
    },
  );
}

export interface ChatTurn {
  reply: string;
  /** Parsed "Recognised request" JSON, the raw text if it is not JSON, or null if missing. */
  request: unknown;
}

/** Sends one message and returns the agent's reply and recognised request. */
export async function send(page: Page, message: string): Promise<ChatTurn> {
  const answers = page.locator(
    '[data-testid="chat-entry"][data-role="assistant"]',
  );
  const before = await answers.count();
  await page.getByTestId("chat-input").fill(message);
  await page.getByTestId("chat-send").click();
  await expect(answers).toHaveCount(before + 1, { timeout: 2 * 60_000 });

  const answer = answers.nth(before);
  const reply =
    (await answer.locator("> p").first().textContent())?.trim() ?? "";
  const pre = answer.getByTestId("recognised-request");
  if ((await pre.count()) === 0) return { reply, request: null };
  const raw = (await pre.textContent()) ?? "";
  try {
    return { reply, request: JSON.parse(raw) };
  } catch {
    return { reply, request: raw };
  }
}
