import { AssemblyAIProvider } from "./assemblyAi.js";
import { OpenAIProvider } from "./openAi.js";

const providers = {
  assemblyai: AssemblyAIProvider,
  openai: OpenAIProvider,
};

const DEFAULT_PROVIDER = "assemblyai";

export const transcriptionService = {
  start: async (file) => {
    const provider = providers[DEFAULT_PROVIDER];
    // Use file.fileUrl (Cloudinary URL)
    return provider.startTranscription(file.fileUrl);
  },

  check: async (providerName, transcriptionId) => {
    const provider = providers[providerName];
    return provider.checkStatus(transcriptionId);
  },
};
