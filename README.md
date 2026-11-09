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

## Install

```bash
bash scripts/install.sh        # npm install + lms dev --install -y
```

Then **restart LM Studio** and **enable** this plugin while **disabling** the built-in
`lmstudio/rag-v1` — exactly one prompt preprocessor may run per chat.

## Rollback

```bash
bash scripts/uninstall.sh
```

## Verify (read-only, touches no app)

```bash
npm run check && npm test
```

## License

This plugin's own source is licensed under the [MIT License](LICENSE) — Copyright (c) 2026 iAprilMay.

The `@lmstudio/sdk` dependency it uses is licensed separately under the MIT License
(Copyright (c) 2025 Element Labs Inc).
