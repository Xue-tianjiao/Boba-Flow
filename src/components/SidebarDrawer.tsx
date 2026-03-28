import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import AvatarSheet from './sidebar/AvatarSheet';
import SidebarGroupSection from './sidebar/SidebarGroupSection';
import SidebarItemSheet from './sidebar/SidebarItemSheet';
import type { EditMode, SidebarGroupKey, SidebarItem, UserProfile } from './sidebar/types';
import { getInitials, safeItems, safeString } from './sidebar/types';

export default function SidebarDrawer(props: { open: boolean; onClose: () => void; userId?: string }) {
  const userId = (props.userId || 'guest').trim() || 'guest';
  const [profile, setProfile] = useState<UserProfile>({ user_id: userId, avatar_url: '', updated_at: '' });
  const [wantItems, setWantItems] = useState<SidebarItem[]>([]);
  const [recommendItems, setRecommendItems] = useState<SidebarItem[]>([]);
  const [expanded, setExpanded] = useState<{ want: boolean; recommend: boolean }>(() => {
    const raw = localStorage.getItem('sipsnaps:sidebar:expanded');
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        want: Boolean(parsed?.want ?? true),
        recommend: Boolean(parsed?.recommend ?? true)
      };
    } catch {
      return { want: true, recommend: true };
    }
  });
  const [editMode, setEditMode] = useState<EditMode>({ kind: 'none' });
  const [saving, setSaving] = useState(false);
  const [avatarEditing, setAvatarEditing] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);

  useEffect(() => {
    localStorage.setItem('sipsnaps:sidebar:expanded', JSON.stringify(expanded));
  }, [expanded]);

  useEffect(() => {
    if (!props.open) return;
    void (async () => {
      try {
        const p = await api.getProfile({ userId });
        setProfile({ user_id: safeString(p?.user_id) || userId, avatar_url: safeString(p?.avatar_url), updated_at: safeString(p?.updated_at) });
      } catch {
      }
      try {
        const data = await api.getSidebarItems({ group: 'want', userId });
        setWantItems(safeItems(data));
      } catch {
        setWantItems([]);
      }
      try {
        const data = await api.getSidebarItems({ group: 'recommend', userId });
        setRecommendItems(safeItems(data));
      } catch {
        setRecommendItems([]);
      }
    })();
  }, [props.open, userId]);

  useEffect(() => {
    if (!props.open) return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<any>;
      const g = String(ce?.detail?.group || '');
      if (g !== 'want' && g !== 'recommend') return;
      void (async () => {
        try {
          const data = await api.getSidebarItems({ group: g as any, userId });
          const items = safeItems(data);
          if (g === 'want') setWantItems(items);
          if (g === 'recommend') setRecommendItems(items);
        } catch {
        }
      })();
    };
    window.addEventListener('sipsnaps:sidebar:refresh', handler);
    return () => window.removeEventListener('sipsnaps:sidebar:refresh', handler);
  }, [props.open, userId]);

  const onSubmit = async (payload: { title: string; note: string; imageUrl: string }) => {
    const title = payload.title.trim();
    if (!title || saving || editMode.kind === 'none') return;
    setSaving(true);
    try {
      if (editMode.kind === 'create') {
        const res = await api.createSidebarItem({ userId, group: editMode.group, title, note: payload.note, imageUrl: payload.imageUrl });
        const id = Number(res?.id);
        if (!Number.isFinite(id)) throw new Error('Invalid create response');
      } else if (editMode.kind === 'edit') {
        const res = await api.updateSidebarItem(editMode.item.id, { title, note: payload.note, imageUrl: payload.imageUrl });
        if (res?.error) throw new Error(String(res.error));
      }

      const group = editMode.kind === 'edit' ? editMode.group : editMode.kind === 'create' ? editMode.group : null;
      if (group) {
        const data = await api.getSidebarItems({ group, userId });
        const items = safeItems(data);
        if (group === 'want') setWantItems(items);
        if (group === 'recommend') setRecommendItems(items);
      }
      setEditMode({ kind: 'none' });
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: SidebarItem) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.deleteSidebarItem(item.id);
      const data = await api.getSidebarItems({ group: item.group_key, userId });
      const items = safeItems(data);
      if (item.group_key === 'want') setWantItems(items);
      if (item.group_key === 'recommend') setRecommendItems(items);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const saveAvatar = async (nextUrl: string) => {
    const next = (nextUrl || '').trim();
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.updateProfile({ userId, avatarUrl: next });
      if (res?.error) throw new Error(String(res.error));
      const stored = typeof res?.avatar_url === 'string' ? res.avatar_url : next;
      setProfile((p) => ({ ...p, avatar_url: stored }));
      setAvatarEditing(false);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {props.open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={props.onClose} />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute top-0 right-0 h-full w-[min(360px,86vw)] bg-white shadow-2xl rounded-l-[28px] border-l border-gray-100 overflow-hidden flex flex-col"
          >
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setAvatarEditing(true);
                }}
                className="flex items-center gap-3 text-left"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center text-gray-700 font-black">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(userId)}</span>
                  )}
                </div>
                <div>
                  <div className="h-12 flex items-center">
                    <div className="text-sm font-black text-gray-900">我的收纳</div>
                  </div>
                </div>
              </button>

              <button type="button" onClick={props.onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center" aria-label="关闭侧边栏">
                <X size={18} className="text-gray-700" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <SidebarGroupSection
                groupKey="want"
                title="想喝"
                items={wantItems}
                expanded={expanded.want}
                onToggle={() => setExpanded((p) => ({ ...p, want: !p.want }))}
                onCreate={() => setEditMode({ kind: 'create', group: 'want' })}
                onEdit={(item) => setEditMode({ kind: 'edit', group: 'want', item })}
                onDelete={(item) => void onDelete(item)}
              />
              <SidebarGroupSection
                groupKey="recommend"
                title="推荐"
                items={recommendItems}
                expanded={expanded.recommend}
                onToggle={() => setExpanded((p) => ({ ...p, recommend: !p.recommend }))}
                onCreate={() => setEditMode({ kind: 'create', group: 'recommend' })}
                onEdit={(item) => setEditMode({ kind: 'edit', group: 'recommend', item })}
                onDelete={(item) => void onDelete(item)}
              />
            </div>

            <SidebarItemSheet mode={editMode} saving={saving} onClose={() => setEditMode({ kind: 'none' })} onSave={(p) => void onSubmit(p)} />
            <AvatarSheet open={avatarEditing} saving={saving} initialUrl={profile.avatar_url} onClose={() => setAvatarEditing(false)} onSave={(u) => void saveAvatar(u)} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
