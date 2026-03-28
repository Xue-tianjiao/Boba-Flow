import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

interface DrinkLog {
  id: number;
  brand: string;
  name: string;
  specs: string;
  image_url: string;
  created_at: string;
}

type FavoriteCard = {
  name?: string;
  description?: string;
  image_url?: string;
};

export default function ProfileView({ onResetOnboarding }: { onResetOnboarding: () => void }) {
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [loading, setLoading] = useState(false);

  const favoriteCard = useMemo<FavoriteCard | null>(() => {
    try {
      const raw = localStorage.getItem('sipsnaps:favoriteCard');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const answers = useMemo<string[]>(() => {
    try {
      const raw = localStorage.getItem('sipsnaps:onboardingAnswers');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const userName = 'Felix';
  const userAvatar = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Felix';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getLogs();
        setLogs(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden">
            <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{userName}</div>
            <div className="text-xs text-gray-500">Your drink memory, beautifully curated.</div>
          </div>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100" aria-label="Settings">
          <Settings size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Soul Mate Drink</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{favoriteCard?.name || 'Classic Milk Tea'}</div>
          </div>
          <Sparkles size={20} className="text-yellow-400" />
        </div>

        <div className="flex gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center text-3xl flex-shrink-0">
            {favoriteCard?.image_url ? (
              <img src={favoriteCard.image_url} className="w-full h-full object-cover" />
            ) : (
              '🧋'
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 leading-relaxed">
              {favoriteCard?.description || 'A timeless match — balanced, smooth, and always in style.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {answers.slice(0, 5).map((a) => (
                <span key={a} className="text-[11px] px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => {
              localStorage.removeItem('sipsnaps:onboarded');
              localStorage.removeItem('sipsnaps:onboardingAnswers');
              localStorage.removeItem('sipsnaps:favoriteCard');
              onResetOnboarding();
            }}
            className="flex-1 py-3 rounded-xl bg-gray-100 font-medium text-gray-700"
          >
            Redo Preferences
          </button>
          <button
            onClick={() => window.location.reload()}
            className="py-3 px-4 rounded-xl bg-black text-white font-medium"
            aria-label="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-gray-900">My Memories</h3>
          <div className="text-xs text-gray-400">{logs.length} items</div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No logs yet. Scan your first drink.</div>
        ) : (
          logs.map((log) => {
             const date = new Date(log.created_at);
             const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
             const specParts = log.specs.split(' / ');
             const subline1 = specParts.slice(0, 2).join(' • ');
             const subline2 = specParts.slice(2, 4).join(' • ').replace(/甜度:|风味:/g, '');

             return (
               <div key={log.id} className="bg-white p-4 rounded-[32px] border border-gray-100 flex items-center gap-4 group">
                 <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-50">
                   {log.image_url && <img src={log.image_url} className="w-full h-full object-cover" alt={log.name} />}
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                       <span className="text-[11px] font-medium text-[#8A8F98]">{log.brand}</span>
                       <span className="text-[11px] font-medium text-[#8A8F98]">{dateStr}</span>
                    </div>
                    <div className="font-bold text-[#1A1A1A] truncate">{log.name}</div>
                    <div className="text-[13px] text-[#5A5F66] truncate">{subline1}</div>
                    <div className="text-[13px] text-[#5A5F66] truncate">{subline2}</div>
                 </div>
                 <ChevronRight size={18} className="text-[#D1D5DB] group-hover:text-gray-400" />
               </div>
             );
          })
        )}
      </div>
    </motion.div>
  );
}

