import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { build } from "esbuild";
import { chromium } from "playwright-core";

import type { Turn } from "./browser";
import { loadScenarios, type ShopRequest } from "./scenarios";

const origin = "http://127.0.0.1:3005";
const evalPage = `${origin}/__shopping_eval`;
const bundleUrl = `${evalPage}.js`;
const normalTimeout = 120_000;
const downloadTimeout = 900_000;

interface CaseResult {
  id: string;
  group: string;
  prompts: string[];
  passed: boolean;
  failure?: string;
  durationMs: number;
  requests: ShopRequest[];
  turns: Turn[];
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requestInput(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return;
  const envelope: unknown = JSON.parse(raw);
  if (typeof envelope !== "object" || envelope === null || !("json" in envelope)) return;
  const input = envelope.json;
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
}

function isModelAsset(url: URL) {
  return (url.origin === "https://huggingface.co" && url.pathname.startsWith("/mlc-ai/")) ||
    (url.origin === "https://raw.githubusercontent.com" &&
      url.pathname.startsWith("/mlc-ai/binary-mlc-llm-libs/"));
}

async function withDeadline<T>(operation: Promise<T>, timeout: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Browser evaluation timed out.")), timeout);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const { values } = parseArgs({ options: {
    filter: { type: "string" },
    profile: { type: "string", default: ".webllm-eval/chrome" },
    report: { type: "string", default: ".webllm-eval/results.json" },
    "download-model": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  } });
  if (values.help) {
    console.log("Usage: pnpm eval:shopping [--filter TEXT] [--profile DIR] [--report FILE] [--download-model]");
    return;
  }

  const reportPath = resolve(values.report);
  const profile = resolve(values.profile);
  const { scenarios, fixtures } = await loadScenarios(origin).catch((error: unknown) => {
    throw new Error(`Could not prepare the seeded catalog at ${origin}. ${messageOf(error)}`);
  });
  const selected = scenarios.filter(({ id }) => !values.filter || id.includes(values.filter));
  if (!selected.length) throw new Error(`No scenario ID contains ${JSON.stringify(values.filter)}.`);

  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(new URL("./browser.ts", import.meta.url))],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const browserBundle = outputFiles[0].text;
  await mkdir(dirname(reportPath), { recursive: true });
  await mkdir(profile, { recursive: true });
  const report = {
    origin,
    fixtures,
    startedAt: new Date().toISOString(),
    finishedAt: undefined as string | undefined,
    infrastructureError: undefined as string | undefined,
    blockedRequests: [] as string[],
    selectedScenarios: selected.map(({ id }) => id),
    cases: [] as CaseResult[],
  };
  const blocked = new Set<string>();
  const save = async () => {
    report.blockedRequests = [...blocked];
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  };

  try {
    const browser = await chromium.launchPersistentContext(profile, {
      channel: "chrome",
      headless: true,
      args: ["--enable-unsafe-webgpu"],
      serviceWorkers: "block",
    });
    try {
      await browser.route("**/*", (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        if (url.href === evalPage) {
          return route.fulfill({ contentType: "text/html", body: '<!doctype html><meta charset="utf-8"><script src="/__shopping_eval.js"></script>' });
        }
        if (url.href === bundleUrl) return route.fulfill({ contentType: "text/javascript", body: browserBundle });
        if (url.origin === origin && url.pathname.startsWith("/api/trpc/") &&
          (method === "GET" || (method === "POST" && url.pathname === "/api/trpc/cart.validate"))) {
          return route.continue();
        }
        if (values["download-model"] && (method === "GET" || method === "HEAD") && isModelAsset(url)) {
          return route.continue();
        }
        blocked.add(`${method} ${url.origin}${url.pathname}`);
        return route.abort();
      });

      const page = browser.pages()[0] ?? await browser.newPage();
      let pageErrors: string[] = [];
      let requests: ShopRequest[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin !== origin || !url.pathname.startsWith("/api/trpc/")) return;
        const request = response.request();
        let input: ShopRequest["input"];
        try {
          input = requestInput(url.searchParams.get("input") ?? request.postData());
        } catch (error) {
          pageErrors.push(`Could not read shop request input. ${messageOf(error)}`);
        }
        requests.push({ endpoint: url.pathname.slice("/api/trpc/".length), method: request.method(), status: response.status(), input });
      });
      await page.goto(evalPage, { timeout: 20_000 });
      await page.waitForFunction(() => typeof window.runShoppingConversation === "function", undefined, { timeout: 10_000 });
      const webGpuAvailable = await withDeadline(page.evaluate(async () => {
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<object | null> } }).gpu;
        return Boolean(await gpu?.requestAdapter());
      }), 10_000);
      if (!webGpuAvailable) throw new Error("Headless Chrome did not find a WebGPU adapter.");

      for (const { id, group, prompts, check } of selected) {
        requests = [];
        pageErrors = [];
        const started = performance.now();
        const timeoutMs = values["download-model"] && !report.cases.length ? downloadTimeout : normalTimeout;
        const turns = await withDeadline(page.evaluate(({ prompts, timeoutMs }) =>
          window.runShoppingConversation(prompts, timeoutMs), { prompts, timeoutMs }), prompts.length * timeoutMs + 5_000);
        const failure = pageErrors[0] ?? turns.flatMap(({ errors }) => errors)[0] ?? check(turns, requests);
        const result = {
          id, group, prompts, passed: failure === undefined, failure,
          durationMs: Math.round(performance.now() - started), requests, turns,
        };
        report.cases.push(result);
        await save();
        console.log(`${result.passed ? "PASS" : "FAIL"} ${id} (${(result.durationMs / 1000).toFixed(1)}s)${failure ? ` ${failure}` : ""}`);
        if (failure?.includes("The local model could not load")) {
          throw new Error("Chrome could not load the model. Check WebGPU support or run once with --download-model.");
        }
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    report.infrastructureError = messageOf(error);
    console.error(report.infrastructureError);
  } finally {
    report.finishedAt = new Date().toISOString();
    await save();
  }

  const passed = report.cases.filter((result) => result.passed).length;
  console.log(`${passed}/${selected.length} scenarios passed. Report: ${reportPath}`);
  if (passed !== selected.length || report.infrastructureError) process.exitCode = 1;
}

run().catch((error: unknown) => {
  console.error(messageOf(error));
  process.exitCode = 1;
});
