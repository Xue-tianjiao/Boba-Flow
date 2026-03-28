export type SidebarGroupKey = 'want' | 'recommend';

export type SidebarItem = {
  id: number;
  user_id: string;
  group_key: SidebarGroupKey;
  title: string;
  note?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  user_id: string;
  avatar_url: string;
  updated_at: string;
};

export type EditMode =
  | { kind: 'none' }
  | { kind: 'create'; group: SidebarGroupKey }
  | { kind: 'edit'; group: SidebarGroupKey; item: SidebarItem };

export function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function safeItems(data: any): SidebarItem[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((x): SidebarItem | null => {
      const id = Number(x?.id);
      const groupKey: SidebarGroupKey | null = x?.group_key === 'want' || x?.group_key === 'recommend' ? x.group_key : null;
      const title = safeString(x?.title).trim();
      if (!Number.isFinite(id) || !groupKey || !title) return null;
      const item: SidebarItem = {
        id,
        user_id: safeString(x?.user_id) || 'guest',
        group_key: groupKey,
        title,
        created_at: safeString(x?.created_at),
        updated_at: safeString(x?.updated_at)
      };

      const note = safeString(x?.note).trim();
      if (note) item.note = note;
      const imageUrl = safeString(x?.image_url).trim();
      if (imageUrl) item.image_url = imageUrl;

      return item;
    })
    .filter((v): v is SidebarItem => v !== null);
}

export function getInitials(seed: string): string {
  const s = (seed || 'U').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || 'U';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase();
}
