import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { SidebarGroupKey, SidebarItem } from './types';

export default function SidebarGroupSection(props: {
  groupKey: SidebarGroupKey;
  title: string;
  items: SidebarItem[];
  expanded: boolean;
  onToggle: () => void;
  onCreate: () => void;
  onEdit: (item: SidebarItem) => void;
  onDelete: (item: SidebarItem) => void;
}) {
  return (
    <div className="rounded-[24px] border border-gray-100 bg-white overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <button type="button" onClick={props.onToggle} className="flex items-center gap-2" aria-label={`切换分组 ${props.title}`}
        >
          <ChevronDown size={18} className={`text-gray-500 transition-transform ${props.expanded ? 'rotate-180' : ''}`} />
          <span className="text-sm font-black text-gray-900">{props.title}</span>
          <span className="text-xs font-semibold text-gray-400">{props.items.length}</span>
        </button>

        <div className="w-9 h-9" />
      </div>

      <AnimatePresence initial={false}>
        {props.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
          >
            {props.items.length ? (
              props.groupKey === 'want' || props.groupKey === 'recommend' ? (
                <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {props.items.map((item) => (
                    <div
                      key={item.id}
                      className={
                        props.groupKey === 'want'
                          ? 'relative w-24 aspect-square flex-shrink-0 rounded-[18px] border border-gray-100 bg-white overflow-hidden shadow-[4px_6px_14px_rgba(17,24,39,0.08)]'
                          : 'relative w-40 aspect-[4/3] flex-shrink-0 rounded-[18px] border border-gray-100 bg-white overflow-hidden shadow-[4px_6px_14px_rgba(17,24,39,0.08)]'
                      }
                    >
                      {item.image_url ? <img src={item.image_url} alt="thumb" className="w-full h-full object-contain" /> : null}

                      <button
                        type="button"
                        onClick={() => props.onDelete(item)}
                        className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur border border-gray-100 shadow-sm flex items-center justify-center"
                        aria-label="删除"
                        title="删除"
                      >
                        <Trash2 size={14} className="text-gray-700" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {props.items.map((item) => (
                    <div key={item.id} className="rounded-[18px] border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-start gap-3">
                        {item.image_url ? (
                          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 overflow-hidden flex-shrink-0">
                            <img src={item.image_url} alt="thumb" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex-shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black text-gray-900 truncate">{item.title}</div>
                          {item.note ? <div className="text-xs font-semibold text-gray-500 mt-0.5 line-clamp-2">{item.note}</div> : null}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button type="button" onClick={() => props.onEdit(item)} className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center" aria-label="编辑">
                            <Pencil size={16} className="text-gray-700" />
                          </button>
                          <button type="button" onClick={() => props.onDelete(item)} className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center" aria-label="删除">
                            <Trash2 size={16} className="text-gray-700" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="rounded-[18px] border border-dashed border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-400">还没有条目，先加一个吧</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
