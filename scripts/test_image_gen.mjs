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

async function testImageGen() {
  console.log("Testing Image Generation Model...");
  
  // Use the specific endpoint for image generation
  // The user mentioned "doubao-seedream-5-0", usually this needs a specific endpoint ID if not using the model name directly
  // Assuming the env var ARK_MODEL_IMAGE_ENDPOINT is set, or we use the model name
  const modelName = "ep-20250226132717-q6n5m"; 
  
  console.log("Model:", modelName);

  try {
    const response = await client.images.generate({
      model: modelName,
      prompt: "A delicious cup of bubble tea with pearls, cinematic lighting, 8k resolution",
      size: "2048x2048", // Doubao Seedream 5.0 requires 2048x2048
      quality: "standard",
      n: 1,
    });

    console.log("Image Gen Response URL:", response.data[0].url);
  } catch (error) {
    console.error("Image Gen Error:", error);
    if (error.response) {
        console.error("Data:", error.response.data);
    }
  }
}

testImageGen();
