import { arkGenerateText, arkModelText, hasValidArkKey, json, readBody, stripBackticksAndTrim } from '../../lib/ark';

type InspirationTerm = {
  id: string;
  brand: string;
  product: string;
  summary: string;
  weight: number;
  source_urls: string[];
  launch_date: string;
  is_new: boolean;
  image_url?: string;
};

function safeParseJsonArray(text: string): any[] {
  const cleaned = stripBackticksAndTrim(text || '');
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeTerm(raw: any, idx: number): InspirationTerm | null {
  const brand = typeof raw?.brand === 'string' ? raw.brand.trim() : '';
  const product = typeof raw?.product === 'string' ? raw.product.trim() : '';
  const summary = typeof raw?.summary === 'string' ? raw.summary.trim() : '';
  const launch_date = typeof raw?.launch_date === 'string' ? raw.launch_date.trim() : '';
  const weight = Number.isFinite(raw?.weight) ? Number(raw.weight) : 50;
  const source_urls = Array.isArray(raw?.source_urls) ? raw.source_urls.filter((u: any) => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, 3) : [];
  const image_url = typeof raw?.image_url === 'string' && /^https?:\/\//i.test(raw.image_url) ? raw.image_url : '';
  if (!brand || !product || !summary || !/^\d{4}-\d{2}-\d{2}$/.test(launch_date) || source_urls.length === 0) return null;
  const is_new = Date.now() - new Date(launch_date).getTime() <= 1000 * 60 * 60 * 24 * 30;
  return {
    id: `${brand}-${product}-${idx}`,
    brand,
    product,
    summary,
    launch_date,
    weight: Math.max(1, Math.min(100, Math.floor(weight))),
    source_urls,
    is_new,
    image_url: image_url || undefined
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
    const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const limitRaw = body?.limit;
    const limit = Number.isFinite(limitRaw) ? Number(limitRaw) : typeof limitRaw === 'string' ? Number(limitRaw) : 8;
    const count = Math.max(1, Math.min(8, Number.isFinite(limit) ? Math.floor(limit) : 8));

  if (!hasValidArkKey) {
    const today = new Date().toISOString().slice(0, 10);
    const fallback: InspirationTerm[] = [
      { id: '喜茶-超级植物茶-0', brand: '喜茶', product: '超级植物茶', summary: '健康轻负担', weight: 80, source_urls: ['https://www.heytea.com'], launch_date: today, is_new: true },
      { id: '瑞幸-生椰拿铁-1', brand: '瑞幸', product: '生椰拿铁', summary: '椰香咖啡融合', weight: 75, source_urls: ['https://www.luckincoffee.com'], launch_date: today, is_new: true }
    ];
    return json(res, { terms: fallback.slice(0, count), cacheHit: true });
  }

  const system = '你是饮品情报编辑与信息抽取器。你必须使用 web_search 获取最新信息，并严格输出 JSON 数组，不要输出 Markdown，不要输出解释。';
  const userText = query
    ? `关键词：${query}\n请用 web_search 搜索并整理与该关键词相关的“饮品新品”词条，要求：\n- 输出最多 ${count} 条\n- 每一条都必须是近 3 个月内发布/上新（90 天内）\n- 每条包含：brand, product, summary(约18-28字), launch_date(YYYY-MM-DD), image_url(可空但禁止编造), weight(1-100), source_urls(2-3条)\n只返回 JSON 数组。`
    : `请用 web_search 搜索并整理“最近 3 个月内（90 天内）”中国市场热门饮品新品词条，要求：\n- 输出最多 ${count} 条\n- 覆盖多个品牌\n- 每条包含：brand, product, summary(约18-28字), launch_date(YYYY-MM-DD), image_url(可空但禁止编造), weight(1-100), source_urls(2-3条)\n只返回 JSON 数组。`;

    let text = '';
    try {
      text = await arkGenerateText({ model: arkModelText, system, userParts: [{ type: 'input_text', text: userText }], tools: [{ type: 'web_search' }] });
    } catch (e: any) {
      return json(res, { error: e?.message ? String(e.message) : 'Failed' }, 500);
    }

  const raw = safeParseJsonArray(text);
  const ninetyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 90;
  const terms: InspirationTerm[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const t = normalizeTerm(raw[i], i);
    if (!t) continue;
    const d = new Date(t.launch_date);
    if (!Number.isFinite(d.getTime()) || d.getTime() < ninetyDaysAgo) continue;
    terms.push(t);
  }
  const sorted = terms
    .sort((a, b) => {
      if (a.is_new !== b.is_new) return a.is_new ? -1 : 1;
      return b.weight - a.weight;
    })
    .slice(0, count);

    return json(res, { terms: sorted, cacheHit: false });
  } catch (e: any) {
    return json(res, { error: e?.message ? String(e.message) : 'Explore failed' }, 500);
  }
}
