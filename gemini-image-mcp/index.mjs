#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { removeGeminiWatermark } from "./remove-watermark.mjs";

const OUTPUT_DIR =
  process.env.IMAGE_OUTPUT_DIR ||
  path.join(os.homedir(), ".browser-image-mcp", "gemini-image-output");
const PROFILE_DIR =
  process.env.GEMINI_PROFILE_DIR ||
  path.join(os.homedir(), ".browser-image-mcp", "gemini-browser-profile");
const URL = "https://gemini.google.com/app";
const IMG_SEL =
  'img[src*="googleusercontent"], img[src*="lh3.google"], image-viewer img, .image-container img, response-container img';

let page = null;

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function fail(message, extra = {}) {
  return {
    content: [{ type: "text", text: JSON.stringify({ ok: false, message, ...extra }, null, 2) }],
    isError: true,
  };
}

async function getPage() {
  if (page && !page.isClosed()) return page;
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: process.env.GEMINI_HEADLESS === "true",
    viewport: { width: 1400, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  page = ctx.pages()[0] || (await ctx.newPage());
  return page;
}

function onGeminiApp(url) {
  const u = (url || "").toLowerCase();
  return u.includes("gemini.google.com") && !u.includes("accounts.google.com");
}

async function findComposer(p) {
  for (const loc of [
    p.locator('rich-textarea div[contenteditable="true"]'),
    p.locator('div[contenteditable="true"][aria-label*="prompt" i]'),
    p.locator('div.input-area div[contenteditable="true"]'),
  ]) {
    if ((await loc.count()) > 0 && (await loc.first().isVisible())) return loc.first();
  }
  return null;
}

async function isReady(p) {
  return onGeminiApp(p.url()) && Boolean(await findComposer(p));
}

async function waitUntilReady(p, timeoutMs = 300000) {
  const start = Date.now();
  let streak = 0;
  while (Date.now() - start < timeoutMs) {
    if (await isReady(p)) {
      if (++streak >= 2) return true;
    } else streak = 0;
    await p.waitForTimeout(2000);
  }
  return false;
}

async function sendPrompt(p, text) {
  const composer = await findComposer(p);
  if (!composer) return null;
  await composer.click();
  try {
    await composer.fill(text);
  } catch {
    await composer.pressSequentially(text, { delay: 8 });
  }
  const send = p.locator('button[aria-label*="Send" i], button.send-button').first();
  if ((await send.count()) > 0 && (await send.isEnabled())) await send.click();
  else await composer.press("Enter");
  return composer;
}

async function waitForImage(p, before, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const imgs = p.locator(IMG_SEL);
    const count = await imgs.count();
    if (count > before) {
      for (let i = count - 1; i >= 0; i--) {
        const img = imgs.nth(i);
        const box = await img.boundingBox().catch(() => null);
        const src = (await img.getAttribute("src")) || "";
        const alt = ((await img.getAttribute("alt")) || "").toLowerCase();
        if (!box || box.width < 96 || box.height < 96) continue;
        if (src.startsWith("data:image/svg") || alt.includes("avatar") || alt.includes("profile")) {
          continue;
        }
        return img;
      }
    }
    await p.waitForTimeout(1500);
  }
  return null;
}

async function saveImage(img, fileName) {
  const outPath = path.join(OUTPUT_DIR, fileName.replace(/[<>:"/\\|?*]/g, "_"));
  const src = (await img.getAttribute("src")) || "";
  if (src.startsWith("data:image")) {
    await fs.writeFile(outPath, Buffer.from(src.split(",")[1], "base64"));
  } else if (src.startsWith("http")) {
    const res = await page.request.get(src);
    if (res.ok()) {
      await fs.writeFile(outPath, await res.body());
      return outPath;
    }
  }
  await img.screenshot({ path: outPath, type: "png" });
  return outPath;
}

const server = new McpServer({ name: "gemini-image", version: "1.0.0" });

server.tool(
  "check_session",
  "Check if the saved Gemini browser profile is logged in. Does not generate an image.",
  {},
  async () => {
    try {
      const p = await getPage();
      await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(2500);
      const loggedIn = await isReady(p);
      return ok({
        ok: loggedIn,
        loggedIn,
        url: p.url(),
        profileDir: PROFILE_DIR,
        message: loggedIn
          ? "Logged in."
          : "Not logged in — sign in in the opened browser, then check again.",
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

server.tool(
  "generate_image",
  "Generate an image via Gemini in the browser, remove the watermark, and save it.",
  {
    prompt: z.string().describe("Image description"),
    fileName: z.string().optional().describe("Output filename"),
  },
  async ({ prompt, fileName }) => {
    try {
      const p = await getPage();
      await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(2000);

      if (!(await isReady(p)) && !(await waitUntilReady(p))) {
        return fail("Sign in to Gemini in the opened browser, then retry.", {
          needsLogin: true,
          profileDir: PROFILE_DIR,
          url: p.url(),
        });
      }

      if (!onGeminiApp(p.url())) {
        await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        await p.waitForTimeout(2000);
      }

      const before = await p.locator(IMG_SEL).count();
      if (!(await sendPrompt(p, `Generate an image: ${prompt}`))) {
        return fail("Could not find Gemini prompt box.", { url: p.url() });
      }

      const img = await waitForImage(p, before);
      if (!img) return fail("Timed out waiting for image.", { url: p.url() });

      const name =
        fileName || `gemini-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      const rawPath = await saveImage(img, name);
      const cleanPath = rawPath.replace(/(\.[^.]+)?$/, "-clean.png");

      try {
        await removeGeminiWatermark(rawPath, cleanPath);
        return ok({
          ok: true,
          path: cleanPath,
          rawPath,
          watermarkRemoved: true,
          message: `Saved ${cleanPath}`,
        });
      } catch (err) {
        return ok({
          ok: true,
          path: rawPath,
          watermarkRemoved: false,
          message: `Saved ${rawPath}; watermark removal failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

await server.connect(new StdioServerTransport());
