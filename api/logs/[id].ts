import { json, readBody } from '../../lib/ark.js';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';

export default async function handler(req: any, res: any) {
  try {
    const sb = getSupabaseAdmin();
    const id = Number(req?.query?.id);
    if (!Number.isFinite(id)) return json(res, { error: 'Invalid id' }, 400);

    if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
      const patch: any = {};
      if (typeof body?.brand === 'string') patch.brand = body.brand.trim() || null;
      if (typeof body?.name === 'string') patch.name = body.name.trim() || null;
      if (typeof body?.specs === 'string') patch.specs = body.specs.trim() || null;
      if (typeof body?.image_url === 'string' || typeof body?.imageUrl === 'string') patch.image_url = String(body.image_url || body.imageUrl).trim() || null;
      if (typeof body?.avatar_url === 'string' || typeof body?.avatarUrl === 'string') patch.avatar_url = String(body.avatar_url || body.avatarUrl).trim() || null;
      if (typeof body?.created_at === 'string' || typeof body?.createdAt === 'string') patch.created_at = String(body.created_at || body.createdAt).trim();

      const { data, error } = await sb.from('drink_logs').update(patch).eq('id', id).select('id').single();
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { success: true, id: data?.id ?? id });
    }

    if (req.method === 'DELETE') {
      const { error } = await sb.from('drink_logs').delete().eq('id', id);
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { success: true });
    }

    return json(res, { error: 'Method not allowed' }, 405);
  } catch (e: any) {
    return json(res, { error: e?.message ? String(e.message) : 'Log op failed' }, 500);
  }
}

