import { createClient } from '@supabase/supabase-js';

function stripWrapQuotes(value: string): string {
  const v = String(value || '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function normalizeKey(value: string): string {
  return stripWrapQuotes(value).replace(/\s+/g, '');
}

export function getSupabaseAdmin() {
  const url = stripWrapQuotes(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
  const serviceRoleKey = normalizeKey(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'drinkme-serverless' } }
  });
}

export function looksLikeJwt(value: string): boolean {
  const v = normalizeKey(value);
  const parts = v.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 10);
}
