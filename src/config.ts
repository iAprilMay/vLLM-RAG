import { createConfigSchematics } from "@lmstudio/sdk";

// Per-chat config for the vLLM RAG preprocessor.
export const configSchematics = createConfigSchematics()
  .field(
    "maxInjectedChars",
    "numeric",
    {
      int: true,
      min: 1000,
      displayName: "Max Injected Characters",
      subtitle:
        "Total characters of attached-file text pasted into the prompt before it is truncated. " +
        "Keeps the injected document within the model context without measuring tokens.",
      slider: { min: 1000, max: 400000, step: 1000 },
    },
    200_000,
  )
  .build();
