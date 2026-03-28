import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export default function AvatarSheet(props: {
  open: boolean;
  saving: boolean;
  initialUrl: string;
  onClose: () => void;
  onSave: (nextUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [errorText, setErrorText] = useState('');

  const canSave = useMemo(() => {
    return Boolean(previewUrl && previewUrl.trim());
  }, [previewUrl]);

  useEffect(() => {
    if (!props.open) return;
    setPreviewUrl(props.initialUrl || '');
    setErrorText('');
  }, [props.open, props.initialUrl]);

  const buildCircleAvatarDataUrl = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('image load failed'));
      im.src = dataUrl;
    });

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas not supported');

    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    const side = Math.min(sw, sh);
    const sx = Math.max(0, Math.floor((sw - side) / 2));
    const sy = Math.max(0, Math.floor((sh - side) / 2));

    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/png');
  };

  const onPickFile = async (file: File | null) => {
    setErrorText('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorText('请选择图片文件');
      return;
    }
    try {
      const next = await buildCircleAvatarDataUrl(file);
      setPreviewUrl(next);
    } catch {
      setErrorText('处理图片失败，请换一张');
    }
  };

  return (
    <AnimatePresence>
      {props.open && (
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
              <div className="text-sm font-black text-gray-900">设置头像</div>
              <button type="button" onClick={props.onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={18} className="text-gray-700" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center text-gray-700 font-black">
                {previewUrl ? <img src={previewUrl} alt="avatar preview" className="w-full h-full object-cover" /> : <span>?</span>}
              </div>
              <div className="flex-1">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="h-12 px-4 rounded-2xl bg-gray-100 text-gray-900 font-bold w-full"
                >
                  从相册选择
                </button>
                {errorText ? <div className="mt-2 text-xs font-semibold text-red-600">{errorText}</div> : null}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={props.onClose} className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-bold">
                取消
              </button>
              <button
                type="button"
                onClick={() => props.onSave(previewUrl)}
                disabled={props.saving || !canSave}
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
