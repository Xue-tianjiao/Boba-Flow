import { hasValidArkKey, json } from '../lib/ark.js';

export default function handler(req: any, res: any) {
  try {
    return json(res, {
      ok: true,
      method: String(req?.method || ''),
      hasArkKey: hasValidArkKey,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasArkBaseUrl: Boolean(process.env.ARK_BASE_URL),
      hasModelText: Boolean(process.env.ARK_MODEL_TEXT),
      hasModelVision: Boolean(process.env.ARK_MODEL_VISION),
      hasModelImage: Boolean(process.env.ARK_MODEL_IMAGE)
    });
  } catch (e: any) {
    return json(res, { ok: false, error: e?.message ? String(e.message) : 'Health failed' }, 500);
  }
}
