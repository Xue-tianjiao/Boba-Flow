import { json, readBody } from '../../lib/ark.js';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';

function parseDataUrl(dataUrl: string): { contentType: string; data: Buffer } {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) throw new Error('Invalid dataUrl');
  const contentType = m[1].trim() || 'application/octet-stream';
  const base64 = m[2].trim();
  return { contentType, data: Buffer.from(base64, 'base64') };
}

function safeExt(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'bin';
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
    const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
    const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
    const key = typeof body?.key === 'string' ? body.key : '';
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : 'guest';
    if (!dataUrl) return json(res, { error: 'dataUrl required' }, 400);

    const { contentType, data } = parseDataUrl(dataUrl);
    if (data.length > 6_000_000) return json(res, { error: 'Image too large' }, 413);

    const sb = getSupabaseAdmin();
    const bucket = 'uploads';

    const { data: existing } = await sb.storage.getBucket(bucket);
    if (!existing) {
      await sb.storage.createBucket(bucket, { public: true });
    }

    const ext = safeExt(contentType);
    const safeKey = (key || 'upload').replace(/[^a-zA-Z0-9._\-/]/g, '_').slice(0, 120);
    const path = `${(userId || 'guest').replace(/[^a-zA-Z0-9._-]/g, '_')}/${Date.now()}-${safeKey}.${ext}`;

    const { error: uploadError } = await sb.storage.from(bucket).upload(path, data, {
      contentType,
      upsert: true
    });
    if (uploadError) return json(res, { error: uploadError.message }, 500);

    const { data: pub } = sb.storage.from(bucket).getPublicUrl(path);
    const url = pub?.publicUrl;
    if (!url) return json(res, { error: 'No public URL' }, 500);
    return json(res, { url });
  } catch (e: any) {
    return json(res, { error: e?.message ? String(e.message) : 'Upload failed' }, 500);
  }
}

