import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] as any });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new Database("sipsnaps.db");

// Ensure public/uploads exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

type ArkMode = 'responses' | 'chat';

const arkBaseUrl = (process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
const arkApiKeyRaw = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || '';
const arkMode: ArkMode = process.env.ARK_API_MODE === 'chat' ? 'chat' : 'responses';
const arkModelText = process.env.ARK_MODEL_TEXT || 'doubao-seed-2-0-pro-260215';
const arkModelVision = process.env.ARK_MODEL_VISION || arkModelText;
const arkModelImage = process.env.ARK_MODEL_IMAGE || 'doubao-seedream-5-0-260128';

const hasValidArkKey =
  arkApiKeyRaw.length > 10 &&
  /^[\x00-\x7F]+$/.test(arkApiKeyRaw) &&
  !arkApiKeyRaw.toLowerCase().includes('your_') &&
  !arkApiKeyRaw.includes('你的');

function stripBackticksAndTrim(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^`+/, '').replace(/`+$/, '').trim();
}

function stripSimpleMarkdown(value: string): string {
  return String(value || '')
    .replace(/^\s{0,3}#{2,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/[\*#]/g, '')
    .trim();
}

function safeFileToken(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'guest';
}

function parseDataUrlImage(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl || '');
  if (!m) return null;
  const mime = m[1];
  const b64 = m[2].replace(/\s+/g, '');
  const buffer = Buffer.from(b64, 'base64');
  if (!buffer.length) return null;
  return { mime, buffer };
}

function toProxiedImageUrl(imageUrl: string): string {
  const u = (imageUrl || '').trim();
  if (!u) return '';
  return `/api/image-proxy?url=${encodeURIComponent(u)}`;
}

async function arkPostJson<T>(endpointPath: string, body: unknown): Promise<T> {
  const url = `${stripBackticksAndTrim(arkBaseUrl)}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${arkApiKeyRaw}`
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
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

async function arkGenerateText(params: {
  model: string;
  system?: string;
  userParts: any[];
  tools?: any[];
}): Promise<string> {
  const { model, system, userParts, tools } = params;

  if (arkMode === 'responses') {
    const input: any[] = [];
    if (system) {
      input.push({ role: 'system', content: [{ type: 'input_text', text: system }] });
    }
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

async function arkGenerateChatText(params: {
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
    for (const m of cleaned) {
      input.push({ role: m.role, content: [{ type: 'input_text', text: m.content }] });
    }
    const payload = await arkPostJson<any>('/responses', { model, input, thinking: { type: 'disabled' }, tools });
    return extractTextFromArkPayload(payload);
  }

  const chatMessages: any[] = [];
  if (system) chatMessages.push({ role: 'system', content: system });
  for (const m of cleaned) chatMessages.push({ role: m.role, content: m.content });
  const payload = await arkPostJson<any>('/chat/completions', { model, messages: chatMessages, tools });
  return extractTextFromArkPayload(payload);
}

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

const inspirationCache = new Map<string, { expiresAt: number; terms: InspirationTerm[] }>();
const inspirationImageCache = new Map<string, { expiresAt: number; imageUrl: string }>();
const nearbyCache = new Map<string, { expiresAt: number; payload: any }>();

function writeSse(res: any, event: string, payload: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sa)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

async function fetchJsonWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<any> {
  const timeoutMs = typeof init.timeoutMs === 'number' ? init.timeoutMs : 12000;
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    const text = await res.text();
    if (!res.ok) {
      const err: any = new Error(`Upstream ${res.status}`);
      err.status = res.status;
      err.body = text.slice(0, 500);
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch {
      const err: any = new Error('Invalid upstream JSON');
      err.body = text.slice(0, 500);
      throw err;
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeCityToPoint(city: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const q = city.trim();
  if (!q) return null;
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`;
    const data = await fetchJsonWithTimeout(photonUrl, {
      headers: { 'User-Agent': 'drinkme/1.0 (nearby; contact: none)', Accept: 'application/json' },
      timeoutMs: 9000
    });
    const feature = Array.isArray(data?.features) && data.features.length ? data.features[0] : null;
    const coords = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : null;
    const lng = Number(coords?.[0]);
    const lat = Number(coords?.[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const label = String(feature?.properties?.name || feature?.properties?.city || feature?.properties?.district || q);
      return { lat, lng, displayName: label };
    }
  } catch {
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
  const data = await fetchJsonWithTimeout(url, {
    headers: { 'User-Agent': 'drinkme/1.0 (nearby; contact: none)', Accept: 'application/json' },
    timeoutMs: 9000
  });
  if (!Array.isArray(data) || !data.length) return null;
  const item = data[0];
  const lat = Number(item?.lat);
  const lng = Number(item?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: String(item?.display_name || q) };
}

function buildOverpassQuery(params: { lat: number; lng: number; radiusMeters: number }): string {
  const r = Math.floor(params.radiusMeters);
  const lat = params.lat;
  const lng = params.lng;
  return [
    '[out:json][timeout:25];',
    '(',
    `  node(around:${r},${lat},${lng})["amenity"="cafe"];`,
    `  way(around:${r},${lat},${lng})["amenity"="cafe"];`,
    `  relation(around:${r},${lat},${lng})["amenity"="cafe"];`,
    `  node(around:${r},${lat},${lng})["shop"~"coffee|tea|bubble_tea",i];`,
    `  way(around:${r},${lat},${lng})["shop"~"coffee|tea|bubble_tea",i];`,
    `  relation(around:${r},${lat},${lng})["shop"~"coffee|tea|bubble_tea",i];`,
    `  node(around:${r},${lat},${lng})["amenity"="fast_food"]["cuisine"~"coffee|tea|bubble_tea",i];`,
    `  way(around:${r},${lat},${lng})["amenity"="fast_food"]["cuisine"~"coffee|tea|bubble_tea",i];`,
    `  relation(around:${r},${lat},${lng})["amenity"="fast_food"]["cuisine"~"coffee|tea|bubble_tea",i];`,
    ');',
    'out center 80;'
  ].join('\n');
}

async function fetchNearbyPlacesFromOverpass(params: { lat: number; lng: number; radiusMeters: number }): Promise<any[]> {
  const query = buildOverpassQuery(params);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
  ];

  let lastError: any = null;
  for (const ep of endpoints) {
    const url = `${ep}?data=${encodeURIComponent(query)}`;
    try {
      const data = await fetchJsonWithTimeout(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'drinkme/1.0 (nearby; contact: none)' },
        timeoutMs: 14000
      });
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      return elements;
    } catch (e: any) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
  return [];
}

function pickName(tags: any): string {
  const candidates = [tags?.name, tags?.['name:zh'], tags?.['brand'], tags?.['brand:zh'], tags?.operator];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function buildAddress(tags: any): { address: string; district?: string } {
  const full = typeof tags?.['addr:full'] === 'string' ? tags['addr:full'].trim() : '';
  if (full) return { address: full, district: typeof tags?.['addr:district'] === 'string' ? tags['addr:district'].trim() : undefined };
  const street = typeof tags?.['addr:street'] === 'string' ? tags['addr:street'].trim() : '';
  const hn = typeof tags?.['addr:housenumber'] === 'string' ? tags['addr:housenumber'].trim() : '';
  const city = typeof tags?.['addr:city'] === 'string' ? tags['addr:city'].trim() : '';
  const district = typeof tags?.['addr:district'] === 'string' ? tags['addr:district'].trim() : '';
  const parts = [city, district, street, hn].filter(Boolean);
  return { address: parts.join(' '), district: district || undefined };
}

function classifyPlace(tags: any): 'coffee' | 'tea' | 'drink' | 'other' {
  const amenity = typeof tags?.amenity === 'string' ? tags.amenity.toLowerCase() : '';
  const shop = typeof tags?.shop === 'string' ? tags.shop.toLowerCase() : '';
  const cuisine = typeof tags?.cuisine === 'string' ? tags.cuisine.toLowerCase() : '';
  if (amenity === 'cafe' || shop === 'coffee') return 'coffee';
  if (shop === 'tea' || shop === 'bubble_tea' || cuisine.includes('bubble_tea')) return 'tea';
  if (cuisine.includes('tea') || cuisine.includes('coffee')) return 'drink';
  return 'other';
}

function buildOsmMapUrl(lat: number, lng: number, name?: string): string {
  const base = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=18/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`;
  if (!name) return base;
  return `${base}&query=${encodeURIComponent(name)}`;
}

function isPrivateOrLocalhostHost(host: string): boolean {
  const h = (host || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h === '0.0.0.0' || h === '127.0.0.1' || h === '::1') return true;
  if (h.endsWith('.local')) return true;

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const n = ipv4.slice(1).map((x) => Number(x));
    if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
    const [a, b] = n;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
}

function extractImageFromHtml(html: string, baseUrl: string): string {
  const pick = (tag: string): string => {
    const m = tag.match(/content\s*=\s*["']([^"']+)["']/i);
    return m?.[1] ? String(m[1]).trim() : '';
  };

  const patterns: Array<{ key: string; pattern: RegExp }> = [
    { key: 'og:image', pattern: /<meta[^>]*property\s*=\s*["']og:image["'][^>]*>/i },
    { key: 'twitter:image', pattern: /<meta[^>]*name\s*=\s*["']twitter:image["'][^>]*>/i },
    { key: 'image', pattern: /<meta[^>]*itemprop\s*=\s*["']image["'][^>]*>/i }
  ];

  for (const p of patterns) {
    const tagMatch = html.match(p.pattern);
    const tag = tagMatch?.[0] ? String(tagMatch[0]) : '';
    if (!tag) continue;
    const url = pick(tag);
    if (!url) continue;
    try {
      const abs = new URL(url, baseUrl).toString();
      if (abs.startsWith('http://') || abs.startsWith('https://')) return abs;
    } catch {
    }
  }

  return '';
}

function isDirectImageUrl(url: string): boolean {
  const u = (url || '').trim();
  return u.startsWith('http://') || u.startsWith('https://');
}

async function arkSearchImageUrlForTerm(params: { brand: string; product: string }): Promise<string> {
  if (!hasValidArkKey) return '';
  const brand = params.brand.trim();
  const product = params.product.trim();
  if (!brand || !product) return '';

  const system =
    '你是图片来源链接提取器。你必须使用 web_search，并且只返回一个纯 JSON 对象，不要 Markdown，不要解释。' +
    'JSON 格式：{"image_url":"","page_url":""}。优先填写 image_url（图片直链，jpg/jpeg/png/webp/gif）。' +
    '如果找不到直链，请填写 page_url（包含该饮品宣传图/新闻配图的网页链接），image_url 留空。';
  const userText = `请搜索“${brand} ${product}”的官方宣传图或新闻配图。优先给出 1 条图片直链；如果没有直链，请给出包含该图的网页链接。`;

  let text = '';
  try {
    text = await arkGenerateText({
      model: arkModelText,
      system,
      userParts: [{ type: 'input_text', text: userText }],
      tools: [{ type: 'web_search' }]
    });
  } catch {
    return '';
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return '';
  try {
    const parsed = JSON.parse(match[0]);
    const imageUrl = typeof parsed?.image_url === 'string' ? parsed.image_url.trim() : '';
    if (isDirectImageUrl(imageUrl)) return imageUrl;

    const pageUrl = typeof parsed?.page_url === 'string' ? parsed.page_url.trim() : '';
    if (pageUrl.startsWith('http://') || pageUrl.startsWith('https://')) {
      const extracted = await resolveImageFromSourceUrl(pageUrl);
      return extracted;
    }

    return '';
  } catch {
    return '';
  }
}

async function resolveImageFromSourceUrl(sourceUrl: string): Promise<string> {
  const key = (sourceUrl || '').trim();
  if (!key) return '';
  const cached = inspirationImageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.imageUrl;

  let u: URL;
  try {
    u = new URL(key);
  } catch {
    return '';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  if (isPrivateOrLocalhostHost(u.hostname)) return '';

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 3500);
  try {
    const res = await fetch(key, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const contentType = String(res.headers.get('content-type') || '');
    if (contentType.startsWith('image/')) {
      const imageUrl = res.url || key;
      inspirationImageCache.set(key, { expiresAt: Date.now() + 1000 * 60 * 30, imageUrl });
      return imageUrl;
    }

    const html = await res.text();
    const imageUrl = extractImageFromHtml(html, res.url || key);
    inspirationImageCache.set(key, { expiresAt: Date.now() + 1000 * 60 * 10, imageUrl });
    return imageUrl;
  } catch {
    inspirationImageCache.set(key, { expiresAt: Date.now() + 1000 * 60 * 2, imageUrl: '' });
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveTermImageUrl(term: InspirationTerm): Promise<string> {
  if (term.image_url) {
    if (term.image_url.startsWith('/api/image-proxy?url=')) return term.image_url;
    const resolved = await resolveImageFromSourceUrl(term.image_url);
    return resolved || '';
  }
  const urls = Array.isArray(term.source_urls) ? term.source_urls : [];
  for (const u of urls) {
    const img = await resolveImageFromSourceUrl(u);
    if (img) return img;
  }
  return '';
}

function safeParseJsonArray(text: string): any[] {
  const cleaned = stripBackticksAndTrim(text);
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseLaunchDate(input: any): Date | null {
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  const s = typeof input === 'string' ? input.trim() : '';
  if (!s) return null;

  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const slash = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    const d = new Date(`${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const zh = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (zh) {
    const d = new Date(`${zh[1]}-${zh[2].padStart(2, '0')}-${zh[3].padStart(2, '0')}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function normalizeTerm(raw: any, index: number): InspirationTerm | null {
  const brand = typeof raw?.brand === 'string' ? raw.brand.trim() : '';
  const product = typeof raw?.product === 'string' ? raw.product.trim() : (typeof raw?.name === 'string' ? raw.name.trim() : '');
  const summary = typeof raw?.summary === 'string' ? raw.summary.trim() : (typeof raw?.ai_summary === 'string' ? raw.ai_summary.trim() : '');
  const weightRaw = raw?.weight;
  const weight = Number.isFinite(weightRaw) ? Number(weightRaw) : (typeof weightRaw === 'string' ? Number(weightRaw) : NaN);
  const normalizedWeight = Number.isFinite(weight) ? Math.max(1, Math.min(100, Math.round(weight))) : 50;
  const sourceUrls = Array.isArray(raw?.source_urls) ? raw.source_urls.filter((u: any) => typeof u === 'string' && u.startsWith('http')).slice(0, 3) : [];
  const imageUrlRaw = typeof raw?.image_url === 'string'
    ? raw.image_url
    : (typeof raw?.product_image === 'string' ? raw.product_image : (typeof raw?.image === 'string' ? raw.image : ''));
  const imageUrlClean = typeof imageUrlRaw === 'string' && (imageUrlRaw.startsWith('http://') || imageUrlRaw.startsWith('https://')) ? imageUrlRaw.trim() : '';
  const launchDateRaw = raw?.launch_date;
  const launchDate = parseLaunchDate(launchDateRaw);
  if (!launchDate) return null;
  const launchDateIso = launchDate.toISOString().slice(0, 10);
  const now = Date.now();
  const isNew30d = launchDate.getTime() >= now - 1000 * 60 * 60 * 24 * 30;

  if (!brand || !product || !summary) return null;
  const id = `${brand}-${product}-${index}`.replace(/\s+/g, '-');
  return {
    id,
    brand,
    product,
    summary,
    weight: normalizedWeight,
    source_urls: sourceUrls,
    launch_date: launchDateIso,
    is_new: isNew30d,
    image_url: imageUrlClean || undefined
  };
}

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS drink_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT, name TEXT, specs TEXT, image_url TEXT, avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS daily_drops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT, brand_name TEXT, product_image TEXT, ai_summary TEXT, launch_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    answers TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    beverage_name TEXT,
    beverage_image_url TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    user_name TEXT,
    user_avatar TEXT,
    content TEXT,
    image_url TEXT,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    post_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    user_name TEXT,
    user_avatar TEXT,
    post_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS amway_feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    brand_name TEXT,
    product_name TEXT,
    recommendation_text TEXT,
    poster_image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    user_id TEXT PRIMARY KEY,
    avatar_url TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sidebar_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    group_key TEXT NOT NULL CHECK (group_key IN ('want','recommend')),
    title TEXT NOT NULL,
    note TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sidebar_items_user_group_created
  ON sidebar_items(user_id, group_key, created_at DESC);
`);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Serve uploads statically
  app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
  app.use('/ads', express.static(path.join(__dirname, 'public/ads')));
  app.use('/picture', express.static(path.join(__dirname, 'public/picture')));
  app.use('/explore', express.static(path.join(__dirname, 'public/explore')));

  // --- API Routes ---

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasArkKey: hasValidArkKey,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasArkBaseUrl: Boolean(process.env.ARK_BASE_URL),
      hasModelText: Boolean(process.env.ARK_MODEL_TEXT),
      hasModelVision: Boolean(process.env.ARK_MODEL_VISION),
      hasModelImage: Boolean(process.env.ARK_MODEL_IMAGE)
    });
  });

  app.get('/api/ads/pictures', (_req, res) => {
    try {
      const candidates = [
        { dir: path.join(__dirname, 'public', 'ads', 'picture'), baseUrl: '/ads/picture/' },
        { dir: path.join(__dirname, 'public', 'picture'), baseUrl: '/picture/' }
      ];

      const urls: string[] = [];
      const seen = new Set<string>();
      for (const c of candidates) {
        if (!fs.existsSync(c.dir)) continue;
        const files = fs.readdirSync(c.dir);
        for (const file of files) {
          if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) continue;
          const url = `${c.baseUrl}${encodeURIComponent(file)}`;
          if (seen.has(url)) continue;
          seen.add(url);
          urls.push(url);
        }
      }

      urls.sort((a, b) => a.localeCompare(b));
      res.json({ urls });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to list ad pictures' });
    }
  });

  app.get('/api/explore/pictures', (_req, res) => {
    try {
      const dir = path.join(__dirname, 'public', 'explore', 'picture');
      const baseUrl = '/explore/picture/';
      const urls: string[] = [];
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) continue;
          urls.push(`${baseUrl}${encodeURIComponent(file)}`);
        }
      }
      urls.sort((a, b) => a.localeCompare(b));
      res.json({ urls });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to list explore pictures' });
    }
  });

  app.get('/api/sidebar/items', (req, res) => {
    try {
      const group = typeof req.query?.group === 'string' ? req.query.group.trim() : '';
      const userId = typeof req.query?.userId === 'string' ? req.query.userId.trim() : 'guest';
      if (group !== 'want' && group !== 'recommend') return res.status(400).json({ error: 'Invalid group' });

      const rows = db
        .prepare(
          'SELECT id, user_id, group_key, title, note, image_url, created_at, updated_at FROM sidebar_items WHERE user_id = ? AND group_key = ? ORDER BY created_at DESC'
        )
        .all(userId || 'guest', group);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to list sidebar items' });
    }
  });

  app.post('/api/sidebar/items', (req, res) => {
    try {
      const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : 'guest';
      const group = typeof req.body?.group === 'string' ? req.body.group.trim() : '';
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';

      if (group !== 'want' && group !== 'recommend') return res.status(400).json({ error: 'Invalid group' });
      if (!title) return res.status(400).json({ error: 'Missing title' });

      const safeTitle = title.slice(0, 60);
      const safeNote = note.slice(0, 280);
      const safeImageUrl = imageUrl.slice(0, 500);

      const stmt = db.prepare(
        'INSERT INTO sidebar_items (user_id, group_key, title, note, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
      );
      const info = stmt.run(userId || 'guest', group, safeTitle, safeNote, safeImageUrl);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to create sidebar item' });
    }
  });

  app.put('/api/sidebar/items/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : undefined;
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : undefined;

      const updates: string[] = [];
      const values: any[] = [];

      if (typeof title === 'string') {
        const t = title.slice(0, 60);
        if (!t) return res.status(400).json({ error: 'Title cannot be empty' });
        updates.push('title = ?');
        values.push(t);
      }
      if (typeof note === 'string') {
        updates.push('note = ?');
        values.push(note.slice(0, 280));
      }
      if (typeof imageUrl === 'string') {
        updates.push('image_url = ?');
        values.push(imageUrl.slice(0, 500));
      }

      if (!updates.length) return res.json({ success: true });
      updates.push('updated_at = CURRENT_TIMESTAMP');

      values.push(id);
      const stmt = db.prepare(`UPDATE sidebar_items SET ${updates.join(', ')} WHERE id = ?`);
      const info = stmt.run(...values);
      if (info.changes > 0) return res.json({ success: true });
      return res.status(404).json({ error: 'Item not found' });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to update sidebar item' });
    }
  });

  app.delete('/api/sidebar/items/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
      const stmt = db.prepare('DELETE FROM sidebar_items WHERE id = ?');
      const info = stmt.run(id);
      if (info.changes > 0) return res.json({ success: true });
      return res.status(404).json({ error: 'Item not found' });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to delete sidebar item' });
    }
  });

  app.get('/api/profile', (req, res) => {
    try {
      const userId = typeof req.query?.userId === 'string' ? req.query.userId.trim() : 'guest';
      const row = db
        .prepare('SELECT user_id, avatar_url, updated_at FROM user_profile WHERE user_id = ?')
        .get(userId || 'guest');
      if (row) return res.json(row);
      return res.json({ user_id: userId || 'guest', avatar_url: '', updated_at: new Date().toISOString() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to get profile' });
    }
  });

  app.put('/api/profile', (req, res) => {
    try {
      const userId = typeof req.query?.userId === 'string' ? req.query.userId.trim() : 'guest';
      const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl.trim() : '';

      let storedUrl = '';

      const parsed = parseDataUrlImage(avatarUrl);
      if (parsed) {
        if (parsed.buffer.byteLength > 2 * 1024 * 1024) return res.status(413).json({ error: 'Avatar too large' });
        const token = safeFileToken(userId || 'guest');
        const filename = `avatar-${token}-${Date.now()}.png`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, parsed.buffer);
        storedUrl = `/uploads/${filename}`;
      } else {
        storedUrl = avatarUrl.slice(0, 2000);
      }

      db.prepare(
        'INSERT INTO user_profile (user_id, avatar_url, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET avatar_url = excluded.avatar_url, updated_at = CURRENT_TIMESTAMP'
      ).run(userId || 'guest', storedUrl);

      res.json({ success: true, avatar_url: storedUrl });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to update profile' });
    }
  });

  app.post('/api/uploads/data-url', (req, res) => {
    try {
      const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : 'guest';
      const keyRaw = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
      const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl.trim() : '';
      const parsed = parseDataUrlImage(dataUrl);
      if (!parsed) return res.status(400).json({ error: 'Invalid dataUrl' });
      if (parsed.buffer.byteLength > 4 * 1024 * 1024) return res.status(413).json({ error: 'Image too large' });

      const token = safeFileToken(userId || 'guest');
      const safeKey = safeFileToken(keyRaw || 'image');
      const filename = `upload-${token}-${safeKey}.png`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, parsed.buffer);
      res.json({ url: `/uploads/${filename}` });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to upload image' });
    }
  });

  app.get('/api/image-proxy', async (req, res) => {
    try {
      const raw = typeof req.query?.url === 'string' ? req.query.url : '';
      if (!raw) return res.status(400).json({ error: 'Missing url' });

      let u: URL;
      try {
        u = new URL(raw);
      } catch {
        return res.status(400).json({ error: 'Invalid url' });
      }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return res.status(400).json({ error: 'Invalid protocol' });
      if (isPrivateOrLocalhostHost(u.hostname)) return res.status(400).json({ error: 'Blocked host' });

      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 4000);
      const upstream = await fetch(u.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: ac.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      clearTimeout(timeout);

      if (!upstream.ok) return res.status(502).json({ error: `Upstream ${upstream.status}` });
      const contentType = String(upstream.headers.get('content-type') || '');
      if (!contentType.startsWith('image/')) return res.status(415).json({ error: 'Upstream is not image' });

      const ab = await upstream.arrayBuffer();
      if (ab.byteLength > 4 * 1024 * 1024) return res.status(413).json({ error: 'Image too large' });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(ab));
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Proxy failed' });
    }
  });

  app.get('/api/places/nearby', async (req, res) => {
    try {
      const latRaw = typeof req.query?.lat === 'string' ? req.query.lat : '';
      const lngRaw = typeof req.query?.lng === 'string' ? req.query.lng : '';
      const radiusRaw = typeof req.query?.radius === 'string' ? req.query.radius : '';
      const cityRaw = typeof req.query?.city === 'string' ? req.query.city : '';

      const radiusMeters = clampNumber(Number(radiusRaw || 2000), 300, 8000);

      let mode: 'precise' | 'city' = 'precise';
      const latVal = latRaw.trim() ? Number(latRaw) : NaN;
      const lngVal = lngRaw.trim() ? Number(lngRaw) : NaN;
      let center = { lat: latVal, lng: lngVal };
      let cityDisplayName = '';

      const hasCoords = Number.isFinite(center.lat) && Number.isFinite(center.lng);
      const hasCity = Boolean(cityRaw && cityRaw.trim());
      if (!hasCoords) {
        if (!hasCity) return res.status(400).json({ error: 'Missing lat/lng or city' });
        mode = 'city';
        const geoKey = `geo::${cityRaw.trim().toLowerCase()}`;
        const cachedGeo = nearbyCache.get(geoKey);
        if (cachedGeo && cachedGeo.expiresAt > Date.now()) {
          center = cachedGeo.payload.center;
          cityDisplayName = cachedGeo.payload.displayName;
        } else {
          const geo = await geocodeCityToPoint(cityRaw);
          if (!geo) return res.status(404).json({ error: 'City not found' });
          center = { lat: geo.lat, lng: geo.lng };
          cityDisplayName = geo.displayName;
          nearbyCache.set(geoKey, { expiresAt: Date.now() + 1000 * 60 * 60 * 6, payload: { center, displayName: cityDisplayName } });
        }
      }

      const cacheKey = `nearby::${mode}::${center.lat.toFixed(5)},${center.lng.toFixed(5)}::${radiusMeters}`;
      const cached = nearbyCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return res.json(cached.payload);

      const elements = await fetchNearbyPlacesFromOverpass({ lat: center.lat, lng: center.lng, radiusMeters });
      const origin = { lat: center.lat, lng: center.lng };
      const places = elements
        .map((el: any) => {
          const tags = el?.tags || {};
          const name = pickName(tags);
          if (!name) return null;
          const lat = Number(el?.lat ?? el?.center?.lat);
          const lng = Number(el?.lon ?? el?.center?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const { address, district } = buildAddress(tags);
          const distanceMeters = mode === 'precise' ? Math.round(haversineMeters(origin, { lat, lng })) : undefined;
          const category = classifyPlace(tags);
          return {
            id: `${String(el?.type || 'osm')}:${String(el?.id || name)}`,
            name,
            category,
            address: address || (district ? district : ''),
            district: district || undefined,
            distanceMeters,
            location: { lat, lng },
            mapUrl: buildOsmMapUrl(lat, lng, name)
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => {
          if (mode === 'precise') return (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0);
          return String(a.name).localeCompare(String(b.name));
        })
        .slice(0, 20);

      const payload = {
        mode,
        center: { lat: center.lat, lng: center.lng },
        cityDisplayName: cityDisplayName || undefined,
        places
      };
      nearbyCache.set(cacheKey, { expiresAt: Date.now() + 1000 * 60 * 3, payload });
      res.json(payload);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to fetch nearby places' });
    }
  });

  // 1. Scan Drink (Doubao Vision via Ark)
  app.post("/api/identify", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body; // Expect base64 string without prefix
      if (!imageBase64) return res.status(400).json({ error: "Image required" });

      if (!hasValidArkKey) {
        return res.json({
          brand: "Unknown",
          name: "",
          spec: "",
          cup_type: "",
          sweetness: "",
          flavor: "",
          price: null,
          thumb_bbox: null,
          description: "未配置 ARK_API_KEY/DOUBAO_API_KEY，无法进行识别。",
          error: "Missing ARK_API_KEY/DOUBAO_API_KEY"
        });
      }

      const safeMimeType = typeof mimeType === 'string' && mimeType.includes('/') ? mimeType : 'image/jpeg';
      const rawImageUrl = imageBase64.startsWith('http') || imageBase64.startsWith('data:')
        ? imageBase64
        : `data:${safeMimeType};base64,${imageBase64}`;
      const imageUrl = stripBackticksAndTrim(rawImageUrl);

      const system = '你是一个饮品识别助手。必须严格输出 JSON，不要输出 markdown，不要输出多余文本。';
      const userText = `请识别图片中的饮品信息，尽量从杯身标签/Logo/颜色推断：\n- brand: 品牌（如 喜茶、星巴克）\n- name: 品名（如 多肉葡萄）\n- spec: 规格（如 冰/热/去冰/少冰/加冰）\n- cup_type: 杯型（如 大杯/中杯/小杯）\n- sweetness: 甜度（如 标准/少糖/无糖/五分糖）\n- flavor: 风味（如 香草风味、燕麦、芝士等，可用逗号分隔）\n- price: 价格（数字，精确到小数点后2位。如果是订单/菜单截图，请优先识别价格；如果找不到则留空）\n- description: 1 句短评\n- thumb_bbox: 请视觉定位图片中代表该饮品的“核心图像区域”。\n  - 如果是App订单/菜单截图，请精确框选“左侧/顶部的商品缩略图”。\n  - 如果是实拍照片，请框选“杯身主体”或“拉花特写”。\n  - 返回归一化坐标 {x,y,w,h} (0~1)，尽量紧凑。 \n\n只返回 JSON：{ "brand": "string", "name": "string", "spec": "string", "cup_type": "string", "sweetness": "string", "flavor": "string", "price": 0.00, "description": "string", "thumb_bbox": {"x": 0, "y": 0, "w": 1, "h": 1} }`;

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
        console.error('Ark Identify Error:', message);
        return res.json({
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
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let parsed: any = null;
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e: any) {
          const message = e?.message ? String(e.message) : String(e);
          console.error('Identify JSON Parse Error:', message, 'raw:', text.slice(0, 200));
          return res.json({
            brand: 'Unknown',
            name: '',
            spec: '',
            cup_type: '',
            sweetness: '',
            flavor: '',
            price: null,
            thumb_bbox: null,
            description: '识别结果解析失败（模型返回了非标准 JSON）。',
            error: 'Invalid JSON from model'
          });
        }
      }
      const data = {
        brand: parsed?.brand || "Unknown",
        name: parsed?.name || "Drink",
        spec: parsed?.spec || parsed?.specs || "",
        cup_type: parsed?.cup_type || "",
        sweetness: parsed?.sweetness || "",
        flavor: parsed?.flavor || "",
        price: typeof parsed?.price === 'number' ? parsed.price : (typeof parsed?.price === 'string' ? Number(String(parsed.price).replace(/[^0-9.]/g, '')) || null : null),
        description: parsed?.description || "",
        thumb_bbox: parsed?.thumb_bbox || null
      };
      res.json(data);
    } catch (error) {
      console.error("Identify Error:", error);
      res.status(500).json({ error: "Failed to identify drink" });
    }
  });

  // 2. Search & Refine (Doubao via Ark)
  app.post("/api/search", async (req, res) => {
    try {
      const { query } = req.body;

      if (!hasValidArkKey) return res.json([]);

      const system = '你是饮品新品信息整理助手。必须严格输出 JSON 数组，不要输出 markdown 或多余文字。';
      const userText = `围绕关键词“${query}”，给出 3 条“新品/热门饮品”条目。\n每条包含 title, summary, date(可用 YYYY-MM-DD 或 “近期”)。\n只返回 JSON 数组：[{"title":"","summary":"","date":""}]`;

      let text = '';
      try {
        text = await arkGenerateText({
          model: arkModelText,
          system,
          userParts: [{ type: 'input_text', text: userText }]
        });
      } catch (e) {
        console.error('Ark Search Error:', e);
        return res.json([]);
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      res.json(JSON.parse(jsonMatch ? jsonMatch[0] : '[]'));
    } catch (error) {
      console.error("Search Error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const messages = rawMessages
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12)
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1200) }));

      if (!hasValidArkKey) {
        return res.json({ reply: '未配置 DOUBAO/ARK Key，暂时无法使用 AI 对话。请先在 .env.local 配置 ARK_API_KEY/DOUBAO_API_KEY。' });
      }

      const system = `一、核心身份与定位
你是专业级AI饮品服务助手，核心定位为「饮品领域专精+通用问答兼容」的复合型智能助手：既要在饮品相关需求中做到极致专业、精准、实用，也要具备常规AI助手的全场景通用问答能力，不局限于单一领域，兼顾专业性与通用性，响应所有合规合理的用户提问。

二、核心职能划分
（一）核心专精职能：饮品专属服务（优先响应，深度专业）
针对用户的饮品相关需求，严格按照以下标准执行，聚焦新式茶饮、咖啡、潮流特饮三大核心品类，重点覆盖奶茶、果茶、鲜萃咖啡、拿铁、特调咖啡、小众特色饮品等主流品类。

1) 新品精准检索与推送：优先用 web_search 聚焦近 1-3 个月内国内主流连锁品牌/小众网红/区域特色品牌的新上新饮品。排除旧款复刻、常规改版的非新品；按品类、品牌、上市时间分类；标注核心亮点、口感特质、上市渠道；杜绝过时信息、虚假新品信息。
2) 饮品参数精准输出：当用户询问具体饮品时，尽量输出糖分档位（无糖/三分/五分/七分/全糖，若品牌支持请区分蔗糖/代糖/果糖等）、可选冰度/温度、热量参考、配料构成、口感风味；参数尽量贴合品牌官方或可靠来源。无法确认的参数必须明确说明“不确定/需以门店/官方为准”，禁止主观臆造。控糖/减脂需求需额外给低糖/无糖适配方案。
3) 个性化推荐服务：结合口味偏好、饮用场景、人群需求给针对性推荐；推荐逻辑清晰，每款附简短理由，兼顾热门款与小众宝藏款，避免单一化。
4) 饮品相关答疑：解答点单技巧、踩雷避坑、搭配建议、品牌特色、制作原理等；语言通俗易懂但保持专业。

（二）通用兼容职能：全领域常规问答
对于非饮品领域的用户提问，按通用AI助手标准回应：准确、友好、条理清晰，不推诿、不刻意局限领域；饮品相关问题自动切换为专精模式。

三、整体回答准则与规范
1) 信息真实性原则：饮品相关信息严禁编造；新品/参数/品牌信息优先以官方发布或可靠来源为准；不确定必须明确告知。
2) 输出条理原则：推荐/参数类内容优先分点或分类输出，重点信息简洁突出。
3) 语气适配原则：饮品场景亲切专业，通用问答中立友好；全程合规。
4) 优先级原则：若用户同时提出饮品问题+通用问题，先完整解答饮品，再回应通用，不遗漏。

四、禁用行为
严禁编造虚假饮品信息、夸大饮品功效、推荐违规饮品；严禁推诿通用问题、拒绝合理问答；不输出违规、低俗、误导性内容。

输出格式偏好（饮品场景）：
- 先给 3 个可点到的推荐（品牌 + 饮品名 + 1 句理由）
- 再给 1-2 个追问以补全偏好
- 若涉及新品/联名/活动等时效信息，优先用 web_search 核实；不要贴大段链接，可给 1-2 个关键来源域名/标题提示即可。`;

      const outputRule = '重要：输出必须是纯文本，不要使用 Markdown 符号或格式（例如不要出现 ###、**、__、```）。';

      let reply = '';
      try {
        reply = await arkGenerateChatText({
          model: arkModelText,
          system: `${system}\n\n${outputRule}`,
          messages: messages.length ? messages : [{ role: 'user', content: '帮我推荐今天适合喝的饮品。' }],
          tools: [{ type: 'web_search' }]
        });
      } catch {
        const fallback =
          '我这边暂时连不上豆包服务，但我可以先给你一个不依赖联网的推荐：\n' +
          '1) 瑞幸：生椰拿铁（低糖可选），椰香顺口不腻\n' +
          '2) 星巴克：冰美式（无糖），清爽提神\n' +
          '3) 喜茶：清爽果茶（少糖/微糖），适合想喝点甜但控糖\n' +
          '你更偏咖啡还是茶饮？能接受冰的还是热的？';
        reply = fallback;
      }

      res.json({ reply: stripSimpleMarkdown(stripBackticksAndTrim(reply)) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message ? String(error.message) : 'Assistant chat failed' });
    }
  });

  // 2.1 Inspiration Explore (Doubao + web_search)
  // - query 为空：随机分发“最新/热门”灵感词条
  // - query 有值：围绕品牌/配料/单品关键词给出跨品牌联想词条
  app.post('/api/inspiration/explore', async (req, res) => {
    const wantsStream = req.body?.stream === true || String(req.headers?.accept || '').includes('text/event-stream');
    let streamClosed = false;
    let streamStarted = false;
    const initStream = (startPayload?: any) => {
      if (!wantsStream) return;
      if (!res.headersSent) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof res.flushHeaders === 'function') res.flushHeaders();
        res.on('close', () => {
          streamClosed = true;
        });
      }
      if (!streamStarted && startPayload) {
        streamStarted = true;
        writeSse(res, 'start', startPayload);
      }
    };

    try {
      const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      const force = req.body?.force === true;
      const douyinOnly = req.body?.douyin_only === true || req.body?.douyinOnly === true;
      const includeImages = req.body?.include_images === true || req.body?.includeImages === true;
      const limitRaw = req.body?.limit;
      const limit = Number.isFinite(limitRaw) ? Number(limitRaw) : (typeof limitRaw === 'string' ? Number(limitRaw) : 8);
      const count = Math.max(1, Math.min(8, Number.isFinite(limit) ? Math.floor(limit) : 8));
      const cacheKey = `${query || '__TRENDING__'}::NEW90D_PREF30D${douyinOnly ? '_DOUYIN' : ''}::${count}`;

      const cached = inspirationCache.get(cacheKey);
      if (!force && cached && cached.expiresAt > Date.now()) {
        if (wantsStream) {
          res.status(200);
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          let closed = false;
          res.on('close', () => {
            closed = true;
          });
          for (const term of cached.terms) {
            if (closed) break;
            writeSse(res, 'term', term);
            await sleep(25);
          }
          if (!closed) writeSse(res, 'done', { cacheHit: true });
          return res.end();
        }
        return res.json({ terms: cached.terms, cacheHit: true });
      }

      if (!hasValidArkKey) {
        const today = new Date().toISOString().slice(0, 10);
        const fallback: InspirationTerm[] = [
          { id: '喜茶-超级植物茶-0', brand: '喜茶', product: '超级植物茶', summary: '健康轻负担', weight: 80, source_urls: [], launch_date: today, is_new: true },
          { id: '瑞幸-生椰拿铁-1', brand: '瑞幸', product: '生椰拿铁', summary: '椰香咖啡融合', weight: 75, source_urls: [], launch_date: today, is_new: true },
          { id: '奈雪的茶-每日500蔬果瓶-2', brand: '奈雪的茶', product: '每日500蔬果瓶', summary: '真蔬果+0添加糖', weight: 70, source_urls: [], launch_date: today, is_new: true },
          { id: '星巴克-冰美式-3', brand: '星巴克', product: '冰美式', summary: '清爽提神', weight: 60, source_urls: [], launch_date: today, is_new: true }
        ];
        const terms = fallback.slice(0, count);
        if (wantsStream) {
          res.status(200);
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          let closed = false;
          res.on('close', () => {
            closed = true;
          });
          for (const term of terms) {
            if (closed) break;
            writeSse(res, 'term', term);
            await sleep(25);
          }
          if (!closed) writeSse(res, 'done', { cacheHit: true });
          return res.end();
        }
        return res.json({ terms, cacheHit: true });
      }

      const system = '你是饮品情报编辑与信息抽取器。你必须使用 web_search 获取最新信息，并严格输出 JSON 数组，不要输出 Markdown，不要输出解释。';
      const userText = query
        ? `关键词：${query}\n请用 web_search 搜索并整理与该关键词相关的“饮品新品”词条，要求：\n- 输出最多 ${count} 条（如果信息不足可以少于 ${count} 条）\n- 每一条都必须是近 3 个月内发布/上新（90 天内）\n- 请尽量包含至少 2 条近 1 个月内发布/上新（30 天内）的条目，这些条目将用于标记 New\n- 必须覆盖多个品牌（除非关键词本身是品牌）\n- 每条包含：\n  - brand（品牌名）\n  - product（新品单品名）\n  - summary（卖点简述，约18-28字，建议两句短分句，便于两行展示，不要写“来源/链接/据悉”等措辞）\n  - launch_date（上市/上新日期，必须是 YYYY-MM-DD；如果无法确认具体日期，请不要输出该条）\n  - image_url（饮品宣传图/视频封面图的原始URL。如果找不到图片链接请留空，不要编造；必须是 http/https）\n  - weight（1-100，热度/推荐权重）\n  - source_urls（2-3条来源URL，必须是 http/https，且来源中需要能佐证“该新品在近3个月内发布/上新”）\n- brand+product 组合不得重复\n${douyinOnly ? '- 只允许使用抖音站内来源：douyin.com / v.douyin.com / iesdouyin.com；source_urls 只能填抖音链接；请在 web_search 时优先使用 site:douyin.com 或 site:v.douyin.com 的检索指令\n- 如果能在检索结果中找到抖音视频封面图链接（如 douyinpic.com / byteimg.com），请优先填入 image_url\n' : ''}只返回 JSON 数组：[{"brand":"","product":"","summary":"","launch_date":"2026-01-31","image_url":"","weight":50,"source_urls":[""]}]`
        : `请用 web_search 搜索并整理“最近 3 个月内（90 天内）”中国市场热门饮品新品词条，要求：\n- 输出最多 ${count} 条（如果信息不足可以少于 ${count} 条）\n- 覆盖咖啡/茶饮多个品牌（例如：喜茶、奈雪、瑞幸、星巴克、霸王茶姬等）\n- 每一条都必须是近 3 个月内发布/上新（90 天内）\n- 请尽量包含至少 2 条近 1 个月内发布/上新（30 天内）的条目，这些条目将用于标记 New\n- 每条包含：brand、product、summary（约18-28字，两句短分句，便于两行展示）、launch_date（必须 YYYY-MM-DD）、image_url（饮品宣传图/视频封面图原始URL；找不到留空，禁止编造；必须 http/https）、weight（1-100）、source_urls（2-3条来源URL）\n- source_urls 必须来自真实网页检索结果，禁止编造；且来源中需要能佐证“该新品在近3个月内发布/上新”\n- brand+product 组合不得重复\n${douyinOnly ? '- 只允许使用抖音站内来源：douyin.com / v.douyin.com / iesdouyin.com；source_urls 只能填抖音链接；请在 web_search 时优先使用 site:douyin.com 或 site:v.douyin.com 的检索指令\n- 如果能在检索结果中找到抖音视频封面图链接（如 douyinpic.com / byteimg.com），请优先填入 image_url\n' : ''}只返回 JSON 数组。`;

      let text = '';
      try {
        initStream({ query, count, douyin_only: douyinOnly });
        const arkPromise = arkGenerateText({
          model: arkModelText,
          system,
          userParts: [{ type: 'input_text', text: userText }],
          tools: [{ type: 'web_search' }]
        });

        while (true) {
          const outcome = await Promise.race([
            arkPromise.then((t) => ({ kind: 'done' as const, text: t })),
            sleep(2000).then(() => ({ kind: 'ping' as const }))
          ]);
          if (outcome.kind === 'ping') {
            if (wantsStream && !streamClosed) writeSse(res, 'ping', { t: Date.now() });
            if (streamClosed) return res.end();
            continue;
          }
          text = outcome.text;
          break;
        }
      } catch (e: any) {
        const message = e?.message ? String(e.message) : String(e);
        if (wantsStream) {
          initStream({ query, count, douyin_only: douyinOnly });
          writeSse(res, 'error', { error: message });
          writeSse(res, 'done', { cacheHit: false });
          return res.end();
        }
        return res.status(500).json({ error: message });
      }

      const rawItems = safeParseJsonArray(text);
      const ninetyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 90;
      const allTerms: InspirationTerm[] = [];
      for (let i = 0; i < rawItems.length; i += 1) {
        const t = normalizeTerm(rawItems[i], i);
        if (!t) continue;
        const d = parseLaunchDate(t.launch_date);
        if (!d || d.getTime() < ninetyDaysAgo) continue;
        allTerms.push(t);
      }

      const terms = allTerms
        .sort((a, b) => {
          if (a.is_new !== b.is_new) return a.is_new ? -1 : 1;
          return b.weight - a.weight;
        })
        .slice(0, count)
        .map((t) => {
          if (!douyinOnly) return t;
          const urls = (t.source_urls || []).filter((u) => /(^|\.)douyin\.com\//i.test(u) || /(^|\.)v\.douyin\.com\//i.test(u) || /(^|\.)iesdouyin\.com\//i.test(u));
          return { ...t, source_urls: urls.slice(0, 3) };
        })
        .filter((t) => (!douyinOnly ? true : (t.source_urls || []).length > 0));

      inspirationCache.set(cacheKey, { expiresAt: Date.now() + 1000 * 60 * 10, terms });
      if (wantsStream) {
        initStream({ query, count, douyin_only: douyinOnly });
        const imageTasks = includeImages
          ? terms.map(async (term) => {
              if (streamClosed) return;
              let imageRaw = await resolveTermImageUrl(term);
              if (!imageRaw && !streamClosed) {
                const searched = await Promise.race([
                  arkSearchImageUrlForTerm({ brand: term.brand, product: term.product }),
                  sleep(8000).then(() => '')
                ]);
                if (searched) {
                  const extracted = await resolveImageFromSourceUrl(searched);
                  imageRaw = extracted || '';
                }
              }
              if (!imageRaw || streamClosed) return;
              const proxied = toProxiedImageUrl(imageRaw);
              if (!proxied) return;
              term.image_url = proxied;
              writeSse(res, 'term_image', { id: term.id, image_url: proxied });
            })
          : [];

        for (const term of terms) {
          if (streamClosed) break;
          writeSse(res, 'term', term);
          await sleep(25);
        }
        if (!streamClosed) writeSse(res, 'done', { cacheHit: false });
        if (imageTasks.length) {
          await Promise.race([Promise.allSettled(imageTasks), sleep(12000)]);
        }
        if (!streamClosed) writeSse(res, 'images_done', {});
        return res.end();
      }
      res.json({ terms, cacheHit: false });
    } catch (error: any) {
      const message = error?.message ? String(error.message) : String(error);
      if (wantsStream) {
        initStream({});
        writeSse(res, 'error', { error: message });
        writeSse(res, 'done', { cacheHit: false });
        return res.end();
      }
      res.status(500).json({ error: message });
    }
  });

  // 3. Daily Drops (Generate with Web Search)
  app.post("/api/drops/generate", async (_req, res) => {
    try {
       if (!hasValidArkKey) {
         // Fallback if no key
         return res.json([
           {
             product_name: "Brown Sugar Boba",
             brand_name: "SipSnaps",
             product_image: "",
             ai_summary: "A comforting classic with caramel sweetness.",
             launch_date: new Date().toLocaleDateString()
           }
         ]);
       }

       const system = '你是一个饮品潮流编辑。利用联网搜索能力，查找中国市场最近一周的知名茶饮/咖啡品牌（如喜茶、霸王茶姬、瑞幸、星巴克等）推出的“真实新品”。\n请务必只返回一个纯 JSON 数组字符串，不要包含任何 Markdown 格式（如 ```json），也不要包含任何解释性文字。\nJSON 格式要求：[{"product_name":"","brand_name":"","ai_summary":"","launch_date":""}]';
       const userText = '搜索本周热门饮品新品，列出 3 款。每款包含：product_name(品名), brand_name(品牌), ai_summary(1句简评), launch_date(上市日期/近期)。\n再次强调：只返回 JSON 数组，不要 Markdown。';

      let text = '';
      try {
        // Call Ark with web_search tool
        text = await arkGenerateText({
          model: arkModelText,
          system,
          userParts: [{ type: 'input_text', text: userText }],
          tools: [{ type: 'web_search' }] // Enable web search
        });
        console.log('Ark Drops Raw Response:', text.slice(0, 200));
      } catch (e) {
        console.error('Ark Drops Error:', e);
        // Fallback on error
        return res.json([
          {
            product_name: 'Jasmine Grape',
            brand_name: 'HeyTea',
            product_image: '',
            ai_summary: 'Fresh grape with jasmine tea base.',
            launch_date: new Date().toLocaleDateString()
          }
        ]);
      }
      const cleaned = stripBackticksAndTrim(text);
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      const drops = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      // Save to DB
      const insert = db.prepare("INSERT INTO daily_drops (product_name, brand_name, ai_summary, launch_date) VALUES (?, ?, ?, ?)");
      const insertMany = db.transaction((items: any[]) => {
        for (const item of items) insert.run(item.product_name, item.brand_name, item.ai_summary, item.launch_date);
      });
      insertMany(drops);
      
      res.json(drops);
    } catch (error) {
        console.error("Drops Gen Error:", error);
        res.status(500).json({ error: "Failed to generate drops" });
    }
  });

  // 6. Drops Search (Doubao with Web Search)
  app.post("/api/drops/search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || !hasValidArkKey) return res.json([]);

      const system = '你是一个饮品潮流编辑。利用联网搜索能力，查找指定品牌或关键词的最新饮品动态（如喜茶、瑞幸等）。\n请务必只返回一个纯 JSON 数组字符串，不要包含任何 Markdown 格式（如 ```json），也不要包含任何解释性文字。\nJSON 格式要求：[{"product_name":"","brand_name":"","product_image":"","ai_summary":"","launch_date":"","order_link":""}]';
      const userText = `搜索关键词“${query}”相关的最新饮品/新品。列出 4-6 款。每款包含：\n- product_name: 品名\n- brand_name: 品牌\n- product_image: 请尽量从搜索结果中提取该饮品的“官方宣传图”或“新闻图片”的原始URL链接。如果找不到图片链接，请留空，不要编造。\n- ai_summary: 1句简评\n- launch_date: 上市日期/近期\n- order_link: 尝试找到该品牌的小程序链接（如 #小程序://喜茶GO/...）或官网下单链接。如果找不到，请根据品牌名称返回以下默认值：\n  * 喜茶: #小程序://喜茶GO/j9FvAnRStFDVa3j\n  * 瑞幸: #小程序://瑞幸咖啡/luckincoffee\n  * 星巴克: #小程序://星巴克中国/starbucks\n  * 霸王茶姬: #小程序://霸王茶姬/chagee\n  * 其他: 留空\n\n再次强调：只返回 JSON 数组，不要 Markdown。`;

      let text = '';
      try {
        text = await arkGenerateText({
          model: arkModelText,
          system,
          userParts: [{ type: 'input_text', text: userText }],
          tools: [{ type: 'web_search' }]
        });
        console.log('Ark Search Raw Response:', text.slice(0, 200)); // Log for debug
      } catch (e) {
        console.error('Ark Drops Search Error:', e);
        return res.json([]);
      }

      // Try to clean markdown
      const cleaned = stripBackticksAndTrim(text);
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      const drops = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json(drops);
    } catch (error) {
      console.error("Drops Search Error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

// 7. Image Generation (Doubao Seedream)
  app.post("/api/generate-image", async (req, res) => {
    try {
        const { prompt, imageUrl, brand, product, recommendation } = req.body;
        if (!hasValidArkKey) return res.status(400).json({ error: "API key required" });

        let finalPrompt = prompt;

        // If no explicit prompt but we have context data (Amway flow)
        if (!finalPrompt && brand && product) {
            let visualDescription = "";
            
            // Step 1: Vision - Describe the image if provided
            if (imageUrl) {
                try {
                    // Handle local uploads path
                    let imageInput = imageUrl;
                    if (imageUrl.startsWith('/uploads/')) {
                        // Read local file
                        const localPath = path.join(__dirname, 'public', imageUrl);
                        if (fs.existsSync(localPath)) {
                            const buffer = fs.readFileSync(localPath);
                            const mime = imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
                            imageInput = `data:${mime};base64,${buffer.toString('base64')}`;
                        }
                    }

                    console.log("Analyzing image for poster context...");
                    const visionRes = await arkGenerateText({
                        model: arkModelVision,
                        system: "You are a visual artist assistant. Describe the beverage in the image concisely for an AI image generator. Focus on: Cup shape, Drink color, Toppings, Layers, Garnish. Ignore background.",
                        userParts: [
                            { type: 'input_image', image_url: imageInput },
                            { type: 'input_text', text: "Describe the drink visual appearance in English." }
                        ]
                    });
                    visualDescription = visionRes;
                    console.log("Visual Description:", visualDescription);
                } catch (err) {
                    console.error("Vision Analysis Failed:", err);
                    // Continue without visual description
                }
            }

            // Step 2: Construct Final Prompt
            finalPrompt = `
            High-quality social media poster for a drink.
            Brand: ${brand}
            Product: ${product}
            Subject Visuals: ${visualDescription || "A delicious, fresh bubble tea drink"}
            Context/Mood: "${recommendation || "Highly Recommended!"}"
            Style: Xiaohongshu Viral Style, Photo-Illustration Collage, Vibrant & Appetizing.
            Composition: A central real-looking drink cup seamlessly integrated with hand-drawn doodles (stars, hearts, arrows) and fruit illustrations.
            Background: Warm gradient or cream-colored, with a thick wavy border or collage elements.
            Atmosphere: Cute, lively, high visual impact, bold colors, bright and dynamic.
            Note: No people, focus on the drink and the happy vibe.
            `;
        }

        if (!finalPrompt) return res.status(400).json({ error: "Prompt or context required" });

        console.log('Generating image for prompt length:', finalPrompt.length);

        // Use direct fetch to /images/generations endpoint
        const url = `${stripBackticksAndTrim(arkBaseUrl)}/images/generations`;
        const arkRes = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${arkApiKeyRaw}`
            },
            body: JSON.stringify({
                model: arkModelImage,
                prompt: finalPrompt,
                size: "2048x2048", // Updated for seedream requirement
                response_format: "url"
            })
        });

        const data = await arkRes.json();
        
        if (data.error) {
            console.error('Ark Image Gen Error:', data.error);
            return res.status(500).json({ error: data.error.message });
        }

        const imgUrl = data.data?.[0]?.url;
        if (!imgUrl) {
            return res.status(500).json({ error: "No image URL returned" });
        }

        // Download and save to file system
        const imgRes = await fetch(imgUrl);
        const buffer = await imgRes.arrayBuffer();
        
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const filename = `gen-${timestamp}-${random}.png`;
        const filepath = path.join(uploadsDir, filename);
        
        fs.writeFileSync(filepath, Buffer.from(buffer));
        
        // Return local URL
        const localUrl = `/uploads/${filename}`;
        
        res.json({ imageUrl: localUrl });

    } catch (error) {
        console.error("Image Generation Failed:", error);
        res.status(500).json({ error: "Generation failed" });
    }
  });

  // CRUD
  app.get("/api/logs", (_req, res) => {
    const logs = db.prepare("SELECT * FROM drink_logs ORDER BY created_at DESC").all();
    res.json(logs);
  });

  app.post("/api/logs", (req, res) => {
    try {
      const { brand, name, specs, image_url, avatar_url, created_at } = req.body;
      const stmt = db.prepare("INSERT INTO drink_logs (brand, name, specs, image_url, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)");
      const info = stmt.run(brand, name, specs, image_url, avatar_url, created_at || new Date().toISOString());
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      console.error("Save Log Error:", error);
      res.status(500).json({ error: "Failed to save log: " + error.message });
    }
  });

  app.put("/api/logs/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { brand, name, specs, image_url, avatar_url, created_at } = req.body;
      
      // Build dynamic update query
      const updates = [];
      const values = [];
      
      if (brand !== undefined) { updates.push("brand = ?"); values.push(brand); }
      if (name !== undefined) { updates.push("name = ?"); values.push(name); }
      if (specs !== undefined) { updates.push("specs = ?"); values.push(specs); }
      if (image_url !== undefined) { updates.push("image_url = ?"); values.push(image_url); }
      if (avatar_url !== undefined) { updates.push("avatar_url = ?"); values.push(avatar_url); }
      if (created_at !== undefined) { updates.push("created_at = ?"); values.push(created_at); }
      
      if (updates.length === 0) return res.json({ success: true }); // Nothing to update
      
      values.push(id);
      
      const stmt = db.prepare(`UPDATE drink_logs SET ${updates.join(", ")} WHERE id = ?`);
      const info = stmt.run(...values);
      
      if (info.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Log not found" });
      }
    } catch (error: any) {
      console.error("Update Log Error:", error);
      res.status(500).json({ error: "Failed to update log" });
    }
  });

  app.delete("/api/logs/:id", (req, res) => {
    try {
      const { id } = req.params;
      const stmt = db.prepare("DELETE FROM drink_logs WHERE id = ?");
      const info = stmt.run(id);
      if (info.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Log not found" });
      }
    } catch (error: any) {
      console.error("Delete Log Error:", error);
      res.status(500).json({ error: "Failed to delete log" });
    }
  });
  
  app.get("/api/drops", (_req, res) => {
    // Combine Daily Drops and Amway Feeds into a single feed
    const drops = db.prepare("SELECT id, product_name, brand_name, product_image, ai_summary, launch_date, order_link, created_at, 'drop' as type FROM daily_drops").all();
    const amway = db.prepare("SELECT id, product_name, brand_name, poster_image_url as product_image, recommendation_text as ai_summary, created_at as launch_date, '' as order_link, created_at, 'amway' as type FROM amway_feeds").all();
    
    // Normalize and sort
    const feed = [...drops, ...amway].sort((a: any, b: any) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    res.json(feed);
  });

  // 8. Amway Publish
  app.post("/api/amway/publish", (req, res) => {
    try {
        const { userId, brandName, productName, recommendationText, posterImageUrl } = req.body;
        const stmt = db.prepare("INSERT INTO amway_feeds (user_id, brand_name, product_name, recommendation_text, poster_image_url) VALUES (?, ?, ?, ?, ?)");
        const info = stmt.run(userId || "guest", brandName, productName, recommendationText, posterImageUrl);
        res.json({ id: info.lastInsertRowid });
    } catch (error) {
        console.error("Amway Publish Error:", error);
        res.status(500).json({ error: "Failed to publish" });
    }
  });

  // --- Onboarding & Community Routes ---

  // 4. Onboarding Submit
  app.post("/api/onboarding/submit", async (req, res) => {
    try {
      const { answers, userId } = req.body;
      // Save preferences
      const stmt = db.prepare("INSERT INTO user_preferences (user_id, answers) VALUES (?, ?)");
      stmt.run(userId || "guest", JSON.stringify(answers));

      if (!hasValidArkKey) {
        const preferenceText = Array.isArray(answers) ? answers.filter(Boolean).join(" · ") : "";
        const recommendation = {
          name: "Classic Milk Tea",
          description: preferenceText ? `Matched by your preferences: ${preferenceText}` : "A timeless match — balanced, smooth, and always in style.",
          image_url: ""
        };

        const recStmt = db.prepare("INSERT INTO user_recommendations (user_id, beverage_name, beverage_image_url, reason) VALUES (?, ?, ?, ?)");
        recStmt.run(userId || "guest", recommendation.name, recommendation.image_url, recommendation.description);

        return res.json(recommendation);
      }

      const system = '你是饮品口味推荐助手。必须严格输出 JSON，不要输出 markdown 或多余文字。';
      const userText = `用户偏好：${JSON.stringify(answers)}\n请推荐 1 款“本命奶茶”，并给一句理由。\n只返回 JSON：{ "name": "string", "description": "string", "image_url": "string" }`;

      let text = '';
      try {
        text = await arkGenerateText({
          model: arkModelText,
          system,
          userParts: [{ type: 'input_text', text: userText }]
        });
      } catch (e) {
        console.error('Ark Onboarding Error:', e);
        const preferenceText = Array.isArray(answers) ? answers.filter(Boolean).join(' · ') : '';
        const recommendation = {
          name: 'Classic Milk Tea',
          description: preferenceText ? `Matched by your preferences: ${preferenceText}` : 'A timeless match — balanced, smooth, and always in style.',
          image_url: ''
        };
        const recStmt = db.prepare("INSERT INTO user_recommendations (user_id, beverage_name, beverage_image_url, reason) VALUES (?, ?, ?, ?)");
        recStmt.run(userId || 'guest', recommendation.name, recommendation.image_url, recommendation.description);
        return res.json(recommendation);
      }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const recommendation = jsonMatch ? JSON.parse(jsonMatch[0]) : { name: "Classic Milk Tea", description: "A timeless choice.", image_url: "" };

      // Save recommendation
      const recStmt = db.prepare("INSERT INTO user_recommendations (user_id, beverage_name, beverage_image_url, reason) VALUES (?, ?, ?, ?)");
      recStmt.run(userId || "guest", recommendation.name, recommendation.image_url, recommendation.description);

      res.json(recommendation);
    } catch (error) {
      console.error("Onboarding Error:", error);
      res.status(500).json({ error: "Failed to process onboarding" });
    }
  });

  // 5. Community Feeds
  app.get("/api/community/posts", (_req, res) => {
    try {
      const posts = db.prepare(`
        SELECT p.*, 
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
        FROM posts p ORDER BY created_at DESC
      `).all();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/community/posts", (req, res) => {
    try {
      const { userId, userName, userAvatar, content, imageUrl } = req.body;
      const stmt = db.prepare("INSERT INTO posts (user_id, user_name, user_avatar, content, image_url) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(userId || "guest", userName || "Anonymous", userAvatar || "", content, imageUrl);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.post("/api/community/posts/:id/like", (req, res) => {
    try {
      const { userId } = req.body;
      const { id } = req.params;
      const stmt = db.prepare("INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?, ?)");
      stmt.run(userId || "guest", id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to like post" });
    }
  });

  app.post("/api/community/posts/:id/comment", (req, res) => {
    try {
      const { userId, userName, userAvatar, content } = req.body;
      const { id } = req.params;
      const stmt = db.prepare("INSERT INTO comments (user_id, user_name, user_avatar, post_id, content) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(userId || "guest", userName || "Anonymous", userAvatar || "", id, content);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Failed to comment" });
    }
  });

  app.get("/api/community/posts/:id/comments", (req, res) => {
    try {
      const { id } = req.params;
      const comments = db.prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC").all(id);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ 
        server: { middlewareMode: true }, 
        appType: "spa",
        configFile: path.resolve(__dirname, 'vite.config.ts')
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
