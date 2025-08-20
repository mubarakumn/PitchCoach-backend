import OpenAI from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";


dotenv.config();

const apiKey = process.env.OPENAI_API_KEY
// console.log(API_KEY);
const client = new OpenAI({apiKey});

export const OpenAIProvider = {
  startTranscription: async (fileUrl) => {
    // download from Cloudinary first
    const tempFilePath = path.join("/tmp", `audio-${Date.now()}.mp3`);
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));

    const resp = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    fs.unlinkSync(tempFilePath);

    return { id: null, text: resp.text };
  },

  checkStatus: async () => null, // OpenAI is synchronous
};
