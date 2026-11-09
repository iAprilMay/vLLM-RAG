import { type PluginContext } from "@lmstudio/sdk";
import { configSchematics } from "./config";
import { preprocess } from "./promptPreprocessor";

// vLLM RAG: a standalone prompt-preprocessor plugin that makes document/file attachments
// work for a model served through a `vllm`-kind engine-protocol instance.
//
// It registers a `promptPreprocessor` component, which is what makes LM Studio show the
// "Chat with Files" badge for this plugin (the same mechanism the built-in `lmstudio/rag-v1`
// uses). The built-in rag-v1 fails on a vllm-kind model because its "Deciding how to handle the
// document(s)" step calls `model.applyPromptTemplate(ctx)`, and the vLLM engine-protocol driver
// reports a promptTemplating capability gap (client-side, before any HTTP reaches the engine). This
// preprocessor NEVER calls applyPromptTemplate / countTokens / getContextLength, so it avoids that
// capability gap: it parses each attached non-image file and
// injects its full text directly into the user message, bounded by a character cap.
//
// Only ONE prompt preprocessor may run per chat. Enable this plugin and DISABLE the built-in
// `lmstudio/rag-v1` in the LM Studio UI so exactly one applies.

export async function main(context: PluginContext) {
  context.withConfigSchematics(configSchematics);
  context.withPromptPreprocessor(preprocess);
}
