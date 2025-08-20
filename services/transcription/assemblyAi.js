import axios from "axios";

const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;

export const AssemblyAIProvider = {
  startTranscription: async (fileUrl) => {
    const response = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      { audio_url: fileUrl },
      {
        headers: {
          authorization: ASSEMBLY_API_KEY,
          "content-type": "application/json",
        },
      }
    );

    return { id: response.data.id };
  },

  checkStatus: async (id) => {
    const response = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${id}`,
      {
        headers: { authorization: ASSEMBLY_API_KEY },
      }
    );

    return {
      status: response.data.status,
      text: response.data.text,
      error: response.data.error,
      confidence: response.data.confidence,
      metadata: response.data,
    };
  },
};
