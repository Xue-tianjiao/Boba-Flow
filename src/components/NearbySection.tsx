import { useEffect, useMemo, useState } from 'react';
import { MapPin, LocateFixed, RefreshCw, ExternalLink, Copy, Search } from 'lucide-react';
import { api } from '../services/api';

type NearbyPermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';

type NearbyPlace = {
  id: string;
  name: string;
  category: 'coffee' | 'tea' | 'drink' | 'other';
  address: string;
  district?: string;
  distanceMeters?: number;
  location?: { lat: number; lng: number };
  mapUrl?: string;
};

function formatDistance(meters?: number): string {
  if (!Number.isFinite(meters)) return '';
  const m = Math.max(0, Math.round(meters as number));
  if (m < 1000) return `${m}m`;
  const km = m / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)}km`;
}

function categoryLabel(category: NearbyPlace['category']): string {
  if (category === 'coffee') return '咖啡';
  if (category === 'tea') return '茶饮';
  if (category === 'drink') return '饮品';
  return '店铺';
}

export default function NearbySection() {
  const [permission, setPermission] = useState<NearbyPermissionState>('unknown');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mode, setMode] = useState<'precise' | 'city' | null>(null);
  const [cityDisplayName, setCityDisplayName] = useState<string>('');
  const [cityInput, setCityInput] = useState('');
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const canGeolocate = useMemo(() => typeof navigator !== 'undefined' && Boolean((navigator as any).geolocation), []);

  useEffect(() => {
    if (!canGeolocate) {
      setPermission('unavailable');
      return;
    }
    const nav: any = navigator as any;
    if (!nav.permissions?.query) return;
    nav.permissions
      .query({ name: 'geolocation' })
      .then((status: any) => {
        const v = String(status?.state || 'prompt');
        if (v === 'granted') setPermission('granted');
        else if (v === 'denied') setPermission('denied');
        else setPermission('unknown');
      })
      .catch(() => {
      });
  }, [canGeolocate]);

  useEffect(() => {
    if (permission !== 'granted') return;
    if (coords) return;
    requestLocation(false);
  }, [permission]);

  const fetchNearby = async (params: { lat?: number; lng?: number; city?: string }) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getNearbyPlaces({
        lat: params.lat,
        lng: params.lng,
        city: params.city,
        radius: 2200,
      });
      const p = Array.isArray(data?.places) ? data.places : [];
      setPlaces(p);
      setMode(data?.mode === 'city' ? 'city' : 'precise');
      setCityDisplayName(typeof data?.cityDisplayName === 'string' ? data.cityDisplayName : '');
    } catch (e: any) {
      setPlaces([]);
      setError(e?.message ? String(e.message) : '附近加载失败');
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = (forcePrompt: boolean) => {
    if (!canGeolocate) {
      setPermission('unavailable');
      return;
    }
    setLoading(true);
    setError('');
    (navigator as any).geolocation.getCurrentPosition(
      (pos: GeolocationPosition) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setPermission('granted');
        void fetchNearby({ lat, lng });
      },
      (err: GeolocationPositionError) => {
        if (err.code === 1) setPermission('denied');
        else setPermission(forcePrompt ? 'unavailable' : permission);
        setLoading(false);
        setError(err.message || '定位失败');
      },
      { enableHighAccuracy: true, timeout: 6500, maximumAge: 60_000 }
    );
  };

  const onSearchCity = async () => {
    const city = cityInput.trim();
    if (!city) return;
    setCoords(null);
    await fetchNearby({ city });
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-black text-gray-900">附近</div>
          {mode === 'city' && cityDisplayName ? (
            <div className="text-[11px] font-semibold text-gray-500 truncate max-w-[180px]">{cityDisplayName}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (coords) void fetchNearby({ lat: coords.lat, lng: coords.lng });
              else if (mode === 'city' && cityInput.trim()) void fetchNearby({ city: cityInput.trim() });
            }}
            className="h-8 px-3 rounded-full text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-1"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </div>

      {permission === 'unavailable' ? (
        <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-[4px_6px_14px_rgba(17,24,39,0.08)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700">
              <MapPin size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-gray-900">无法使用定位</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">你的浏览器不支持定位或定位不可用，可使用城市搜索。</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder="输入城市/区域，例如：静安区"
                    className="w-full h-9 bg-gray-100 rounded-full pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <button
                  type="button"
                  onClick={onSearchCity}
                  className="h-9 px-4 rounded-full bg-black text-white text-xs font-black"
                  disabled={loading || !cityInput.trim()}
                >
                  搜索
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : permission === 'denied' ? (
        <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-[4px_6px_14px_rgba(17,24,39,0.08)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700">
              <MapPin size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-gray-900">定位已被拒绝</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">你可以在浏览器设置中开启定位，或用城市搜索查看附近店铺。</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder="输入城市/区域，例如：浦东新区"
                    className="w-full h-9 bg-gray-100 rounded-full pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <button
                  type="button"
                  onClick={onSearchCity}
                  className="h-9 px-4 rounded-full bg-black text-white text-xs font-black"
                  disabled={loading || !cityInput.trim()}
                >
                  搜索
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[4px_6px_14px_rgba(17,24,39,0.08)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700">
                <LocateFixed size={18} />
              </div>
              <div>
                <div className="text-sm font-black text-gray-900">周边咖啡 / 饮品店</div>
                <div className="text-xs font-semibold text-gray-500">{coords ? '按距离排序' : '开启定位或使用城市搜索'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => requestLocation(true)}
                className="h-9 px-4 rounded-full bg-black text-white text-xs font-black"
                disabled={loading}
              >
                {coords ? '重新定位' : '开启定位'}
              </button>
            </div>
          </div>

          {!coords ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="或输入城市/区域，例如：徐汇区"
                  className="w-full h-9 bg-gray-100 rounded-full pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <button
                type="button"
                onClick={onSearchCity}
                className="h-9 px-4 rounded-full border border-gray-200 text-gray-800 text-xs font-black hover:bg-gray-50"
                disabled={loading || !cityInput.trim()}
              >
                搜索
              </button>
            </div>
          ) : null}

          {error ? <div className="mt-3 text-xs font-semibold text-rose-600">{error}</div> : null}

          <div className="mt-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : places.length ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {places.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-black text-gray-900 truncate">{p.name}</div>
                          <div className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 flex-shrink-0">{categoryLabel(p.category)}</div>
                          {p.distanceMeters != null ? (
                            <div className="text-[10px] font-bold text-gray-500 flex-shrink-0">{formatDistance(p.distanceMeters)}</div>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-gray-500 truncate max-w-[240px]">{p.address || p.district || ''}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const text = [p.name, p.address].filter(Boolean).join(' ');
                            void (navigator as any)?.clipboard?.writeText?.(text);
                          }}
                          className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50"
                          title="复制"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const url = p.mapUrl;
                            if (url) window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                          className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-900"
                          title="打开地图"
                        >
                          <ExternalLink size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500">暂无结果，试试调整城市或稍后重试。</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
