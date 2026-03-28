import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { EditMode } from './types';

export default function SidebarItemSheet(props: {
  mode: EditMode;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; note: string; imageUrl: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (props.mode.kind === 'none') return;
    if (props.mode.kind === 'create') {
      setTitle('');
      setNote('');
      setImageUrl('');
      return;
    }
    setTitle(props.mode.item.title);
    setNote(props.mode.item.note || '');
    setImageUrl(props.mode.item.image_url || '');
  }, [props.mode]);

  return (
    <AnimatePresence>
      {props.mode.kind !== 'none' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 flex items-end"
          onClick={props.onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-[28px] p-5 border-t border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-gray-900">{props.mode.kind === 'create' ? '新增条目' : '编辑条目'}</div>
              <button type="button" onClick={props.onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-700" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="标题（必填）"
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-black/5"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="备注（可选）"
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-black/5 min-h-[88px]"
              />
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="图片链接（可选）"
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={props.onClose} className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-bold">
                取消
              </button>
              <button
                type="button"
                onClick={() => props.onSave({ title, note, imageUrl })}
                disabled={props.saving || !title.trim()}
                className="flex-1 h-12 rounded-2xl bg-black text-white font-bold disabled:opacity-60"
              >
                保存
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

