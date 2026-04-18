// Frontend API service
import { addLocalLog, deleteLocalLog, getLocalLogs, updateLocalLog } from './localLogs';

async function readJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(input, init);
    const data = await readJsonResponse(res);
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: e?.message ? String(e.message) : 'Network error' } };
  }
}

async function tryFetchJson(input: RequestInfo | URL, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any | null }>{
  try {
    const res = await fetch(input, init);
    const data = await readJsonResponse(res);
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: e?.message ? String(e.message) : 'Network error' } };
  }
}

export const api = {
  // Search for drinks
  searchDrinks: async (query: string) => {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    return await res.json();
  },

  // Identify uploaded drink image
  identifyDrink: async (imageBase64: string, mimeType?: string) => {
    const { ok, data } = await fetchJson('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType })
    });
    if (ok) return data;
    return { error: data?.error || 'Service unavailable' };
  },

  // Inspiration (Today page)
  exploreInspiration: async (query?: string, limit?: number) => {
    const res = await fetch('/api/inspiration/explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query || '', limit: limit ?? 8 }),
    });
    return await res.json();
  },

  refreshInspiration: async (query?: string, limit?: number) => {
    const res = await fetch('/api/inspiration/explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query || '', limit: limit ?? 8, force: true }),
    });
    return await res.json();
  },

  assistantChat: async (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    const { ok, data } = await fetchJson('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    if (ok) return data;
    return { error: data?.error || 'Service unavailable' };
  },

  exploreInspirationStream: async (params: {
    query?: string;
    limit?: number;
    force?: boolean;
    signal?: AbortSignal;
    onTerm: (term: any) => void;
    onImage?: (payload: { id: string; image_url: string }) => void;
    onDone?: (meta: any) => void;
    onError?: (err: any) => void;
  }) => {
    const res = await fetch('/api/inspiration/explore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ query: params.query || '', limit: params.limit ?? 8, force: params.force === true, stream: true, include_images: false, douyin_only: false }),
      signal: params.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || String(res.status));
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');
    const decoder = new TextDecoder();
    let buffer = '';

    const handleFrame = (frame: string) => {
      const lines = frame.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) return;
      try {
        const parsed = JSON.parse(data);
        if (event === 'term') params.onTerm(parsed);
        else if (event === 'term_image') params.onImage?.(parsed);
        else if (event === 'done') params.onDone?.(parsed);
        else if (event === 'error') params.onError?.(parsed);
      } catch (e) {
        params.onError?.({ error: 'Invalid stream payload', detail: String(e) });
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');

      let idx = buffer.indexOf('\n\n');
      while (idx >= 0) {
        const frame = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (frame) handleFrame(frame);
        idx = buffer.indexOf('\n\n');
      }
    }
  },

  getNearbyPlaces: async (params: { lat?: number; lng?: number; radius?: number; city?: string; keywords?: string }) => {
    const qs = new URLSearchParams();
    if (typeof params.lat === 'number' && Number.isFinite(params.lat)) qs.set('lat', String(params.lat));
    if (typeof params.lng === 'number' && Number.isFinite(params.lng)) qs.set('lng', String(params.lng));
    if (typeof params.radius === 'number' && Number.isFinite(params.radius)) qs.set('radius', String(params.radius));
    if (typeof params.city === 'string' && params.city.trim()) qs.set('city', params.city.trim());
    if (typeof params.keywords === 'string' && params.keywords.trim()) qs.set('keywords', params.keywords.trim());
    const url = `/api/places/nearby?${qs.toString()}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || String(res.status));
    }
    return await res.json();
  },

  // Image Generation
  generateImage: async (data: { prompt?: string, imageUrl?: string, brand?: string, product?: string, recommendation?: string }) => {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  // Get daily drops
  getDrops: async () => {
    const res = await fetch('/api/drops');
    return await res.json();
  },

  // Trigger generation of new drops
  refreshDrops: async () => {
    const res = await fetch('/api/drops/generate', { method: 'POST' });
    return await res.json();
  },

  searchDrops: async (query: string) => {
    const res = await fetch('/api/drops/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    return await res.json();
  },

  // Get drink logs
  getLogs: async () => {
    const { ok, data } = await tryFetchJson('/api/logs');
    if (ok && Array.isArray(data)) return data;
    return getLocalLogs('guest');
  },

  // Add a new drink log
  addLog: async (log: any) => {
    const { ok, data } = await tryFetchJson('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });

    if (ok && data && !data?.error) return data;
    return addLocalLog(log);
  },

  // Update a drink log
  updateLog: async (id: number, log: any) => {
    const { ok, data } = await tryFetchJson(`/api/logs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    if (ok && data && !data?.error) return data;
    return updateLocalLog(id, log);
  },

  // Delete a drink log
  deleteLog: async (id: number) => {
    const { ok, data } = await tryFetchJson(`/api/logs/${id}`, { method: 'DELETE' });
    if (ok && data && !data?.error) return data;
    return deleteLocalLog(id);
  },

  // Onboarding
  submitOnboarding: async (answers: any) => {
    const res = await fetch('/api/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    return await res.json();
  },

  // Community
  getPosts: async () => {
    const res = await fetch('/api/community/posts');
    return await res.json();
  },
  createPost: async (post: any) => {
    const res = await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    });
    return await res.json();
  },
  likePost: async (postId: number) => {
    const res = await fetch(`/api/community/posts/${postId}/like`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) 
    });
    return await res.json();
  },
  commentPost: async (postId: number, content: string) => {
    const res = await fetch(`/api/community/posts/${postId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return await res.json();
  },
  getComments: async (postId: number) => {
    const res = await fetch(`/api/community/posts/${postId}/comments`);
    return await res.json();
  },

  // Amway
  publishAmway: async (data: any) => {
    const res = await fetch('/api/amway/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return await res.json();
  },

  // Sidebar (Want / Recommend)
  getSidebarItems: async (params: { group: 'want' | 'recommend'; userId?: string }) => {
    const qs = new URLSearchParams();
    qs.set('group', params.group);
    qs.set('userId', (params.userId || 'guest').trim() || 'guest');
    const res = await fetch(`/api/sidebar/items?${qs.toString()}`, { method: 'GET' });
    return await res.json();
  },

  createSidebarItem: async (data: { group: 'want' | 'recommend'; title: string; note?: string; imageUrl?: string; userId?: string }) => {
    const res = await fetch('/api/sidebar/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: data.userId || 'guest',
        group: data.group,
        title: data.title,
        note: data.note || '',
        imageUrl: data.imageUrl || ''
      })
    });
    return await res.json();
  },

  updateSidebarItem: async (id: number, data: { title?: string; note?: string; imageUrl?: string }) => {
    const res = await fetch(`/api/sidebar/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  deleteSidebarItem: async (id: number) => {
    const res = await fetch(`/api/sidebar/items/${id}`, { method: 'DELETE' });
    return await res.json();
  },

  getProfile: async (params?: { userId?: string }) => {
    const qs = new URLSearchParams();
    qs.set('userId', (params?.userId || 'guest').trim() || 'guest');
    const res = await fetch(`/api/profile?${qs.toString()}`, { method: 'GET' });
    return await res.json();
  },

  updateProfile: async (data: { avatarUrl: string; userId?: string }) => {
    const qs = new URLSearchParams();
    qs.set('userId', (data.userId || 'guest').trim() || 'guest');
    const res = await fetch(`/api/profile?${qs.toString()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: data.avatarUrl })
    });
    return await res.json();
  },

  uploadDataUrlImage: async (data: { dataUrl: string; key: string; userId?: string }) => {
    const { ok, data: resData } = await fetchJson('/api/uploads/data-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: data.dataUrl, key: data.key, userId: data.userId || 'guest' })
    });
    if (ok) return resData;
    return { error: resData?.error || 'Service unavailable' };
  }
};
