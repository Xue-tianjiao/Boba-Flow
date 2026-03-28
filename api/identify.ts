import { arkGenerateText, arkModelVision, hasValidArkKey, json, readBody, stripBackticksAndTrim } from './_ark';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
  if (!imageBase64) return json(res, { error: 'Image required' }, 400);

  if (!hasValidArkKey) {
    return json(res, {
      brand: 'Unknown',
      name: '',
      spec: '',
      cup_type: '',
      sweetness: '',
      flavor: '',
      price: null,
      thumb_bbox: null,
      description: '未配置 ARK_API_KEY/DOUBAO_API_KEY，无法进行识别。',
      error: 'Missing ARK_API_KEY/DOUBAO_API_KEY'
    });
  }

  const safeMimeType = mimeType && mimeType.includes('/') ? mimeType : 'image/jpeg';
  const rawImageUrl = imageBase64.startsWith('http') || imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${safeMimeType};base64,${imageBase64}`;
  const imageUrl = stripBackticksAndTrim(rawImageUrl);

  const system = '你是一个饮品识别助手。必须严格输出 JSON，不要输出 markdown，不要输出多余文本。';
  const userText = `请识别图片中的饮品信息，尽量从杯身标签/Logo/颜色推断：
- brand: 品牌
- name: 品名
- spec: 规格（冰/热/去冰/少冰/加冰等）
- cup_type: 杯型（大杯/中杯/小杯等）
- sweetness: 甜度
- flavor: 风味（逗号分隔）
- price: 价格（数字；找不到留空）
- description: 1 句短评
- thumb_bbox: 代表饮品的核心图像区域 bbox 归一化坐标 {x,y,w,h} (0~1)

只返回 JSON：{ "brand": "string", "name": "string", "spec": "string", "cup_type": "string", "sweetness": "string", "flavor": "string", "price": 0.00, "description": "string", "thumb_bbox": {"x": 0, "y": 0, "w": 1, "h": 1} }`;

  let text = '';
  try {
    text = await arkGenerateText({
      model: arkModelVision,
      system,
      userParts: [
        { type: 'input_image', image_url: imageUrl },
        { type: 'input_text', text: userText }
      ]
    });
  } catch (e: any) {
    const message = e?.message ? String(e.message) : String(e);
    return json(res, {
      brand: 'Unknown',
      name: '',
      spec: '',
      cup_type: '',
      sweetness: '',
      flavor: '',
      price: null,
      thumb_bbox: null,
      description: `识别失败：${message}`,
      error: message
    });
  }

  const jsonMatch = String(text || '').match(/\{[\s\S]*\}/);
  let parsed: any = null;
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = null;
    }
  }

  const data = {
    brand: parsed?.brand || 'Unknown',
    name: parsed?.name || 'Drink',
    spec: parsed?.spec || parsed?.specs || '',
    cup_type: parsed?.cup_type || '',
    sweetness: parsed?.sweetness || '',
    flavor: parsed?.flavor || '',
    price: typeof parsed?.price === 'number' ? parsed.price : (typeof parsed?.price === 'string' ? Number(String(parsed.price).replace(/[^0-9.]/g, '')) || null : null),
    description: parsed?.description || '',
    thumb_bbox: parsed?.thumb_bbox || null
  };
  return json(res, data);
}

