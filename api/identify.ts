import { arkGenerateText, arkModelVision, hasValidArkKey, json, readBody, stripBackticksAndTrim } from '../lib/ark.js';

export default async function handler(req: any, res: any) {
  try {
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
  const userText = `分两步完成：
第1步：判别图片类型 image_type："order_screenshot"（App订单/菜单/支付等界面截图）、"drink_photo"（实拍照片）、"product_screenshot"（商品/海报/产品卡截图）。
第2步：识别饮品信息，并给出裁剪建议（非常重要）：
- 对 order_screenshot：thumb_bbox 必须精确框选“商品缩略图/商品卡图”，优先靠近左侧/顶部列表中缩略图；
- 对 drink_photo：请输出饮品全身外轮廓 thumb_polygon（8~24 个点），tight_bbox 必须包含“杯底到杯盖/吸管顶”，四周留 2% 余量；
- 对 product_screenshot：一定要框选“饮品全身主体”，不要聚焦在商品文字/标题/价格/卖点文案区域；tight_bbox 必须包含饮品全身（杯底到杯盖/吸管顶），允许包含少量周边留白，但禁止只框文字。

字段要求：
{ 
  "image_type": "order_screenshot" | "drink_photo" | "product_screenshot",
  "brand": "string",
  "name": "string",
  "spec": "string",
  "cup_type": "string",
  "sweetness": "string",
  "flavor": "string",
  "price": number | null,
  "description": "string",
  "thumb_polygon": [{"x":number,"y":number}][] | null,
  "tight_bbox": {"x":number,"y":number,"w":number,"h":number} | null,
  "thumb_bbox": {"x":number,"y":number,"w":number,"h":number} | null
}
注意：
- order_screenshot 时，返回 thumb_bbox；thumb_polygon 和 tight_bbox 可为 null；
- drink_photo/product_screenshot 时，必须返回 tight_bbox；同时尽量返回 thumb_polygon；
- 数值一律 0~1 归一化。只返回 JSON。`;

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

  // 统一 thumb_bbox 输出：
  let thumbBBox = parsed?.tight_bbox || parsed?.thumb_bbox || null;
  if (!thumbBBox && Array.isArray(parsed?.thumb_polygon) && parsed.thumb_polygon.length >= 3) {
    const pts = parsed.thumb_polygon;
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const p of pts) {
      const x = Math.max(0, Math.min(1, Number(p?.x)));
      const y = Math.max(0, Math.min(1, Number(p?.y)));
      if (Number.isFinite(x) && Number.isFinite(y)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX > minX && maxY > minY) {
      // 加 2% 余量
      const pad = 0.02;
      const w = Math.min(1, Math.max(0, maxX - minX));
      const h = Math.min(1, Math.max(0, maxY - minY));
      const x = Math.max(0, minX - pad);
      const y = Math.max(0, minY - pad);
      thumbBBox = { x, y, w: Math.min(1 - x, w + pad * 2), h: Math.min(1 - y, h + pad * 2) };
    }
  }

  const imageType = typeof parsed?.image_type === 'string' ? parsed.image_type : '';
  if (thumbBBox && imageType === 'product_screenshot') {
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    const x = clamp01(Number(thumbBBox?.x));
    const y = clamp01(Number(thumbBBox?.y));
    const w = clamp01(Number(thumbBBox?.w));
    const h = clamp01(Number(thumbBBox?.h));
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      let nx = x;
      let ny = y;
      let nw = w;
      let nh = h;

      const area = w * h;
      const cx = x + w / 2;
      const cy = y + h / 2;

      // 商品截图经常把文字区域当主体，做强制“全身”扩展：
      const minW = 0.45;
      const minH = 0.75;

      if (nw < minW) nw = minW;
      if (nh < minH) nh = minH;

      // 尽量覆盖从靠近顶部到接近底部（杯顶/吸管顶 + 杯底）
      const targetTop = 0.03;
      const targetBottom = 0.97;
      if (ny > targetTop) ny = targetTop;
      if (ny + nh < targetBottom) nh = targetBottom - ny;

      // 以原中心为参考，水平居中扩展并保证不越界
      nx = clamp01(cx - nw / 2);
      if (nx + nw > 1) nx = 1 - nw;
      nx = clamp01(nx);

      // 兜底：如果面积仍然太小，扩大到一个更像“整杯”的范围
      if (area < 0.22) {
        nw = Math.max(nw, 0.55);
        nh = Math.max(nh, 0.82);
        nx = clamp01(cx - nw / 2);
        if (nx + nw > 1) nx = 1 - nw;
        ny = 0.02;
        if (ny + nh > 1) nh = 1 - ny;
      }

      thumbBBox = { x: nx, y: ny, w: nw, h: nh };
    }
  }

  const data = {
    image_type: imageType || null,
    brand: parsed?.brand || 'Unknown',
    name: parsed?.name || 'Drink',
    spec: parsed?.spec || parsed?.specs || '',
    cup_type: parsed?.cup_type || '',
    sweetness: parsed?.sweetness || '',
    flavor: parsed?.flavor || '',
    price: typeof parsed?.price === 'number' ? parsed.price : (typeof parsed?.price === 'string' ? Number(String(parsed.price).replace(/[^0-9.]/g, '')) || null : null),
    description: parsed?.description || '',
    thumb_bbox: thumbBBox || null
  };
    return json(res, data);
  } catch (e: any) {
    return json(res, { error: e?.message ? String(e.message) : 'Identify failed' }, 500);
  }
}
