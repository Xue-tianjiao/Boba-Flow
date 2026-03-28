import { json, readBody } from '../../lib/ark.js';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';

type DrinkLogRow = {
  id: number;
  user_id: string;
  brand: string | null;
  name: string | null;
  specs: string | null;
  image_url: string | null;
  avatar_url: string | null;
  created_at: string;
};

export default async function handler(req: any, res: any) {
  try {
    const sb = getSupabaseAdmin();

    if (req.method === 'GET') {
      const userId = String(req?.query?.userId || 'guest').trim() || 'guest';
      const { data, error } = await sb
        .from('drink_logs')
        .select('id,user_id,brand,name,specs,image_url,avatar_url,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (error) return json(res, { error: error.message }, 500);
      return json(res, (data || []) as DrinkLogRow[]);
    }

    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
      const userId = String(body?.user_id || body?.userId || 'guest').trim() || 'guest';
      const brand = typeof body?.brand === 'string' ? body.brand.trim() : '';
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const specs = typeof body?.specs === 'string' ? body.specs.trim() : '';
      const imageUrl = typeof body?.image_url === 'string' ? body.image_url.trim() : (typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '');
      const avatarUrl = typeof body?.avatar_url === 'string' ? body.avatar_url.trim() : (typeof body?.avatarUrl === 'string' ? body.avatarUrl.trim() : '');
      const createdAt = typeof body?.created_at === 'string' ? body.created_at.trim() : (typeof body?.createdAt === 'string' ? body.createdAt.trim() : '');

      if (!brand && !name) return json(res, { error: 'brand or name required' }, 400);

      const insertRow: any = {
        user_id: userId,
        brand: brand || null,
        name: name || null,
        specs: specs || null,
        image_url: imageUrl || null,
        avatar_url: avatarUrl || null
      };
      if (createdAt) insertRow.created_at = createdAt;

      const { data, error } = await sb
        .from('drink_logs')
        .insert(insertRow)
        .select('id,user_id,brand,name,specs,image_url,avatar_url,created_at')
        .single();

      if (error) return json(res, { error: error.message }, 500);
      return json(res, data as DrinkLogRow);
    }

    return json(res, { error: 'Method not allowed' }, 405);
  } catch (e: any) {
    return json(res, { error: e?.message ? String(e.message) : 'Logs failed' }, 500);
  }
}

