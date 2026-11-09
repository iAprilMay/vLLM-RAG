import {
  type ChatMessage,
  type FileHandle,
  type PromptPreprocessorController,
} from "@lmstudio/sdk";
import { readFileSync } from "node:fs";
import { configSchematics } from "./config";

// vLLM RAG prompt preprocessor.
//
// Makes attached non-image documents (PDF/CSV/TXT/...) usable by a model served through a
// `vllm`-kind engine-protocol instance. The built-in `lmstudio/rag-v1` preprocessor breaks on
// that model because its
// "Deciding how to handle the document(s)" step measures the context window via
// `model.applyPromptTemplate(ctx)`, and the vLLM engine-protocol driver reports a
// promptTemplating capability gap (client-side, before any HTTP reaches the
// engine). This preprocessor NEVER calls applyPromptTemplate / countTokens / getContextLength, so it
// avoids that capability gap: it parses each attached file and injects its full text directly into
// the user message, bounded by a character cap (no token measurement needed).
//
// Registering a `promptPreprocessor` component is also what makes LM Studio show the "Chat with
// Files" badge for this plugin (same mechanism as the built-in rag-v1).

const TEXT_FILE_EXTENSIONS = new Set([
  "csv", "txt", "md", "markdown", "json", "jsonc", "log", "tsv",
  "xml", "yaml", "yml", "ini", "cfg", "conf", "html", "htm", "srt", "vtt",
]);

function truncateDocText(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return text.slice(0, cap) + "\n…[truncated]";
}

// Extract a non-image file's text. Text-ish files are read directly as UTF-8 (robust); everything
// else (PDF, DOC, ...) is parsed via the SDK's parseDocument.
async function documentTextForFile(file: FileHandle, cap: number): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  let content = "";
  if (TEXT_FILE_EXTENSIONS.has(extension)) {
    const path = await file.getFilePath();
    content = readFileSync(path, "utf8");
  } else {
    const parsed = await file.filesNamespace.parseDocument(file);
    content = parsed?.content ?? "";
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    // Do not silently send an empty document (e.g. a scanned/image-only PDF).
    return `[Attached file: ${file.name}] (no extractable text found — possibly a scanned or image-only document)`;
  }
  return `[Attached file: ${file.name}]\n${truncateDocText(content, cap)}`;
}

export async function preprocess(
  ctl: PromptPreprocessorController,
  userMessage: ChatMessage,
) {
  // Only act when the current user turn actually attaches non-image files.
  if (!userMessage.hasFiles()) {
    return userMessage;
  }
  const newFiles = userMessage
    .getFiles(ctl.client)
    .filter((file: FileHandle) => file.type !== "image");
  if (newFiles.length === 0) {
    // Images stay on the vision path; nothing to do.
    return userMessage;
  }

  const status = ctl.createStatus({
    status: "loading",
    text: `Reading attached documents...`,
  });

  const pluginConfig = ctl.getPluginConfig(configSchematics);
  const maxInjectedChars = pluginConfig.get("maxInjectedChars");

  // Consume (remove) the non-image files so they are not also forwarded as raw file parts;
  // their parsed text is inlined instead.
  const consumed = userMessage.consumeFiles(ctl.client, (file: FileHandle) => file.type !== "image");

  const documentSnippets: Array<{ name: string; content: string }> = [];
  for (const file of consumed) {
    status.setState({ status: "loading", text: `Parsing ${file.name}...` });
    let content: string;
    try {
      content = await documentTextForFile(file, maxInjectedChars);
    } catch {
      content = "";
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      documentSnippets.push({
        name: file.name,
        content: `[Attached file: ${file.name}] (no extractable text found — possibly a scanned or image-only document)`,
      });
    } else {
      documentSnippets.push({ name: file.name, content });
    }
  }

  const userPrompt = userMessage.getText();
  const blocks = documentSnippets.map((snippet) =>
    `** ${snippet.name} full content **\n\n${snippet.content}\n\n** end of ${snippet.name} **`
  );

  let formatted =
    "This is an Enriched Context Generation scenario.\n\n" +
    "The following content was found in the files provided by the user.\n\n";
  formatted += blocks.join("\n\n");
  formatted +=
    "\n\nBased on the content above, please provide a response to the user query." +
    `\n\nUser query: ${userPrompt}`;

  userMessage.replaceText(formatted);

  status.setState({
    status: "done",
    text: `Injected ${documentSnippets.length} document(s) into the prompt`,
  });

  return userMessage;
}
