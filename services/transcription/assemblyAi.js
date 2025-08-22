import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const ASSEMBLY_API_KEY = process.env.ASSEMBLY_API_KEY;

console.log("Using AssemblyAI API key:", ASSEMBLY_API_KEY ? "✅" : "❌");

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
  console.log("check status:", response.data.status);
    return {
      status: response.data.status,
      text: response.data.text,
      error: response.data.error,
      confidence: response.data.confidence,
      metadata: response.data,
    };
  },
};
