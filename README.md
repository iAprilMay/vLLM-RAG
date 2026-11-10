# vLLM RAG — custom prompt preprocessor

A standalone LM Studio **prompt-preprocessor plugin** (`vllm-rag`) that lets a model
served through a `vllm`-kind engine-protocol instance **read attached documents**
(PDF / CSV / TXT / …). It registers a `promptPreprocessor` component, which is also what
makes LM Studio show the "Chat with Files" badge for this plugin.

## Why it exists

LM Studio's built-in `lmstudio/rag-v1` preprocessor breaks on a `vllm`-kind model: its
"Deciding how to handle the document(s)" step measures the context window via
`model.applyPromptTemplate(ctx)`, and the vLLM engine-protocol driver reports a
`promptTemplating` capability gap **client-side** — it throws before any request reaches
the engine, so no engine-side shim can intercept it.

This preprocessor sidesteps that gap entirely. It **never** calls
`applyPromptTemplate` / `countTokens` / `getContextLength`. Instead it parses each
attached non-image file and injects its full text directly into the user message,
bounded by a character cap (no token measurement needed). Images stay on the vision path.

## Layout

- `manifest.json` — plugin manifest (`type: "plugin"`, `owner: "local"`, `name: "vllm-rag"`).
- `src/promptPreprocessor.ts` — the preprocessor logic.
- `src/config.ts` — per-chat settings (`maxInjectedChars`, default 200000).
- `src/index.ts` — plugin entry (`withConfigSchematics` + `withPromptPreprocessor`).
- `test/promptPreprocessor.test.ts` — unit tests.
- `scripts/install.sh` / `scripts/uninstall.sh` — one-command install / rollback.

## Installation

Works on any system that has LM Studio installed (Linux / macOS / Windows). The scripts resolve
your LM Studio home automatically (honouring `~/.lmstudio-home-pointer`) and let you override the
`lms` CLI path with `LMS_BIN`, so nothing is hardcoded to one machine.

```bash
cd "vLLM RAG"
npm install
```

Then choose one of the following:

| Goal | Command | Plugin id |
| --- | --- | --- |
| **Dev** (hot reload, chat UI) | `npm run dev` | use installed copy for REST (see below) |
| **Local install** (REST + chat) | `npm run install-plugin` (`lms dev --install -y`) | `local/vllm-rag` |
| **Publish to Hub** | `lms login` then `lms push -y` | `<your-handle>/vllm-rag` |

One-command install (Linux) (does `npm install` + `lms dev --install -y`, resolving your LM Studio home):

```bash
bash scripts/install.sh
```

After code changes: re-run `npm run dev`, `lms dev --install -y`, or `lms push -y`.

## Manual testing

**Default chat workflow** — no `lms server start`; the server runs inside the LM Studio app
(`http://localhost:1234` when enabled).

1. Open the **LM Studio** desktop app.
2. Load the plugin (pick one):
   - **Dev:** `cd "vLLM RAG" && npm run dev` (leave running; good for UI iteration)
   - **Installed (required for REST):** `cd "vLLM RAG" && npm run install-plugin`
3. Open a **Chat** → right sidebar → **Integrations** (hammer icon) → enable **vLLM RAG**.
4. Attach a document (PDF / CSV / TXT / …) and send a chat message. The attached file's text is
   injected into the user message (bounded by the character cap).

> Exactly one prompt preprocessor may run per chat: **enable** this plugin and **disable** the
> built-in `lmstudio/rag-v1`.

**Automated tests** (no UI):

```bash
cd "vLLM RAG" && npm test
```

## Rollback

Uninstalling removes the *installed* copy from LM Studio's extensions tree — it never touches this
source folder, the running model, or the engine's state. Remove the plugin directory from your LM
Studio home (`<LMSTUDIO_HOME>/extensions/plugins/local/vllm-rag`):

```bat
:: Windows (LM Studio home is usually %LOCALAPPDATA%\LM Studio)
rmdir /s /q "%LOCALAPPDATA%\LM Studio\extensions\plugins\local\vllm-rag"
```

```bash
# Linux / macOS (home is ~/.lmstudio unless relocated via ~/.lmstudio-home-pointer)
rm -rf ~/.lmstudio/extensions/plugins/local/vllm-rag
```

If you also use Bionic, remove its copy at `<LMSTUDIO_HOME>/apps/bionic/extensions/plugins/local/vllm-rag`.

> **Linux convenience script** — `scripts/uninstall.sh` does the above plus resolves your LM Studio
> home (honouring `~/.lmstudio-home-pointer`), removes the Bionic copy, and supports
> `--purge-config` / `--keep-config` for the saved settings:
>
> ```bash
> bash scripts/uninstall.sh
> ```

## Verify (read-only, touches no app)

```bash
npm run check && npm test
```

## License

This plugin's own source is licensed under the [MIT License](LICENSE) — Copyright (c) 2026 iAprilMay.

The `@lmstudio/sdk` dependency it uses is licensed separately under the MIT License
(Copyright (c) 2025 Element Labs Inc).
