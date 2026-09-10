# Browser Image MCPs

Generate images through ChatGPT and Gemini directly from your local machine using Model Context Protocol (MCP) servers and real browser automation.

These MCP servers use Playwright to open ChatGPT or Gemini in Chromium, submit your image prompt, retrieve the generated image, and save it directly to your computer.

No image-generation API key is required. You use your existing ChatGPT or Google account through a persistent browser session.

## What are Browser Image MCPs?

Browser Image MCPs connect AI coding assistants (Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Codex, and other MCP clients) to image-generation services through browser automation.

Instead of calling an image-generation API, the MCP server controls a real Chromium browser session using Playwright. You log in once, and the session is stored locally so you can continue generating images without signing in every time.

Currently, the project includes two MCP servers:

| Package             | Description                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `chatgpt-image-mcp` | Opens ChatGPT, submits an image-generation prompt, retrieves the generated image, and saves it to disk. |
| `gemini-image-mcp`  | Opens Gemini, generates an image, processes the result, and saves the cleaned image to disk.            |

This makes it possible to use ChatGPT or Gemini image generation from any MCP-compatible client.

## Why use this?

If you're building websites, applications, games, marketing assets, or other digital products with an AI coding assistant, generating images usually means switching between different applications and manually downloading files.

Browser Image MCPs remove much of that friction.

You can give your MCP client a prompt such as:

> Create a premium product photograph of a black wireless headphone on a minimal studio background.

The browser automation handles the interaction with ChatGPT or Gemini and saves the resulting image locally.

This is particularly useful for:

* AI-assisted web development
* Website and landing-page design
* Product mockups
* Marketing creatives
* UI design assets
* Game development
* Social media graphics
* Concept art
* Image-generation workflows
* MCP client workflows (Cursor, Claude, VS Code, Windsurf, Codex, and more)

## How it works

The workflow is simple:

```text
MCP Client (Cursor / Claude / VS Code / Windsurf / Codex / …)
        ↓
Browser Image MCP
        ↓
Playwright
        ↓
Chromium
        ↓
ChatGPT or Gemini
        ↓
Generated Image
        ↓
Local Output Directory
```

The MCP server launches a persistent Chromium profile, opens the appropriate AI service, submits your prompt, waits for the generated image, and saves the result locally.

Because the browser profile is persistent, you only need to log in during the initial setup.

## Requirements

Before getting started, make sure you have:

* Node.js 22 or newer
* An MCP-compatible client (Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Codex, Cline, etc.)
* A ChatGPT account for `chatgpt-image-mcp`
* A Google account for `gemini-image-mcp`
* Network access to `chatgpt.com` and/or `gemini.google.com`

Node.js 18 may work, but Node.js 22+ is recommended.

## Installation

Clone or download the repository and install the dependencies for the MCP server you want to use.

### ChatGPT Image MCP

```bash
cd chatgpt-image-mcp
npm install
npx playwright install chromium
```

### Gemini Image MCP

```bash
cd ../gemini-image-mcp
npm install
npx playwright install chromium
```

## Configure your MCP client (easy)

Works with any MCP client that supports local stdio servers: **Cursor**, **Claude Desktop**, **Claude Code**, **VS Code**, **Windsurf**, **Codex**, **Cline**, and similar tools.

### 1) Auto-fill paths (do this first)

```bash
node setup.mjs
```

That creates `mcp.ready.json` with the correct absolute paths for your machine.

### 2) Or edit `mcp.json` by hand

Open `mcp.json` in this repo and replace **every** occurrence of:

| Placeholder | Replace with |
| --- | --- |
| `C:/FULL/PATH/TO/THIS/REPO` | Full path to this cloned folder |
| `C:/FULL/PATH/TO/HOME` | Your home folder (`C:/Users/You` or `/Users/You` or `/home/you`) |

**Windows example:** if the repo is at `C:\Users\Sam\mcp-chatgpt-gemini-image`:

```text
C:/FULL/PATH/TO/THIS/REPO  →  C:/Users/Sam/mcp-chatgpt-gemini-image
C:/FULL/PATH/TO/HOME       →  C:/Users/Sam
```

Forward slashes work on Windows.

### 3) Add the servers to your client

Copy the `chatgpt-image` and `gemini-image` blocks from `mcp.ready.json` (or your edited `mcp.json`) into your client’s MCP config.

#### Cursor

- File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project)
- Paste under `"mcpServers"`, then **reload MCP servers**

#### Claude Desktop

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Paste under `"mcpServers"`, then **fully quit and reopen Claude Desktop**

#### Claude Code

```bash
# ChatGPT
claude mcp add chatgpt-image --env IMAGE_OUTPUT_DIR=... --env CHATGPT_PROFILE_DIR=... --env CHATGPT_HEADLESS=false -- node /FULL/PATH/TO/THIS/REPO/chatgpt-image-mcp/index.mjs

# Gemini
claude mcp add gemini-image --env IMAGE_OUTPUT_DIR=... --env GEMINI_PROFILE_DIR=... --env GEMINI_HEADLESS=false -- node /FULL/PATH/TO/THIS/REPO/gemini-image-mcp/index.mjs
```

Easier: run `node setup.mjs`, then copy the env values and paths from `mcp.ready.json` into the commands above. Add `--scope user` if you want them available in every project.

#### VS Code (GitHub Copilot / MCP)

- User or workspace MCP settings (depending on your VS Code MCP extension / Copilot MCP support)
- Common locations: `.vscode/mcp.json` in the project, or the MCP servers UI in Settings
- Use the same JSON shape as `mcp.ready.json` (`command`, `args`, `env`)
- Reload the window after saving

#### Windsurf

- File: `~/.codeium/windsurf/mcp_config.json` (typical)
- Paste under `"mcpServers"`, then restart Windsurf / reload MCP

#### Codex (OpenAI)

Add to `~/.codex/config.toml` (one server shown; repeat for Gemini):

```toml
[mcp_servers.chatgpt-image]
command = "node"
args = ["/FULL/PATH/TO/THIS/REPO/chatgpt-image-mcp/index.mjs"]

[mcp_servers.chatgpt-image.env]
IMAGE_OUTPUT_DIR = "/FULL/PATH/TO/HOME/.browser-image-mcp/chatgpt-image-output"
CHATGPT_PROFILE_DIR = "/FULL/PATH/TO/HOME/.browser-image-mcp/chatgpt-browser-profile"
CHATGPT_HEADLESS = "false"
```

Use the paths printed by `node setup.mjs`.

#### Cline / other MCP clients

Any client that accepts stdio MCP servers can use the same `command` + `args` + `env` from `mcp.ready.json`. Put that block wherever that client stores MCP server definitions, then restart/reload it.

### 4) First login

1. Call `check_session` (or `generate_image`).
2. Sign in in the Chromium window.
3. Call `check_session` again until it says logged in.

## Available MCP tools

Both servers provide two primary tools.

### `check_session`

Opens the corresponding AI service and checks whether the saved browser profile is currently logged in.

It does not generate an image.

This is useful during initial setup to verify that authentication is working.

### `generate_image`

Generates an image from a text prompt and saves the resulting file locally.

Example:

```text
generate_image
```

with:

```json
{
  "prompt": "A cinematic photograph of a futuristic sports car in Tokyo at night",
  "fileName": "tokyo-sports-car.png"
}
```

## `generate_image` parameters

| Parameter  | Required | Description                                                                       |
| ---------- | -------- | --------------------------------------------------------------------------------- |
| `prompt`   | Yes      | The text description used to generate the image.                                  |
| `fileName` | No       | Name of the output image. If omitted, a timestamped `.png` filename is generated. |

The Gemini MCP additionally creates a `-clean.png` version after processing the generated image with `@pilio/gemini-watermark-remover`.

## First-time login

Authentication only needs to be completed once for each browser profile.

1. Run `check_session` or `generate_image`.
2. A Chromium browser window will open.
3. Sign in to ChatGPT or Google.
4. Complete any authentication steps required by the service.
5. Run `check_session` again.
6. Once the session is detected as logged in, you can use `generate_image`.

Your authentication session is stored inside the persistent Chromium profile.

Default profiles are:

```text
~/.browser-image-mcp/chatgpt-browser-profile
~/.browser-image-mcp/gemini-browser-profile
```

You can change these locations using environment variables.

## Persistent browser profiles

The persistent profiles allow you to stay logged in between image-generation requests.

ChatGPT:

```text
~/.browser-image-mcp/chatgpt-browser-profile
```

Gemini:

```text
~/.browser-image-mcp/gemini-browser-profile
```

Custom locations can be configured with:

```text
CHATGPT_PROFILE_DIR
GEMINI_PROFILE_DIR
```

Do not commit these directories to Git. They may contain authentication data and other sensitive browser information.

## Environment variables

| Variable              | Package | Default                                        | Purpose                                                              |
| --------------------- | ------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| `IMAGE_OUTPUT_DIR`    | Both    | `~/.browser-image-mcp/<name>-image-output`     | Directory where generated images are saved.                          |
| `CHATGPT_PROFILE_DIR` | ChatGPT | `~/.browser-image-mcp/chatgpt-browser-profile` | Persistent ChatGPT Chromium profile.                                 |
| `GEMINI_PROFILE_DIR`  | Gemini  | `~/.browser-image-mcp/gemini-browser-profile`  | Persistent Gemini Chromium profile.                                  |
| `CHATGPT_HEADLESS`    | ChatGPT | `false`                                        | Set to `true` to run Chromium without displaying the browser window. |
| `GEMINI_HEADLESS`     | Gemini  | `false`                                        | Set to `true` to run Chromium without displaying the browser window. |

## Output files

Generated images are written to the configured `IMAGE_OUTPUT_DIR`.

If no filename is provided, the MCP automatically creates a timestamped PNG file.

For Gemini, the workflow can additionally produce a cleaned image:

```text
original.png
original-clean.png
```

The `-clean.png` file is produced using the Gemini watermark-removal package.

## Gemini watermark processing

The Gemini MCP uses `@pilio/gemini-watermark-remover` to process the generated image.

The remover is intended to target the visible Gemini corner logo. It does not remove invisible or steganographic provenance markers such as SynthID.

You should review the watermark remover's own documentation, license, and disclaimers before using this functionality.

## Security considerations

This project uses browser automation rather than an official image-generation API.

That means your local Chromium profile may contain authenticated sessions and other sensitive browser information.

Do not commit any of the following to your repository:

```text
Browser profiles
API keys
Authentication tokens
Generated images
Local configuration files containing secrets
```

A suitable `.gitignore` should include your browser profiles and generated output directories.

## Limitations

Browser automation is inherently more fragile than an official API.

The MCP servers depend on the current web interfaces of ChatGPT and Gemini. If either service changes its HTML structure, buttons, selectors, authentication flow, or image-generation workflow, the automation may stop working until the MCP is updated.

Other limitations include:

* Browser UI changes can break automation.
* Authentication may occasionally need to be repeated.
* Headless mode may behave differently from visible browser mode.
* Generation speed depends on the underlying AI service.
* The services may impose their own usage limits.
* Availability and behavior can change without notice.

## Terms of service

Automating ChatGPT or Gemini through their web interfaces may conflict with the applicable terms of service of those platforms.

Use this project at your own risk and make sure your use complies with the terms and policies of the services you are accessing.

This project is not affiliated with or endorsed by OpenAI or Google.

## License

This project is released under the **[MIT License](LICENSE)**.

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, provided that the copyright notice and permission notice are included in all copies or substantial portions of the Software.

The software is provided **"as is"**, without warranty of any kind. See [LICENSE](LICENSE) for the full text.

### Third-party licenses

This project depends on other open-source packages. Their licenses apply to those components separately, including:

| Dependency | Used by | Notes |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` | Both | MCP protocol client/server SDK |
| `playwright` | Both | Browser automation |
| `zod` | Both | Tool argument validation |
| `@pilio/gemini-watermark-remover` | Gemini | Visible watermark processing ([upstream](https://github.com/GargantuaX/gemini-watermark-remover)) |
| `sharp` | Gemini | Image decode/encode for the watermark CLI |

Review each package’s license before redistributing or embedding this project in commercial products.

### GitHub license metadata

When you create the GitHub repository, set the license to **MIT** so GitHub shows the license badge and SPDX detection matches the `LICENSE` file in this repo.

## Continuous integration

A lightweight GitHub Actions workflow runs on push and pull requests:

* installs dependencies for both packages
* syntax-checks the MCP entrypoints with `node --check`

It does **not** open ChatGPT/Gemini or generate images in CI. Those flows need a real logged-in browser profile and are too fragile (and ToS-sensitive) for public automated tests.

Local smoke check:

```bash
npm run check --prefix chatgpt-image-mcp
npm run check --prefix gemini-image-mcp
```
