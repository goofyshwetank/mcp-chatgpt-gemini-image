#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

chromium.use(stealthPlugin());

const OUTPUT_DIR =
  process.env.IMAGE_OUTPUT_DIR ||
  path.join(os.homedir(), ".browser-image-mcp", "chatgpt-image-output");
const PROFILE_DIR =
  process.env.CHATGPT_PROFILE_DIR ||
  path.join(os.homedir(), ".cursor", "chatgpt-profile-v2");
const URL = "https://chatgpt.com/";
const IMG_SEL =
  'img[alt*="Generated"], img[src*="oaidalle"], img[src*="dalle"], [data-testid="conversation-turn"] img';

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
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox"
    ]
  });
  page = ctx.pages()[0] || (await ctx.newPage());
  return page;
}

async function findComposer(p) {
  for (const loc of [
    p.getByTestId("prompt-textarea"),
    p.locator("#prompt-textarea"),
    p.locator('div[contenteditable="true"]'),
    p.locator('textarea[placeholder*="message" i]'),
    p.locator('textarea[placeholder*="ask" i]'),
    p.locator('div[id*="prompt"]'),
  ]) {
    if ((await loc.count()) > 0 && (await loc.first().isVisible())) return loc.first();
  }
  return null;
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
  const send = p.locator('button[data-testid="send-button"], button[aria-label*="Send" i]').first();
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
        if (!box || box.width < 64 || box.height < 64) continue;
        if (src.startsWith("data:image/svg") || alt.includes("avatar")) continue;
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
    if (!res.ok()) throw new Error(`Download failed (${res.status()})`);
    await fs.writeFile(outPath, await res.body());
  } else {
    await img.screenshot({ path: outPath, type: "png" });
  }
  return outPath;
}

const server = new McpServer({ name: "chatgpt-image", version: "1.0.0" });

server.tool(
  "check_session",
  "Check if the saved ChatGPT browser profile is logged in. Does not generate an image.",
  {},
  async () => {
    try {
      const p = await getPage();
      await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      
      let loggedIn = Boolean(await findComposer(p));
      if (!loggedIn) {
        // Wait up to 30s in case Cloudflare or page hydration is finishing
        for (let i = 0; i < 12; i++) {
          await p.waitForTimeout(2500);
          loggedIn = Boolean(await findComposer(p));
          if (loggedIn) break;
        }
      }

      return ok({
        ok: loggedIn,
        loggedIn,
        url: p.url(),
        title: await p.title().catch(() => ""),
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
  "Generate an image via ChatGPT in the browser and save it to disk.",
  {
    prompt: z.string().describe("Image description"),
    fileName: z.string().optional().describe("Output filename"),
  },
  async ({ prompt, fileName }) => {
    try {
      const p = await getPage();
      await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(2500);

      let composer = await findComposer(p);
      if (!composer) {
        for (let i = 0; i < 6; i++) {
          await p.waitForTimeout(2500);
          composer = await findComposer(p);
          if (composer) break;
        }
      }

      if (!composer) {
        return fail("Login required or bot check blocked. Check the browser window.", {
          needsLogin: true,
          profileDir: PROFILE_DIR,
        });
      }

      const before = await p.locator(IMG_SEL).count();
      await sendPrompt(p, `Generate an image: ${prompt}`);
      const img = await waitForImage(p, before);
      if (!img) return fail("Timed out waiting for image.", { url: p.url() });

      const name =
        fileName || `chatgpt-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      const saved = await saveImage(img, name);
      return ok({ ok: true, path: saved, message: `Saved ${saved}` });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  }
);

await server.connect(new StdioServerTransport());
