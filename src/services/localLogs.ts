export type LocalDrinkLog = {
  id: number;
  user_id: string;
  brand: string;
  name: string;
  specs: string;
  image_url: string;
  avatar_url: string;
  created_at: string;
};

type Store = {
  nextId: number;
  logs: LocalDrinkLog[];
};

const STORAGE_KEY = 'drinkme:drink_logs:v1';

function nowIso(): string {
  return new Date().toISOString();
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nextId: 1, logs: [] };
    const parsed = JSON.parse(raw);
    const nextId = Number(parsed?.nextId);
    const logs = Array.isArray(parsed?.logs) ? parsed.logs : [];
    return {
      nextId: Number.isFinite(nextId) && nextId > 0 ? nextId : 1,
      logs: logs
        .map((x: any) => {
          const id = Number(x?.id);
          if (!Number.isFinite(id)) return null;
          return {
            id,
            user_id: safeString(x?.user_id) || 'guest',
            brand: safeString(x?.brand),
            name: safeString(x?.name),
            specs: safeString(x?.specs),
            image_url: safeString(x?.image_url),
            avatar_url: safeString(x?.avatar_url),
            created_at: safeString(x?.created_at) || nowIso()
          } as LocalDrinkLog;
        })
        .filter(Boolean)
    };
  } catch {
    return { nextId: 1, logs: [] };
  }
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getLocalLogs(userId = 'guest'): LocalDrinkLog[] {
  const store = loadStore();
  const uid = (userId || 'guest').trim() || 'guest';
  return store.logs
    .filter((l) => (l.user_id || 'guest') === uid)
    .slice()
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      if (db !== da) return db - da;
      return b.id - a.id;
    });
}

export function addLocalLog(input: any): LocalDrinkLog {
  const store = loadStore();
  const id = store.nextId;
  store.nextId = id + 1;

  const row: LocalDrinkLog = {
    id,
    user_id: safeString(input?.user_id || input?.userId) || 'guest',
    brand: safeString(input?.brand),
    name: safeString(input?.name),
    specs: safeString(input?.specs),
    image_url: safeString(input?.image_url || input?.imageUrl),
    avatar_url: safeString(input?.avatar_url || input?.avatarUrl),
    created_at: safeString(input?.created_at || input?.createdAt) || nowIso()
  };

  store.logs.push(row);
  saveStore(store);
  return row;
}

export function updateLocalLog(id: number, patch: any): { success: true } | { error: string } {
  const store = loadStore();
  const idx = store.logs.findIndex((l) => l.id === id);
  if (idx === -1) return { error: 'Not found' };

  const current = store.logs[idx];
  const next: LocalDrinkLog = {
    ...current,
    brand: typeof patch?.brand === 'string' ? patch.brand : current.brand,
    name: typeof patch?.name === 'string' ? patch.name : current.name,
    specs: typeof patch?.specs === 'string' ? patch.specs : current.specs,
    image_url: typeof patch?.image_url === 'string' ? patch.image_url : (typeof patch?.imageUrl === 'string' ? patch.imageUrl : current.image_url),
    avatar_url: typeof patch?.avatar_url === 'string' ? patch.avatar_url : (typeof patch?.avatarUrl === 'string' ? patch.avatarUrl : current.avatar_url),
    created_at: typeof patch?.created_at === 'string' ? patch.created_at : (typeof patch?.createdAt === 'string' ? patch.createdAt : current.created_at)
  };

  store.logs[idx] = next;
  saveStore(store);
  return { success: true };
}

export function deleteLocalLog(id: number): { success: true } | { error: string } {
  const store = loadStore();
  const before = store.logs.length;
  store.logs = store.logs.filter((l) => l.id !== id);
  if (store.logs.length === before) return { error: 'Not found' };
  saveStore(store);
  return { success: true };
}

