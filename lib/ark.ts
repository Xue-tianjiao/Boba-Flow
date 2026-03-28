import type { IncomingHttpHeaders } from 'node:http';

type ArkMode = 'responses' | 'chat';

const arkBaseUrl = (process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
const arkApiKeyRaw = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || '';
const arkMode: ArkMode = process.env.ARK_API_MODE === 'chat' ? 'chat' : 'responses';
export const arkModelText = process.env.ARK_MODEL_TEXT || 'doubao-seed-2-0-pro-260215';
export const arkModelVision = process.env.ARK_MODEL_VISION || arkModelText;
export const arkModelImage = process.env.ARK_MODEL_IMAGE || 'doubao-seedream-5-0-260128';

export const hasValidArkKey =
  arkApiKeyRaw.length > 10 &&
  /^[\x00-\x7F]+$/.test(arkApiKeyRaw) &&
  !arkApiKeyRaw.toLowerCase().includes('your_') &&
  !arkApiKeyRaw.includes('你的');

export function stripBackticksAndTrim(value: string): string {
  const trimmed = String(value || '').trim();
  return trimmed.replace(/^`+/, '').replace(/`+$/, '').trim();
}

export function stripSimpleMarkdown(value: string): string {
  return String(value || '')
    .replace(/^\s{0,3}#{2,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/[\*#]/g, '')
    .trim();
}

async function arkPostJson<T>(pathname: string, body: any): Promise<T> {
  const url = `${stripBackticksAndTrim(arkBaseUrl)}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${arkApiKeyRaw}`
    },
    body: JSON.stringify(body)
  });

  const text = await res.text().catch(() => '');
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const message = json?.error?.message || json?.message || `Ark API request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

function extractTextFromArkPayload(payload: any): string {
  if (!payload) return '';
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (typeof payload.text === 'string') return payload.text;

  const choicesText = payload?.choices?.[0]?.message?.content;
  if (typeof choicesText === 'string') return choicesText;

  const output = payload?.output;
  if (Array.isArray(output)) {
    const collectText = (arr: any[], out: string[]) => {
      for (const c of arr) {
        const t = c?.text;
        if (typeof t === 'string' && t.trim()) out.push(t);
      }
    };

    const collectFromItem = (item: any, out: string[]) => {
      if (Array.isArray(item?.content)) collectText(item.content, out);
      if (Array.isArray(item?.summary)) collectText(item.summary, out);
      if (Array.isArray(item?.message?.content)) collectText(item.message.content, out);
    };

    for (const pass of ['non_reasoning', 'all'] as const) {
      const parts: string[] = [];
      for (const item of output) {
        if (pass === 'non_reasoning' && item?.type === 'reasoning') continue;
        collectFromItem(item, parts);
      }
      if (parts.length) return parts.join('\n');
    }
  }

  const responseContent = payload?.output?.[0]?.content;
  if (Array.isArray(responseContent)) {
    const parts = responseContent.map((c: any) => (typeof c?.text === 'string' ? c.text : '')).filter(Boolean);
    if (parts.length) return parts.join('\n');
  }

  return '';
}

export async function arkGenerateText(params: {
  model: string;
  system?: string;
  userParts: any[];
  tools?: any[];
}): Promise<string> {
  const { model, system, userParts, tools } = params;

  if (arkMode === 'responses') {
    const input: any[] = [];
    if (system) input.push({ role: 'system', content: [{ type: 'input_text', text: system }] });
    input.push({ role: 'user', content: userParts });
    const payload = await arkPostJson<any>('/responses', { model, input, thinking: { type: 'disabled' }, tools });
    const text = extractTextFromArkPayload(payload);
    if (text) return text;
  }

  const messages: any[] = [];
  if (system) messages.push({ role: 'system', content: system });
  const chatUserParts = userParts.map((p) => {
    if (p?.type === 'input_text') return { type: 'text', text: p.text };
    if (p?.type === 'input_image') return { type: 'image_url', image_url: { url: p.image_url } };
    return p;
  });
  messages.push({ role: 'user', content: chatUserParts });
  const payload = await arkPostJson<any>('/chat/completions', { model, messages, tools });
  return extractTextFromArkPayload(payload);
}

export async function arkGenerateChatText(params: {
  model: string;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools?: any[];
}): Promise<string> {
  const { model, system, messages, tools } = params;
  const cleaned = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 1200) }));

  if (arkMode === 'responses') {
    const input: any[] = [];
    if (system) input.push({ role: 'system', content: [{ type: 'input_text', text: system }] });
    for (const m of cleaned) input.push({ role: m.role, content: [{ type: 'input_text', text: m.content }] });
    const payload = await arkPostJson<any>('/responses', { model, input, thinking: { type: 'disabled' }, tools });
    return extractTextFromArkPayload(payload);
  }

  const chatMessages: any[] = [];
  if (system) chatMessages.push({ role: 'system', content: system });
  for (const m of cleaned) chatMessages.push({ role: m.role, content: m.content });
  const payload = await arkPostJson<any>('/chat/completions', { model, messages: chatMessages, tools });
  return extractTextFromArkPayload(payload);
}

export function json(res: any, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: any) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        raw = '';
        resolve(null);
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

export function getHeader(headers: IncomingHttpHeaders, key: string): string {
  const v = headers[key.toLowerCase()];
  return Array.isArray(v) ? String(v[0] || '') : String(v || '');
}

