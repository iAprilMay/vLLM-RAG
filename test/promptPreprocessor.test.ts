import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFileSync } from "node:fs";
import { preprocess } from "../src/promptPreprocessor";
import type { ChatMessage, FileHandle, PromptPreprocessorController } from "@lmstudio/sdk";

// A fake FileHandle whose parseDocument returns fixed text (for the non-text-ish branch).
function fakeFileHandle(name: string, parsedContent: string): FileHandle {
  return {
    name,
    type: "application/pdf",
    isImage: () => false,
    filesNamespace: {
      parseDocument: async (_file: unknown) => ({ content: parsedContent, parser: { identifier: "builtIn", version: "1" } }),
    },
  } as unknown as FileHandle;
}

function makeMessage(files: Array<FileHandle>, text: string): ChatMessage {
  let currentText = text;
  const msg: ChatMessage = {
    getText: () => currentText,
    hasFiles: () => files.length > 0,
    getFiles: (_client: unknown) => files,
    consumeFiles: (_client: unknown, predicate: (f: FileHandle) => boolean) =>
      files.filter(predicate),
    replaceText: (newText: string) => {
      currentText = newText;
    },
  } as unknown as ChatMessage;
  return msg;
}

function makeCtl(): PromptPreprocessorController {
  const ctl: PromptPreprocessorController = {
    client: {
      files: {
        parseDocument: async (file: FileHandle) => {
          const fh = file as unknown as { filesNamespace: { parseDocument: (f: unknown) => unknown } };
          return fh.filesNamespace.parseDocument(file);
        },
      },
    },
    abortSignal: undefined,
    debug: (_msg: string) => {},
    createStatus: (_state: unknown) => ({ setState: (_s: unknown) => {}, addSubStatus: (_s: unknown) => ({} as unknown) }),
    getPluginConfig: (_schematics: unknown) => ({ get: (key: string) => (key === "maxInjectedChars" ? 200_000 : undefined) }),
    pullHistory: async () => ({} as unknown),
  } as unknown as PromptPreprocessorController;
  return ctl;
}

test("preprocessor injects a PDF attachment as text without calling applyPromptTemplate", async () => {
  const file = fakeFileHandle("notes.pdf", "PARSED PDF TEXT");
  const msg = makeMessage([file], "summarize this");
  const out = await preprocess(makeCtl(), msg);
  const resultText = (out as ChatMessage).getText();
  assert(resultText.includes("notes.pdf"));
  assert(resultText.includes("PARSED PDF TEXT"));
  assert(resultText.includes("summarize this"));
});

test("preprocessor injects a CSV attachment read from disk as text", async () => {
  const csvPath = "/tmp/vllm_rag_test_data.csv";
  writeFileSync(csvPath, "id,name\n1,alice\n2,bob\n");
  const file = {
    name: "data.csv",
    type: "text/plain",
    isImage: () => false,
    getFilePath: async () => csvPath,
  } as unknown as FileHandle;
  const msg = makeMessage([file], "what is this?");
  const out = await preprocess(makeCtl(), msg);
  const resultText = (out as ChatMessage).getText();
  assert(resultText.includes("data.csv"));
  assert(resultText.includes("alice"));
  assert(resultText.includes("what is this?"));
});

test("preprocessor leaves a plain-text message untouched", async () => {
  const msg = makeMessage([], "hello there");
  const out = await preprocess(makeCtl(), msg);
  assert.equal((out as ChatMessage).getText(), "hello there");
});

test("preprocessor leaves an image-only message untouched (vision path)", async () => {
  const img = { name: "a.png", type: "image", isImage: () => true } as unknown as FileHandle;
  const msg = makeMessage([img], "what is this?");
  const out = await preprocess(makeCtl(), msg);
  assert.equal((out as ChatMessage).getText(), "what is this?");
});

test("preprocessor reports no extractable text for an empty parse", async () => {
  const file = fakeFileHandle("scan.pdf", "   ");
  const msg = makeMessage([file], "read it");
  const out = await preprocess(makeCtl(), msg);
  const resultText = (out as ChatMessage).getText();
  assert(resultText.includes("scan.pdf"));
  assert(resultText.includes("no extractable text found"));
});
