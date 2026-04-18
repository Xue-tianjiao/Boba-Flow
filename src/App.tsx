import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Camera, RefreshCw, Sparkles, Share2, Check, Footprints, ChevronRight, ChevronLeft, Trash2, X, Plus, Calendar as CalendarIcon, MessageCircle, Send, Menu, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from './services/api';
import OnboardingView from './components/OnboardingView';
import SidebarDrawer from './components/SidebarDrawer';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-4 max-w-xs mx-auto">{this.state.error?.message}</p>
            <button 
              onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
              }}
              className="bg-black text-white px-6 py-2 rounded-full font-medium"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface DrinkLog {
  id: number;
  brand: string;
  name: string;
  specs: string;
  image_url: string;
  created_at: string;
}

const BRAND_LOGOS: Record<string, string> = {
    // International
    "Starbucks": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/240px-Starbucks_Corporation_Logo_2011.svg.png",
    "星巴克": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/240px-Starbucks_Corporation_Logo_2011.svg.png",
    // China
    "HeyTea": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Heytea_logo.svg/240px-Heytea_logo.svg.png",
    "喜茶": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Heytea_logo.svg/240px-Heytea_logo.svg.png",
    "Luckin": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7e/Luckin_Coffee_logo.svg/240px-Luckin_Coffee_logo.svg.png",
    "瑞幸": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7e/Luckin_Coffee_logo.svg/240px-Luckin_Coffee_logo.svg.png",
    "瑞幸咖啡": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7e/Luckin_Coffee_logo.svg/240px-Luckin_Coffee_logo.svg.png",
    "Mixue": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Mixue_Bingcheng_logo.svg/240px-Mixue_Bingcheng_logo.svg.png",
    "蜜雪冰城": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Mixue_Bingcheng_logo.svg/240px-Mixue_Bingcheng_logo.svg.png",
    "Coco": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/CoCo_Fresh_Tea_%26_Juice_Logo.svg/240px-CoCo_Fresh_Tea_%26_Juice_Logo.svg.png",
    "都可": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/CoCo_Fresh_Tea_%26_Juice_Logo.svg/240px-CoCo_Fresh_Tea_%26_Juice_Logo.svg.png",
    "Gong Cha": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Gong_Cha_Logo.svg/240px-Gong_Cha_Logo.svg.png",
    "贡茶": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Gong_Cha_Logo.svg/240px-Gong_Cha_Logo.svg.png",
    "Nayuki": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Nayuki_logo.svg/240px-Nayuki_logo.svg.png",
    "奈雪的茶": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Nayuki_logo.svg/240px-Nayuki_logo.svg.png",
};

const getSmartBrandLogo = (brand: string) => {
    if (!brand) return "";
    // 1. Try exact match
    if (BRAND_LOGOS[brand]) return BRAND_LOGOS[brand];
    // 2. Try partial match
    const key = Object.keys(BRAND_LOGOS).find(k => brand.includes(k) || k.includes(brand));
    if (key) return BRAND_LOGOS[key];
    // 3. Fallback to DiceBear Initials (Consistent with HomeView)
    const seed = brand || 'drink';
    return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=f3f4f6&textColor=1f2937`;
}

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'footprint'>('home');
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('sipsnaps:onboarded') !== '1');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (showOnboarding) {
      return <OnboardingView onComplete={() => {
        setShowOnboarding(false);
        setActiveTab('footprint'); // Default to footprint after onboarding? Or Home? Let's say footprint as per user flow
      }} />;
  }

  return (
    <ErrorBoundary>
    <div className="h-screen bg-gray-50 text-gray-900 font-sans flex justify-center overflow-hidden">
      <main className="w-full max-w-md h-full bg-white shadow-xl overflow-hidden relative flex flex-col transform-gpu">

        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          id="global-sidebar-button"
          className="absolute top-6 right-6 z-30 w-10 h-10 rounded-full bg-gray-100 border border-gray-100 text-gray-700 shadow-sm flex items-center justify-center hover:bg-gray-200"
          aria-label="打开侧边栏"
        >
          <Menu size={20} />
        </button>

        <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className="flex-1 overflow-y-auto pb-32">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && <HomeView key="home" />}
            {activeTab === 'footprint' && <FootprintView key="footprint" />}
          </AnimatePresence>
        </div>

        {/* Floating Nav Pill */}
        <div className="fixed bottom-6 left-0 right-0 z-20 flex justify-center pointer-events-none">
            <nav className="bg-white rounded-full shadow-2xl border border-gray-100 px-2 py-2 flex items-center gap-1 pointer-events-auto">
                <NavButton 
                    active={activeTab === 'home'} 
                    onClick={() => setActiveTab('home')} 
                    icon={<Sparkles size={20} />} 
                    label="今日" 
                />
                <div className="w-px h-6 bg-gray-200 mx-2"></div>
                <NavButton 
                    active={activeTab === 'footprint'} 
                    onClick={() => setActiveTab('footprint')} 
                    icon={<Footprints size={20} />} 
                    label="足迹" 
                />
            </nav>
        </div>
      </main>
    </div>
    </ErrorBoundary>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
        onClick={onClick} 
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 ${active ? 'bg-black text-white' : 'text-gray-400 hover:bg-gray-50'}`}
    >
      {icon}
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

// --- Views ---

function HomeView() {
  const [adUrls, setAdUrls] = useState<string[]>([]);
  const [exploreUrls, setExploreUrls] = useState<string[]>([]);
  const [likedExploreUrls, setLikedExploreUrls] = useState<Set<string>>(() => new Set());
  const [explorePage, setExplorePage] = useState(0);
  const [fly, setFly] = useState<null | { key: string; src: string; from: { top: number; left: number; width: number; height: number }; to: { top: number; left: number } }>(null);
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: '我是 AI 饮品对话小助手。告诉我你想喝什么风格（咖啡/奶茶/茶饮）、是否控糖、预算和口味偏好，我来给你 3 个可点的推荐。' }
  ]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantSending, setAssistantSending] = useState(false);
  const assistantEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      const normalize = (data: any) => (Array.isArray(data?.urls) ? data.urls.filter((u: any) => typeof u === 'string') : []);
      const tryFetchJson = async (url: string) => {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        return await res.json();
      };
      let nextAdUrls: string[] = [];
      try {
        const data = await tryFetchJson('/ads/picture/manifest.json');
        const urls = normalize(data);
        if (urls.length) nextAdUrls = urls;
      } catch {
      }
      if (!nextAdUrls.length) {
        try {
          const data = await tryFetchJson('/picture/manifest.json');
          const urls = normalize(data);
          if (urls.length) nextAdUrls = urls;
        } catch {
        }
      }
      if (!nextAdUrls.length) {
        try {
          const data = await tryFetchJson('/api/ads/pictures');
          nextAdUrls = normalize(data);
        } catch {
          nextAdUrls = [];
        }
      }
      setAdUrls(nextAdUrls);

      // Load explore pictures
      let nextExploreUrls: string[] = [];
      try {
        const data = await tryFetchJson('/api/explore/pictures');
        if (Array.isArray(data?.urls) && data.urls.length) {
          nextExploreUrls = data.urls;
        } else {
          const mData = await tryFetchJson('/explore/picture/manifest.json?t=' + Date.now());
          const urls = normalize(mData);
          if (urls.length) nextExploreUrls = urls;
        }
      } catch {
        try {
          const data = await tryFetchJson('/explore/picture/manifest.json?t=' + Date.now());
          const urls = normalize(data);
          if (urls.length) nextExploreUrls = urls;
        } catch (e) {
          console.error('Failed to load explore pictures:', e);
          setExploreUrls([]);
        }
      }

      if (nextExploreUrls.length) {
        setExploreUrls(nextExploreUrls);
        setExplorePage(0);
      }

      try {
        const want = await api.getSidebarItems({ group: 'want', userId: 'guest' });
        const items = Array.isArray(want) ? want : Array.isArray(want?.items) ? want.items : [];
        const liked = new Set<string>();
        for (const it of items) {
          if (it && typeof it.image_url === 'string' && it.image_url) liked.add(it.image_url);
        }
        setLikedExploreUrls(liked);
      } catch {
      }
    })();
  }, []);

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(exploreUrls.length / 4));
    setExplorePage((p) => (p >= pageCount ? 0 : p));
  }, [exploreUrls.length]);

  useEffect(() => {
    if (!fly) return;
    const t = window.setTimeout(() => setFly(null), 900);
    return () => window.clearTimeout(t);
  }, [fly]);

  const titleFromUrl = (url: string) => {
    const last = (url || '').split('/').pop() || '';
    const decoded = (() => {
      try {
        return decodeURIComponent(last);
      } catch {
        return last;
      }
    })();
    const base = decoded.replace(/\.[^.]+$/, '').trim();
    return (base || '饮品').slice(0, 60);
  };

  const addToWant = async (url: string, cardEl: HTMLElement | null) => {
    if (!url) return;
    if (likedExploreUrls.has(url)) return;

    setLikedExploreUrls((prev) => {
      const next = new Set(prev);
      next.add(url);
      return next;
    });

    try {
      if (cardEl) {
        const from = cardEl.getBoundingClientRect();
        const menu = document.getElementById('global-sidebar-button');
        if (menu) {
          const toRect = menu.getBoundingClientRect();
          const toTop = toRect.top + toRect.height / 2 - 12;
          const toLeft = toRect.left + toRect.width / 2 - 12;
          setFly({
            key: `${Date.now()}-${Math.random()}`,
            src: url,
            from: { top: from.top, left: from.left, width: from.width, height: from.height },
            to: { top: toTop, left: toLeft }
          });
        }
      }

      await api.createSidebarItem({
        userId: 'guest',
        group: 'want',
        title: titleFromUrl(url),
        note: '来自今日',
        imageUrl: url
      });
      window.dispatchEvent(new CustomEvent('sipsnaps:sidebar:refresh', { detail: { group: 'want' } }));
    } catch (e) {
      console.error(e);
      setLikedExploreUrls((prev) => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };

  const removeFromWant = async (url: string) => {
    if (!url) return;
    if (!likedExploreUrls.has(url)) return;

    setLikedExploreUrls((prev) => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });

    try {
      const items = await api.getSidebarItems({ group: 'want', userId: 'guest' });
      if (Array.isArray(items)) {
        const targets = items.filter((it: any) => it && typeof it.image_url === 'string' && it.image_url === url);
        for (const t of targets) {
          const id = Number(t?.id);
          if (Number.isFinite(id)) await api.deleteSidebarItem(id);
        }
      }
      window.dispatchEvent(new CustomEvent('sipsnaps:sidebar:refresh', { detail: { group: 'want' } }));
    } catch (e) {
      console.error(e);
      setLikedExploreUrls((prev) => {
        const next = new Set(prev);
        next.add(url);
        return next;
      });
    }
  };

  const toggleWant = async (url: string, cardEl: HTMLElement | null) => {
    if (likedExploreUrls.has(url)) {
      await removeFromWant(url);
      return;
    }
    await addToWant(url, cardEl);
  };

  const explorePageCount = Math.max(1, Math.ceil(exploreUrls.length / 4));
  const visibleExploreUrls = exploreUrls.slice(explorePage * 4, explorePage * 4 + 4);
  const cycleExplore = () => {
    if (explorePageCount <= 1) return;
    setExplorePage((p) => (p + 1) % explorePageCount);
  };

  useEffect(() => {
    if (!showAssistant) return;
    assistantEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [showAssistant, assistantMessages.length]);

  const sendAssistant = async () => {
    const text = assistantInput.trim();
    if (!text || assistantSending) return;
    setAssistantSending(true);
    const next = [...assistantMessages, { role: 'user', content: text } as const];
    const placeholderIndex = next.length;
    setAssistantMessages([...next, { role: 'assistant', content: '' } as const]);
    setAssistantInput('');
    try {
      await api.assistantChatStream({
        messages: next,
        onDelta: (delta) => {
          if (!delta) return;
          setAssistantMessages((prev) => {
            const copy = prev.slice();
            const target = copy[placeholderIndex];
            if (!target || target.role !== 'assistant') return prev;
            copy[placeholderIndex] = { role: 'assistant', content: `${target.content || ''}${delta}` } as const;
            return copy;
          });
        },
        onDone: ({ reply }) => {
          setAssistantMessages((prev) => {
            const copy = prev.slice();
            const target = copy[placeholderIndex];
            if (!target || target.role !== 'assistant') return prev;
            copy[placeholderIndex] = { role: 'assistant', content: reply || target.content || '我这边没拿到回复，要不你换个问法试试？' } as const;
            return copy;
          });
        },
        onError: () => {
          setAssistantMessages((prev) => {
            const copy = prev.slice();
            const target = copy[placeholderIndex];
            if (!target || target.role !== 'assistant') return prev;
            copy[placeholderIndex] = { role: 'assistant', content: target.content || '对话请求失败了，稍后再试试。' } as const;
            return copy;
          });
        }
      });
    } catch (e) {
      console.error(e);
      setAssistantMessages((prev) => {
        const copy = prev.slice();
        const target = copy[placeholderIndex];
        if (!target || target.role !== 'assistant') return [...prev, { role: 'assistant', content: '对话请求失败了，稍后再试试。' } as const];
        copy[placeholderIndex] = { role: 'assistant', content: target.content || '对话请求失败了，稍后再试试。' } as const;
        return copy;
      });
    } finally {
      setAssistantSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.25 }}
      className="px-6 pt-8 pb-6"
    >
      <button
        type="button"
        onClick={() => setShowAssistant(true)}
        className="fixed bottom-24 right-6 z-30 w-14 h-14 rounded-full bg-black text-white shadow-lg flex items-center justify-center hover:bg-gray-900"
        title="AI 对话"
      >
        <MessageCircle size={22} />
      </button>

      <AnimatePresence>
        {showAssistant && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowAssistant(false)} />
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute left-1/2 -translate-x-1/2 bottom-20 w-[min(420px,calc(100vw-32px))] max-w-md bg-white rounded-[28px] border border-gray-100 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <div>
                  <div className="text-sm font-black text-gray-900">AI 饮品对话小助手</div>
                  <div className="text-[11px] font-semibold text-gray-500 mt-0.5">聊聊口味偏好，我来给你推荐</div>
                </div>
                <button type="button" onClick={() => setShowAssistant(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={18} className="text-gray-700" />
                </button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
                {assistantMessages.map((m, idx) => (
                  <div key={idx} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        m.role === 'user'
                          ? 'max-w-[85%] rounded-2xl bg-black text-white px-4 py-2 text-sm font-semibold whitespace-pre-wrap'
                          : 'max-w-[85%] rounded-2xl bg-white border border-gray-100 text-gray-900 px-4 py-2 text-sm font-semibold whitespace-pre-wrap'
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={assistantEndRef} />
              </div>

              <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input
                    value={assistantInput}
                    onChange={(e) => setAssistantInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendAssistant();
                      }
                    }}
                    placeholder="例如：想喝低糖、清爽一点的咖啡，预算30以内"
                    className="flex-1 bg-gray-100 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-black/5 transition-all text-sm font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => void sendAssistant()}
                    disabled={assistantSending || !assistantInput.trim()}
                    className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center disabled:opacity-60"
                    title="发送"
                  >
                    {assistantSending ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-4">
        <div className="text-4xl font-black text-gray-900 tracking-tight">尝鲜</div>
        <div className="text-xs text-gray-400 font-medium mt-1">你的饮品百科全书</div>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-black text-gray-900">活动</div>
        </div>

        {adUrls.length ? (
          <div className="flex overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {adUrls.map((url) => (
              <div key={url} className="snap-start w-full flex-shrink-0">
                <div className="w-full text-left rounded-[28px] border border-gray-100 bg-white overflow-hidden shadow-[4px_6px_14px_rgba(17,24,39,0.08)]">
                  <div className="w-full aspect-[16/10] bg-gray-50">
                    <img src={url} alt="活动广告" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 text-sm font-semibold text-gray-400">暂无活动</div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-black text-gray-900">探索</div>
          <button
            type="button"
            onClick={cycleExplore}
            className="h-9 px-3 rounded-full bg-gray-100 border border-gray-100 text-gray-700 font-bold text-xs flex items-center gap-2 disabled:opacity-60"
            disabled={explorePageCount <= 1}
            aria-label="再探"
          >
            <RefreshCw size={16} className={explorePageCount > 1 ? '' : 'opacity-60'} />
            <span>再探</span>
          </button>
        </div>
        
        {visibleExploreUrls.length ? (
          <div className="grid grid-cols-2 gap-4">
            {visibleExploreUrls.map((url, idx) => (
              <div key={idx} data-explore-card className="relative w-full rounded-[28px] border border-gray-100 bg-white overflow-hidden shadow-[4px_6px_14px_rgba(17,24,39,0.08)]">
                <img src={url} alt={`探索-${idx}`} className="w-full h-auto object-contain" loading="lazy" />
                <button
                  type="button"
                  onClick={(e) => {
                    const card = (e.currentTarget.closest('[data-explore-card]') as HTMLElement | null) || null;
                    void toggleWant(url, card);
                  }}
                  className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white/90 border border-gray-100 shadow-sm flex items-center justify-center"
                  aria-label="加入想喝"
                >
                  <Heart size={18} className={likedExploreUrls.has(url) ? 'text-red-500' : 'text-gray-400'} fill={likedExploreUrls.has(url) ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 text-sm font-semibold text-gray-400">暂无探索图片，请将图片放置到 public/explore/picture/ 并在 manifest.json 中配置。</div>
        )}
      </div>

      <AnimatePresence>
        {fly && (
          <motion.img
            key={fly.key}
            src={fly.src}
            initial={{
              position: 'fixed',
              top: fly.from.top,
              left: fly.from.left,
              width: fly.from.width,
              height: fly.from.height,
              borderRadius: 28,
              opacity: 0.95,
              zIndex: 80
            }}
            animate={{
              top: fly.to.top,
              left: fly.to.left,
              width: 24,
              height: 24,
              borderRadius: 9999,
              opacity: 0
            }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="pointer-events-none object-cover shadow-2xl"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ScanView({ onSuccess }: { onSuccess: () => void }) {
    const [image, setImage] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [editSpec, setEditSpec] = useState('');
    const [editCupType, setEditCupType] = useState('');
    const [editSweetness, setEditSweetness] = useState('');
    const [editFlavor, setEditFlavor] = useState('');
    const [editDate, setEditDate] = useState(new Date().toISOString().split('T')[0]);
    const [editPrice, setEditPrice] = useState('');
    const [thumb, setThumb] = useState<string | null>(null);
    const [generatingArt, setGeneratingArt] = useState(false);

    const cropImage = async (sourceImage: string, bbox: any) => {
        if (!bbox) return null;
        const { x, y, w, h } = bbox;
        if (![x, y, w, h].every(n => Number.isFinite(n))) return null;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = sourceImage;
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('image load failed'));
        });

        const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

        const nx = clamp(x, 0, 1);
        const ny = clamp(y, 0, 1);
        const nw = clamp(w, 0, 1 - nx);
        const nh = clamp(h, 0, 1 - ny);

        const sx = clamp(Math.floor(img.width * nx), 0, img.width - 1);
        const sy = clamp(Math.floor(img.height * ny), 0, img.height - 1);
        const sw = clamp(Math.floor(img.width * nw), 1, img.width - sx);
        const sh = clamp(Math.floor(img.height * nh), 1, img.height - sy);

        const maxOut = 256;
        const scale = Math.min(1, maxOut / Math.max(sw, sh));
        const outW = Math.max(1, Math.floor(sw * scale));
        const outH = Math.max(1, Math.floor(sh * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Enable high quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
        return canvas.toDataURL('image/png');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            setImage(base64);
            setAnalyzing(true);
            
            // Extract base64 data only
            const base64Data = base64.split(',')[1];
            try {
                const data = await api.identifyDrink(base64Data, file.type);
                setResult(data);
                if (data?.error) {
                    alert(data.error);
                }
                setEditSpec(data?.spec || data?.specs || '');
                setEditCupType(data?.cup_type || '');
                setEditSweetness(data?.sweetness || '');
                setEditFlavor(data?.flavor || '');
                setEditPrice(data?.price ? String(data.price) : '');
                
                // Prioritize AI Cropping
                let croppedUrl = null;
                if (data.thumb_bbox) {
                    try {
                        croppedUrl = await cropImage(base64, data.thumb_bbox);
                    } catch (cropErr) {
                        console.error("Crop failed:", cropErr);
                    }
                }

                if (croppedUrl) {
                    setThumb(croppedUrl);
                } else if (data?.brand) {
                    const logoUrl = getSmartBrandLogo(data.brand);
                    setThumb(logoUrl);
                } else {
                    setThumb(null);
                }
                
            } catch (err) {
                console.error(err);
                alert("Failed to identify drink");
            } finally {
                setAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const resetAll = () => {
        // If canceling from initial upload screen, we should probably go back
        // But for "reset" button inside the view, we just clear fields.
        // We'll add a "Close" button to the top right to exit ScanView.
        setImage(null);
        setResult(null);
        setThumb(null);
        setEditSpec('');
        setEditCupType('');
        setEditSweetness('');
        setEditFlavor('');
        setEditPrice('');
        setAnalyzing(false);
        setGeneratingArt(false);
    };

    const isValidSpec = (val: string) => {
        if (!val) return false;
        const lower = val.toLowerCase().trim();
        return !['unknown', '未提及', '未识别', '无', 'none', 'n/a'].includes(lower);
    };

    const handleSave = async () => {
        if (!result || !image) return;
        try {
            // "如果某个规格未提及，那么对应的规格就不要展示，而不是展示未提及"
            // Filter out empty values here before joining
            const specs = [
                isValidSpec(editSpec) ? editSpec : '', 
                isValidSpec(editCupType) ? `杯型:${editCupType}` : '', 
                isValidSpec(editSweetness) ? `甜度:${editSweetness}` : '', 
                isValidSpec(editFlavor) ? `风味:${editFlavor}` : '',
                editPrice ? `价格:¥${editPrice}` : ''
            ]
                .filter(Boolean)
                .join(' / ');
                
            const res = await api.addLog({
                brand: result.brand,
                name: result.name,
                specs,
                image_url: thumb || image,
                avatar_url: "",
                created_at: editDate // Pass custom date
            });
            if (res.error) {
                throw new Error(res.error);
            }
            onSuccess();
        } catch (e: any) {
            console.error(e);
            alert("保存失败: " + (e.message || "Unknown error"));
        }
    }

    const handleGenerateArt = async () => {
        if (!result) return;
        setGeneratingArt(true);
        try {
            // Construct a rich prompt based on identified data
            const promptParts = [
                result.brand,
                result.name,
                editSpec,
                editCupType,
                editFlavor,
                result.description
            ].filter(Boolean);
            
            const prompt = `Professional product photography of a bubble tea drink: ${promptParts.join(', ')}. High quality, 4k, studio lighting, advertising style.`;
            
            const data = await api.generateImage({ prompt });
            if (data.error) {
                throw new Error(data.error);
            }
            if (data.imageUrl) {
                setThumb(data.imageUrl);
            }
        } catch (e: any) {
            console.error("Art Gen Error:", e);
            alert("生成图片失败: " + (e.message || "Unknown error"));
        } finally {
            setGeneratingArt(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-0 z-50 bg-white flex flex-col">
            
            {/* Header */}
            <div className="px-6 pt-8 pb-4 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="text-2xl font-bold text-gray-900">智能识茶</div>
                <div className="flex items-center gap-2">
                    {image && (
                        <button onClick={resetAll} className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">重新上传</button>
                    )}
                    <button 
                        onClick={onSuccess} 
                        className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-24">
                {/* Always show the Scan Card */}
                <div className="mt-8">
                    <div className="relative group cursor-pointer">
                        <div className="w-full aspect-[16/9] bg-black rounded-[32px] p-8 flex items-center gap-6 shadow-xl relative overflow-hidden">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                <Camera size={32} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">智能识茶</h3>
                                <p className="text-sm text-white/50">拍摄或上传截图，AI 自动识别</p>
                            </div>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 space-y-6">
                    {/* Image Preview / Art Gen - Only if image exists */}
                    {image && (
                        <div className="bg-gray-50 rounded-[32px] p-6 flex items-center gap-5">
                            <div className="relative w-24 h-24 rounded-full bg-white overflow-hidden border-4 border-white shadow-sm flex-shrink-0">
                                <img
                                    src={thumb || image}
                                    className="w-full h-full object-cover"
                                />
                                {generatingArt && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <RefreshCw className="animate-spin text-white" size={24} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">饮品头像</div>
                                <button 
                                    onClick={handleGenerateArt}
                                    disabled={generatingArt || analyzing}
                                    className="flex items-center gap-2 text-sm font-bold text-gray-900 bg-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-shadow disabled:opacity-50"
                                >
                                    <Sparkles size={16} />
                                    重新生成
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Form Fields - Always visible for manual entry */}
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 tracking-widest ml-4 uppercase">品牌</label>
                            <input
                                value={result?.brand || ''}
                                onChange={(e) => setResult({ ...(result || {}), brand: e.target.value })}
                                className="w-full bg-gray-50 rounded-[24px] px-6 py-4 text-xl font-bold text-gray-900 outline-none focus:bg-gray-100 transition-colors"
                                placeholder="输入品牌"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 tracking-widest ml-4 uppercase">品名</label>
                            <input
                                value={result?.name || ''}
                                onChange={(e) => setResult({ ...(result || {}), name: e.target.value })}
                                className="w-full bg-gray-50 rounded-[24px] px-6 py-4 text-xl font-bold text-gray-900 outline-none focus:bg-gray-100 transition-colors"
                                placeholder="输入品名"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <EditableTile label="规格" value={editSpec} onChange={setEditSpec} />
                            <EditableTile label="杯型" value={editCupType} onChange={setEditCupType} />
                            <EditableTile label="甜度" value={editSweetness} onChange={setEditSweetness} />
                            <EditableTile label="风味" value={editFlavor} onChange={setEditFlavor} />
                        </div>

                        <div className="bg-gray-50 rounded-[24px] p-5 flex items-center justify-between group">
                            <div className="flex-1">
                                <div className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 uppercase">饮用日期</div>
                                <input 
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="bg-transparent text-xl font-bold text-gray-900 outline-none w-full"
                                />
                            </div>
                            <CalendarIcon size={20} className="text-gray-400" />
                        </div>

                        <div className="bg-gray-50 rounded-[24px] p-5 flex items-center justify-between group">
                            <div className="flex-1">
                                <div className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 uppercase">价格</div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xl font-bold text-gray-900">¥</span>
                                    <input 
                                        type="number"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                        className="bg-transparent text-xl font-bold text-gray-900 outline-none w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {analyzing && (
                        <div className="text-center py-4">
                            <RefreshCw className="animate-spin mx-auto text-blue-500" />
                            <p className="text-xs text-gray-400 mt-2">AI 正在深度解析中...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Button */}
            <div className="p-6 bg-white border-t border-gray-50 sticky bottom-0">
                <button
                    onClick={handleSave}
                    disabled={(!image && (!result?.brand || !result?.name)) || analyzing}
                    className="w-full bg-black text-white py-5 rounded-full font-bold text-lg flex items-center justify-center gap-3 shadow-2xl disabled:opacity-20 transition-all active:scale-95"
                >
                    <Check size={22} />
                    保存 1 个饮品到足迹
                </button>
            </div>
        </motion.div>
    );
}

function EditableTile({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="bg-gray-50 rounded-3xl p-5">
            <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">{label}</div>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent outline-none text-xl font-black text-gray-900"
                placeholder="填写"
            />
        </div>
    );
}

function FootprintView() {
  const [logs, setLogs] = useState<DrinkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DrinkLog | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Statistics Calculation
  const calculateConsecutiveDays = () => {
      if (logs.length === 0) return 0;
      const dates = logs.map(l => new Date(l.created_at).toDateString());
      const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      let count = 0;
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      // Start check
      // If no log today, check from yesterday? Or just 0?
      // "Continuous drinking" usually means streak including today or ended yesterday.
      // Let's keep it simple: count backwards from most recent log if it's today or yesterday.
      
      if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

      for (let i = 0; i < uniqueDates.length; i++) {
          const d = new Date(uniqueDates[i]);
          const expected = new Date();
          expected.setDate(new Date(uniqueDates[0]).getDate() - i);
          
          if (d.toDateString() === expected.toDateString()) {
              count++;
          } else {
              break;
          }
      }
      return count; // Simplified logic for demo
  };

  // Current Month Data Helpers
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const currentMonthLogs = logs.filter(l => {
      const d = new Date(l.created_at);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const getBrandStats = () => {
      // Use current month logs for the main card stats
      const stats: Record<string, number> = {};
      currentMonthLogs.forEach(l => {
          const brand = l.brand || 'Unknown';
          stats[brand] = (stats[brand] || 0) + 1;
      });
      return Object.entries(stats)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Top 5
  };

  const consecutiveDays = calculateConsecutiveDays();
  const brandData = getBrandStats();
  const top3Brands = brandData.slice(0, 3);
  
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentMonthDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);
  
  const hasLogOnDay = (day: number) => {
      return currentMonthLogs.some(l => new Date(l.created_at).getDate() === day);
  };

  const COLORS = ['#000000', '#FF8042', '#00C49F', '#FFBB28', '#FF8042'];

  // --- Modal States ---
  const [activeModal, setActiveModal] = useState<'streak' | 'brand' | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12

  // --- Helper for Calendar Grid ---
  const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month - 1, 1).getDay(); // 0=Sun, 1=Mon...

  const renderCalendarGrid = () => {
      const year = new Date().getFullYear();
      const daysInMonth = getDaysInMonth(selectedMonth, year);
      const firstDay = getFirstDayOfMonth(selectedMonth, year);
      const blanks = Array(firstDay).fill(null);
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      
      const monthLogs = logs.filter(l => {
          const d = new Date(l.created_at);
          return d.getMonth() + 1 === selectedMonth && d.getFullYear() === year;
      });
      const drinkCount = monthLogs.length;

      return (
          <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-6 overflow-x-auto no-scrollbar gap-2 px-1">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <button
                        key={m}
                        onClick={() => setSelectedMonth(m)}
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                            m === selectedMonth 
                            ? 'bg-black text-white ring-4 ring-blue-100' 
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                          {m}月
                      </button>
                  ))}
              </div>

              <div className="grid grid-cols-7 gap-2 mb-6">
                  {['S','M','T','W','T','F','S'].map(d => (
                      <div key={d} className="text-center text-[10px] text-gray-300 font-bold uppercase">{d}</div>
                  ))}
                  {blanks.map((_, i) => <div key={`blank-${i}`} />)}
                  {days.map(d => {
                      const hasDrink = monthLogs.some(l => new Date(l.created_at).getDate() === d);
                      return (
                          <div 
                            key={d} 
                            className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold ${
                                hasDrink ? 'bg-black text-white' : 'bg-gray-50 text-gray-300'
                            }`}
                          >
                              {d}
                          </div>
                      )
                  })}
              </div>

              <div className="mt-auto bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
                  <span className="text-gray-500 font-medium">该月总计饮用</span>
                  <span className="text-2xl font-black text-gray-900">{drinkCount} 次</span>
              </div>
          </div>
      );
  };

  const renderBrandStats = () => {
      const year = new Date().getFullYear();
      const monthLogs = logs.filter(l => {
          const d = new Date(l.created_at);
          return d.getMonth() + 1 === selectedMonth && d.getFullYear() === year;
      });
      
      const stats: Record<string, number> = {};
      monthLogs.forEach(l => {
          const brand = l.brand || 'Unknown';
          stats[brand] = (stats[brand] || 0) + 1;
      });
      const data = Object.entries(stats)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      return (
          <div className="flex flex-col h-full">
               <div className="flex justify-between items-center mb-6 overflow-x-auto no-scrollbar gap-2 px-1">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <button
                        key={m}
                        onClick={() => setSelectedMonth(m)}
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                            m === selectedMonth 
                            ? 'bg-black text-white ring-4 ring-orange-100' 
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                          {m}月
                      </button>
                  ))}
              </div>

              <div className="flex-1 flex flex-col items-center justify-center relative">
                  {data.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <RePieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="text-gray-300 font-bold">本月暂无数据</div>
                  )}
                  {data.length > 0 && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <div className="text-center">
                               <div className="text-3xl font-black text-gray-900">{monthLogs.length}</div>
                               <div className="text-xs text-gray-400 font-bold uppercase">Drinks</div>
                           </div>
                       </div>
                  )}
              </div>

              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                  {data.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                              <span className="text-sm font-bold text-gray-700">{item.name}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{item.value}</span>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  if (selectedLog) {
      return (
          <DrinkDetailView 
            log={selectedLog} 
            onBack={() => {
                setSelectedLog(null);
                fetchLogs(); // Refresh on back
            }}
          />
      );
  }

  if (showScanner) {
      return <ScanView onSuccess={() => {
          setShowScanner(false);
          fetchLogs();
      }} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 pb-24 relative min-h-screen">
      
      {/* Header */}
      <div className="mb-8 mt-4">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-1">饮品足迹</h1>
          <p className="text-gray-400 font-medium">记录你的每一次啜饮。</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-10">
          {/* Calendar / Streak Card */}
          <div 
            onClick={() => { setActiveModal('streak'); setSelectedMonth(new Date().getMonth() + 1); }}
            className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col h-64 relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
          >
              <div className="relative z-10 mb-2">
                  <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-gray-900">{consecutiveDays}</span>
                      <span className="text-sm font-bold text-gray-500">天</span>
                  </div>
                  <div className="text-xs text-gray-400 font-medium mt-1 group-hover:text-black transition-colors">本月连续饮用</div>
              </div>
              
              {/* Mini Calendar Visualization - Current Month */}
              <div className="mt-auto grid grid-cols-7 gap-1">
                  {currentMonthDays.map((d) => {
                      const active = hasLogOnDay(d);
                      return (
                        <div key={d} className={`aspect-square rounded-full flex items-center justify-center text-[8px] font-medium transition-all ${
                            active ? 'bg-black text-white scale-110 shadow-sm' : 'text-gray-300 bg-gray-50'
                        }`}>
                            {d}
                        </div>
                      );
                  })}
              </div>
          </div>

          {/* Brand Preference Card */}
          <div 
            onClick={() => { setActiveModal('brand'); setSelectedMonth(new Date().getMonth() + 1); }}
            className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col h-64 cursor-pointer hover:shadow-md transition-shadow"
          >
              <div className="text-xs text-gray-400 font-medium mb-2">品牌偏好分布</div>
              <div className="flex-1 -ml-4 pointer-events-none relative mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={brandData.length ? brandData : [{name: 'Empty', value: 1}]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {brandData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        {brandData.length === 0 && <Cell fill="#f3f4f6" />}
                      </Pie>
                    </RePieChart>
                  </ResponsiveContainer>
                   {/* Center Label */}
                  {brandData.length > 0 && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none pl-4">
                           <div className="text-center">
                               <div className="text-xl font-black text-gray-900">{currentMonthLogs.length}</div>
                           </div>
                       </div>
                  )}
              </div>
              
              {/* Top 3 List */}
              <div className="space-y-1.5">
                  {top3Brands.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                              <span className="font-bold text-gray-700 truncate max-w-[60px]">{item.name}</span>
                          </div>
                          <span className="font-bold text-gray-400">{item.value}</span>
                      </div>
                  ))}
                  {top3Brands.length === 0 && <div className="text-xs text-gray-300 text-center">本月暂无数据</div>}
              </div>
          </div>
      </div>

      {/* History List */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">历史记录</h2>
      
      {loading ? (
        <div className="text-center py-20">
          <RefreshCw className="animate-spin mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">Loading footprints...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
           <Footprints size={48} className="mx-auto text-gray-300 mb-4" />
           <h3 className="text-lg font-bold text-gray-900">No Footprints Yet</h3>
           <p className="text-sm text-gray-500 mt-1">点击右下角 + 开始记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log, idx) => {
             const date = new Date(log.created_at);
             const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
             const specParts = log.specs.split(' / ');
             
             // Process specs for display:
             // 1. Remove empty parts
             // 2. Remove "杯型:" prefix but keep value? User said "杯型这两个字不要展示" -> implying remove "杯型:" label
             // 3. Remove "甜度:", "风味:" prefixes for cleaner look? User only mentioned "杯型" specifically but previously we did replace for others.
             // Let's follow strictly: "如果某个规格未提及，那么对应的规格就不要展示... 2是杯型这两个字不要展示"
             
             // The specs string is stored as "Spec / 杯型:Type / 甜度:Sweet / 风味:Flavor"
             // We need to clean this up.
             
             const cleanSpecs = specParts.map(part => {
                 if (part.startsWith('杯型:')) return part.replace('杯型:', '');
                 // Keep other prefixes or remove? 
                 // Previous code: .replace(/甜度:|风味:/g, '')
                 // Let's keep consistent with "cleaner look"
                 // Don't show price in feed list as requested: "但是只保存在feed内，不显示在feed展示区里"
                 if (part.startsWith('价格:')) return null;
                 return part.replace(/甜度:|风味:/g, '');
             }).filter(Boolean); // Remove empty strings

             // Join with bullet, only if multiple items
             const subline1 = cleanSpecs.slice(0, 2).join(' • ');
             const subline2 = cleanSpecs.slice(2, 4).join(' • ');

             return (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: idx * 0.05 }}
                 key={log.id} 
                 onClick={() => setSelectedLog(log)}
                 className="bg-white rounded-[32px] p-5 shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow group cursor-pointer"
               >
                 <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 border-2 border-gray-50">
                    <img src={log.image_url} className="w-full h-full object-cover scale-110 translate-x-1 translate-y-1" alt={log.name} />
                 </div>
                 
                 <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                       <span className="text-[12px] font-medium text-[#8A8F98]">{log.brand}</span>
                       <span className="text-[12px] font-medium text-[#8A8F98]">{dateStr}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#1A1A1A] leading-tight mb-1 truncate">{log.name}</h3>
                    {subline1 && <div className="text-[14px] text-[#5A5F66] truncate">{subline1}</div>}
                    {subline2 && <div className="text-[14px] text-[#5A5F66] truncate">{subline2}</div>}
                 </div>

                 <div className="flex-shrink-0 ml-2">
                    <ChevronRight size={20} className="text-[#D1D5DB] group-hover:text-gray-400 transition-colors" />
                 </div>
               </motion.div>
             );
          })}
        </div>
      )}

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowScanner(true)}
        className="fixed bottom-24 right-6 w-16 h-16 bg-black text-white rounded-full shadow-2xl flex items-center justify-center z-30"
      >
          <Plus size={32} />
      </motion.button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {activeModal && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm p-4"
                onClick={() => setActiveModal(null)}
            >
                <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white w-full max-w-md rounded-[40px] p-6 pb-10 shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-gray-900">
                            {activeModal === 'streak' ? '饮用频率' : '品牌偏好'}
                        </h3>
                        <button 
                            onClick={() => setActiveModal(null)}
                            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex-1 min-h-0">
                        {activeModal === 'streak' ? renderCalendarGrid() : renderBrandStats()}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

function DrinkDetailView({ log, onBack }: { log: DrinkLog; onBack: () => void }) {
    const specParts = log.specs.split(' / ');
    const [editSpec, setEditSpec] = useState(specParts[0] || '');
    const [editCupType, setEditCupType] = useState(specParts[1]?.replace('杯型:', '') || '');
    const [editSweetness, setEditSweetness] = useState(specParts[2]?.replace('甜度:', '') || '');
    const [editFlavor, setEditFlavor] = useState(specParts[3]?.replace('风味:', '') || '');
    const pricePart = specParts.find(s => s.startsWith('价格:'));
    const [editPrice, setEditPrice] = useState(pricePart ? pricePart.replace('价格:¥', '') : '');
    const [editDate, setEditDate] = useState(new Date(log.created_at).toISOString().split('T')[0]);
    const [isSaving, setIsSaving] = useState(false);
    
    // Amway State
    const [showAmwayModal, setShowAmwayModal] = useState(false);
    const [amwayText, setAmwayText] = useState('好喝');
    const [generatingPoster, setGeneratingPoster] = useState(false);
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const posterSeq = useRef(0);

    const buildSpecLines = (specsRaw: string) => {
        const parts = (specsRaw || '')
            .split(' / ')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((part) => {
                if (part.startsWith('价格:')) return null;
                if (part.startsWith('杯型:')) return part.replace('杯型:', '');
                return part.replace(/甜度:|风味:/g, '');
            })
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .map((v) => v.replace(/·/g, '・'));

        const line1 = parts.slice(0, 2).filter(Boolean).join('，');
        const line2 = parts.slice(2, 4).filter(Boolean).join('，');
        return [line1, line2].filter(Boolean);
    };

    const loadImageForCanvas = async (url: string) => {
        if (!url) return null;

        if (url.startsWith('data:')) {
            return await new Promise<HTMLImageElement | null>((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = url;
            });
        }

        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const img = await new Promise<HTMLImageElement | null>((resolve) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = () => resolve(null);
                i.src = objectUrl;
            });
            URL.revokeObjectURL(objectUrl);
            return img;
        } catch {
            return null;
        }
    };

    const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
        const words = text.split('');
        const lines: string[] = [];
        let current = '';
        for (const ch of words) {
            const next = current + ch;
            if (ctx.measureText(next).width > maxWidth && current) {
                lines.push(current);
                current = ch;
            } else {
                current = next;
            }
        }
        if (current) lines.push(current);
        return lines;
    };

    const generateBobaFlowPoster = async (quoteText: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 768;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');

        const W = canvas.width;
        const H = canvas.height;
        const cardRadius = 16;

        const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        };

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 2;
        const cardX = 18;
        const cardY = 18;
        const cardW = W - 36;
        const cardH = H - 36;
        roundRect(cardX, cardY, cardW, cardH, cardRadius);
        ctx.fill();
        ctx.stroke();

        const padding = 70;
        const innerX = cardX + padding;
        const innerY = cardY + padding;
        const innerW = cardW - padding * 2;

        const avatarSize = 140;
        const avatarX = innerX + 6;
        const avatarY = innerY + 6;

        const img = await loadImageForCanvas(log.image_url);

        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(17,24,39,0.10)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (img) {
            const scale = Math.max(avatarSize / img.width, avatarSize / img.height);
            const sw = avatarSize / scale;
            const sh = avatarSize / scale;
            const sx = Math.max(0, (img.width - sw) / 2);
            const sy = Math.max(0, (img.height - sh) / 2);
            ctx.drawImage(img, sx, sy, sw, sh, avatarX, avatarY, avatarSize, avatarSize);
        } else {
            ctx.fillStyle = '#F3F4F6';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
            ctx.fillStyle = '#111827';
            ctx.font = '800 48px system-ui, -apple-system, Segoe UI, Roboto';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initial = (log.brand || 'B').slice(0, 1);
            ctx.fillText(initial, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
        }
        ctx.restore();

        const textX = avatarX + avatarSize + 48;
        const textW = innerX + innerW - textX;
        const brand = log.brand || '';
        const name = log.name || '';
        const specLines = buildSpecLines(log.specs || '');

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#6B7280';
        ctx.font = '600 30px system-ui, -apple-system, Segoe UI, Roboto';
        ctx.fillText(brand, textX, avatarY + 8);

        ctx.fillStyle = '#111827';
        ctx.font = '900 56px system-ui, -apple-system, Segoe UI, Roboto';
        const nameLines = wrapText(ctx, name, textW).slice(0, 1);
        const nameY = avatarY + 52;
        if (nameLines[0]) ctx.fillText(nameLines[0], textX, nameY);

        ctx.fillStyle = '#6B7280';
        ctx.font = '500 36px system-ui, -apple-system, Segoe UI, Roboto';
        const specY1 = nameY + 78;
        const specY2 = specY1 + 56;
        if (specLines[0]) ctx.fillText(wrapText(ctx, specLines[0], textW).slice(0, 1).join(''), textX, specY1);
        if (specLines[1]) ctx.fillText(wrapText(ctx, specLines[1], textW).slice(0, 1).join(''), textX, specY2);

        const quote = `“${quoteText.trim()}”`;
        ctx.fillStyle = '#111827';
        ctx.font = '900 86px system-ui, -apple-system, Segoe UI, Roboto';
        const quoteMaxW = innerW;
        const quoteLines = wrapText(ctx, quote, quoteMaxW).slice(0, 2);
        const lineHeight = 108;
        const quoteX = innerX + 10;
        const quoteY = innerY + 360;
        for (let i = 0; i < quoteLines.length; i++) {
            ctx.fillText(quoteLines[i], quoteX, quoteY + i * lineHeight);
        }

        ctx.fillStyle = '#111827';
        ctx.font = '900 52px system-ui, -apple-system, Segoe UI, Roboto';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('BobaFlow', cardX + cardW - padding, cardY + cardH - padding);

        return canvas.toDataURL('image/png');
    };

    const downloadPoster = (dataUrl: string) => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `boba-${log.id}.png`;
        a.click();
    };

    const saveToRecommend = async () => {
        if (!posterUrl) return;
        const brand = String(log.brand || '').trim();
        const name = String(log.name || '').trim();
        const title = `${brand} ${name}`.trim() || '饮品';
        const note = String(amwayText || '').trim() || '分享自足迹';
        try {
            const uploaded = await api.uploadDataUrlImage({ dataUrl: posterUrl, key: `recommend-log-${log.id}`, userId: 'guest' });
            const img = typeof uploaded?.url === 'string' ? uploaded.url : '';
            if (!img) return;

            const existing = await api.getSidebarItems({ group: 'recommend', userId: 'guest' });
            const list = Array.isArray(existing) ? existing : [];
            const dup = list.some((it: any) => String(it?.image_url || '').trim() === img);
            if (dup) return;

            await api.createSidebarItem({ userId: 'guest', group: 'recommend', title, note, imageUrl: img });
            window.dispatchEvent(new CustomEvent('sipsnaps:sidebar:refresh', { detail: { group: 'recommend' } }));
        } catch {
        }
    };

    const handleSharePoster = async () => {
        if (!posterUrl) return;
        void saveToRecommend();
        const nav: any = navigator as any;
        if (nav?.share) {
            try {
                const blob = await (await fetch(posterUrl)).blob();
                const file = new File([blob], `boba-${log.id}.png`, { type: blob.type || 'image/png' });
                if (nav?.canShare?.({ files: [file] })) {
                    await nav.share({ files: [file], title: 'BobaFlow' });
                    return;
                }
            } catch {
            }
        }
        downloadPoster(posterUrl);
    };

    const openShareModal = () => {
        setAmwayText('好喝');
        setPosterUrl(null);
        setShowAmwayModal(true);
    };

    useEffect(() => {
        if (!showAmwayModal) return;
        const text = (amwayText || '').trim() || '好喝';
        const timer = setTimeout(async () => {
            const seq = ++posterSeq.current;
            setGeneratingPoster(true);
            try {
                const url = await generateBobaFlowPoster(text);
                if (seq === posterSeq.current) setPosterUrl(url);
            } catch {
                if (seq === posterSeq.current) setPosterUrl(null);
            } finally {
                if (seq === posterSeq.current) setGeneratingPoster(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [showAmwayModal, amwayText, log.id, log.image_url, log.brand, log.name, log.specs]);

    // Mock save - in real app would update DB
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // "如果某个规格未提及，那么对应的规格就不要展示"
            // Filter empty values
            const isValidSpec = (val: string) => {
                if (!val) return false;
                const lower = val.toLowerCase().trim();
                return !['unknown', '未提及', '未识别', '无', 'none', 'n/a'].includes(lower);
            };

            const specs = [
                isValidSpec(editSpec) ? editSpec : '', 
                isValidSpec(editCupType) ? `杯型:${editCupType}` : '', 
                isValidSpec(editSweetness) ? `甜度:${editSweetness}` : '', 
                isValidSpec(editFlavor) ? `风味:${editFlavor}` : '',
                editPrice ? `价格:¥${editPrice}` : ''
            ]
                .filter(Boolean)
                .join(' / ');
            
            await api.updateLog(log.id, {
                specs,
                created_at: editDate // Update date
            });
            
            setIsSaving(false);
            onBack();
        } catch (e) {
            console.error(e);
            alert("保存失败");
            setIsSaving(false);
        }
    };

    // Delete Log
    const handleDelete = async () => {
        // Removed confirm dialog as requested
        try {
            await api.deleteLog(log.id);
            onBack(); // This will trigger fetchLogs in parent
        } catch (e) {
            console.error(e);
            alert("删除失败");
        }
    };

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full flex flex-col">
             <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl border border-gray-100 overflow-hidden flex-1 flex flex-col">
                <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                    <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="text-xl font-bold text-gray-900">饮品详情</div>
                    <div className="flex gap-2">
                        <button 
                            onClick={openShareModal}
                            className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center"
                            title="分享"
                        >
                            <Share2 size={20} />
                        </button>
                        <button onClick={handleDelete} className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>

                <div className="px-6 pb-6 overflow-y-auto flex-1">
                    <div className="bg-gray-50 rounded-3xl p-4 flex items-center gap-4 mb-6">
                        <div className="w-20 h-20 rounded-full bg-white overflow-hidden border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <img src={log.image_url} className="w-full h-full object-cover" />
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="text-xs font-bold text-gray-400 tracking-widest">品牌</div>
                        <div className="text-4xl font-black text-gray-900 mt-2">{log.brand}</div>
                    </div>

                    <div className="mb-6">
                        <div className="text-xs font-bold text-gray-400 tracking-widest">品名</div>
                        <div className="text-2xl font-bold text-gray-800 mt-2">{log.name}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <EditableTile label="规格" value={editSpec} onChange={setEditSpec} />
                        <EditableTile label="杯型" value={editCupType} onChange={setEditCupType} />
                        <EditableTile label="甜度" value={editSweetness} onChange={setEditSweetness} />
                        <EditableTile label="风味" value={editFlavor} onChange={setEditFlavor} />
                    </div>

                    <div className="bg-gray-50 rounded-[24px] p-5 flex items-center justify-between group mt-4">
                            <div className="flex-1">
                                <div className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 uppercase">价格</div>
                                <div className="flex items-center gap-1">
                                    <span className="text-xl font-bold text-gray-900">¥</span>
                                    <input 
                                        type="number"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                        className="bg-transparent text-xl font-bold text-gray-900 outline-none w-full"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-[24px] p-5 flex items-center justify-between group mt-4">
                            <div className="flex-1">
                                <div className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 uppercase">饮用日期</div>
                                <input 
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="bg-transparent text-xl font-bold text-gray-900 outline-none w-full"
                                />
                            </div>
                            <CalendarIcon size={20} className="text-gray-400" />
                        </div>

                    <button
                        onClick={handleSave}
                        className="mt-8 w-full bg-black text-white py-4 rounded-full font-bold text-lg flex items-center justify-center gap-3 shadow-lg"
                        disabled={isSaving}
                    >
                        {isSaving ? <RefreshCw className="animate-spin" /> : <Check size={22} />}
                        保存修改
                    </button>
                </div>
            </div>

            {/* Amway Modal */}
            <AnimatePresence>
                {showAmwayModal && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }} 
                            animate={{ scale: 1, y: 0 }} 
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-end items-center">
                                <button onClick={() => setShowAmwayModal(false)} className="p-2 bg-gray-100 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="flex flex-col items-center">
                                    <div className="w-full max-w-[420px] aspect-[4/3] rounded-2xl overflow-hidden shadow-lg mb-4 relative bg-gray-50 flex items-center justify-center">
                                        {posterUrl ? (
                                            <img src={posterUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <RefreshCw className="animate-spin text-gray-300" />
                                        )}
                                    </div>

                                    <input
                                        value={amwayText}
                                        onChange={(e) => setAmwayText(e.target.value)}
                                        className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-lg font-bold outline-none mb-4"
                                        placeholder="好喝"
                                    />

                                    <button 
                                        onClick={handleSharePoster}
                                        disabled={generatingPoster || !posterUrl}
                                        className="w-full bg-black text-white py-3 rounded-full font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <Check size={18} />
                                        分享
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default App;
