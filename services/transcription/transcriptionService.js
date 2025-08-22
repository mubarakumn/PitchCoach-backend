import { AssemblyAIProvider } from "./assemblyAi.js";
import { OpenAIProvider } from "./openAi.js";

const providers = {
  assemblyai: AssemblyAIProvider,
  openai: OpenAIProvider,
};

const DEFAULT_PROVIDER = "assemblyai";

export const transcriptionService = {
  /**
   * High-level API for transcription.
   * Handles both async providers (AssemblyAI) and sync ones (OpenAI).
   */
  transcribe: async (fileUrl, providerName = DEFAULT_PROVIDER) => {
    const provider = providers[providerName];

    if (providerName === "openai") {
      // OpenAI = synchronous
      const result = await provider.startTranscription(fileUrl);
      return {
        status: "completed",
        text: result.text,
        provider,
        metadata: result,
      };
    }

    if (providerName === "assemblyai") {
      // AssemblyAI = async → we poll until done
      const start = await provider.startTranscription(fileUrl);

      let attempts = 0;
      const maxAttempts = 40; // ~20 min if 30s interval
      const interval = 30 * 1000;

      while (attempts < maxAttempts) {
        const status = await provider.checkStatus(start.id);

        if (status.status === "completed") {
          return {
            status: "completed",
            text: status.text,
            provider,
            metadata: status.metadata,
          };
        }

        if (status.status === "failed") {
          return {
            status: "failed",
            error: status.error,
            provider,
            metadata: status.metadata,
          };
        }

        // Wait before next check
        await new Promise((res) => setTimeout(res, interval));
        attempts++;
      }

      return {
        status: "failed",
        error: "Polling timeout – transcription took too long",
      };
    }

    throw new Error(`Unsupported provider: ${providerName}`);
  },
};
