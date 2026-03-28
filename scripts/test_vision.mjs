import OpenAI from "openai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const client = new OpenAI({
  apiKey: process.env.ARK_API_KEY,
  baseURL: "https://ark.cn-beijing.volces.com/api/v3",
});

async function testVision() {
  console.log("Testing Vision Model...");
  console.log("API Key:", process.env.ARK_API_KEY ? "Present" : "Missing");
  console.log("Model:", process.env.ARK_MODEL_ENDPOINT || "ep-20250226131448-mcvtc"); // Default to vision model

  try {
    const response = await client.chat.completions.create({
      model: process.env.ARK_MODEL_ENDPOINT || "ep-20250226131448-mcvtc",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is in this image?" },
            {
              type: "image_url",
              image_url: {
                // Small 1x1 transparent pixel for testing connectivity
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
              },
            },
          ],
        },
      ],
    });

    console.log("Vision Response:", response.choices[0].message.content);
  } catch (error) {
    console.error("Vision Error:", error);
  }
}

testVision();
