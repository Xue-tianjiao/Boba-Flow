import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function testVision() {
  console.log("Testing Vision Model (Fetch)...");
  const apiKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY;
  const endpointId = process.env.ARK_MODEL_VISION || process.env.ARK_MODEL_TEXT || "ep-20250226131448-mcvtc";
  
  if (!apiKey) {
    console.error("No API Key found!");
    return;
  }
  console.log("Model:", endpointId);

  const url = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  
  // 20x20 red square
  const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAC5JREFUeNpi/P//PwM1AQsQU9VEJgYGPgYqA6P6RvWN6hvVN6pvVN+ovlF9AxkYALDBBwD2HwWkAAAAAElFTkSuQmCC";

  const payload = {
    model: endpointId,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What color is this image?" },
          {
            type: "image_url",
            image_url: {
              url: base64Image,
            },
          },
        ],
      },
    ],
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
    console.log("Vision Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Vision Error:", error);
  }
}

testVision();
