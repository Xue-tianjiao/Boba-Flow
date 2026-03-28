import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function testImageGen() {
  console.log("Testing Image Generation Model (Fetch)...");
  const apiKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY;
  // Use the image model ID from server.ts default or env
  const endpointId = process.env.ARK_MODEL_IMAGE || "ep-20250226132717-q6n5m"; // Default from server.ts
  
  if (!apiKey) {
    console.error("No API Key found!");
    return;
  }
  console.log("Model:", endpointId);

  const url = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
  
  const payload = {
    model: endpointId,
    prompt: "A artistic painting of a milk tea cup",
    size: "2048x2048",
    response_format: "url" // The API returns a URL
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`Error ${response.status}:`, text);
        return;
    }

    const data = await response.json();
    console.log("Image Gen Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Image Gen Error:", error);
  }
}

testImageGen();
