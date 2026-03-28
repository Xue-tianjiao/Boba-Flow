import { arkModelImage, arkModelText, arkModelVision, hasValidArkKey, json, readBody, stripBackticksAndTrim, arkGenerateText } from './_ark';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
  const brand = typeof body?.brand === 'string' ? body.brand : '';
  const product = typeof body?.product === 'string' ? body.product : '';
  const recommendation = typeof body?.recommendation === 'string' ? body.recommendation : '';

  if (!hasValidArkKey) return json(res, { error: 'API key required' }, 400);

  let finalPrompt = prompt;

  if (!finalPrompt && brand && product) {
    let visualDescription = '';
    if (imageUrl) {
      try {
        const visionRes = await arkGenerateText({
          model: arkModelVision,
          system: 'You are a visual artist assistant. Describe the beverage in the image concisely for an AI image generator. Focus on: Cup shape, Drink color, Toppings, Layers, Garnish. Ignore background.',
          userParts: [
            { type: 'input_image', image_url: imageUrl },
            { type: 'input_text', text: 'Describe the drink visual appearance in English.' }
          ]
        });
        visualDescription = visionRes;
      } catch {
      }
    }

    finalPrompt = `High-quality social media poster for a drink.
Brand: ${brand}
Product: ${product}
Subject Visuals: ${visualDescription || 'A delicious, fresh drink'}
Context/Mood: "${recommendation || 'Highly Recommended!'}"
Style: Xiaohongshu Viral Style, Photo-Illustration Collage, Vibrant & Appetizing.
Composition: A central real-looking drink cup seamlessly integrated with hand-drawn doodles.
Background: Warm gradient or cream-colored.
Note: No people, focus on the drink.`;
  }

  if (!finalPrompt) return json(res, { error: 'Prompt or context required' }, 400);

  const baseUrl = stripBackticksAndTrim(process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
  const apiKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || '';
  const url = `${baseUrl}/images/generations`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model: arkModelImage, prompt: finalPrompt, size: '2048x2048', response_format: 'url' })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || data?.error) {
    const message = data?.error?.message || 'Generation failed';
    return json(res, { error: message }, 500);
  }

  const imgUrl = data?.data?.[0]?.url;
  if (!imgUrl) return json(res, { error: 'No image URL returned' }, 500);

  return json(res, { imageUrl: String(imgUrl) });
}

