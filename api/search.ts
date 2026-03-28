import { arkGenerateText, arkModelText, hasValidArkKey, json, readBody } from '../lib/ark';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!hasValidArkKey) return json(res, []);

  const system = '你是饮品新品信息整理助手。必须严格输出 JSON 数组，不要输出 markdown 或多余文字。';
  const userText = `围绕关键词“${query}”，给出 3 条“新品/热门饮品”条目。\n每条包含 title, summary, date(可用 YYYY-MM-DD 或 “近期”)。\n只返回 JSON 数组：[{"title":"","summary":"","date":""}]`;

  let text = '';
  try {
    text = await arkGenerateText({ model: arkModelText, system, userParts: [{ type: 'input_text', text: userText }] });
  } catch {
    return json(res, []);
  }
  const jsonMatch = String(text || '').match(/\[[\s\S]*\]/);
  try {
    return json(res, JSON.parse(jsonMatch ? jsonMatch[0] : '[]'));
  } catch {
    return json(res, []);
  }
}
