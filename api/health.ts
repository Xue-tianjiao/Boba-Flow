import { hasValidArkKey, json } from '../lib/ark';

export default function handler(req: any, res: any) {
  return json(res, {
    ok: true,
    method: String(req?.method || ''),
    hasArkKey: hasValidArkKey,
    hasArkBaseUrl: Boolean(process.env.ARK_BASE_URL),
    hasModelText: Boolean(process.env.ARK_MODEL_TEXT),
    hasModelVision: Boolean(process.env.ARK_MODEL_VISION),
    hasModelImage: Boolean(process.env.ARK_MODEL_IMAGE)
  });
}

