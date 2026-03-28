import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

const candidates = [
  {
    dir: path.join(projectRoot, 'public', 'ads', 'picture'),
    manifestPath: path.join(projectRoot, 'public', 'ads', 'picture', 'manifest.json'),
    baseUrl: '/ads/picture/'
  },
  {
    dir: path.join(projectRoot, 'public', 'picture'),
    manifestPath: path.join(projectRoot, 'public', 'picture', 'manifest.json'),
    baseUrl: '/picture/'
  },
  {
    dir: path.join(projectRoot, 'public', 'explore', 'picture'),
    manifestPath: path.join(projectRoot, 'public', 'explore', 'picture', 'manifest.json'),
    baseUrl: '/explore/picture/'
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));
}

for (const c of candidates) {
  ensureDir(c.dir);
  const files = listImages(c.dir);
  const urls = files.map((f) => `${c.baseUrl}${encodeURIComponent(f)}`);
  fs.writeFileSync(c.manifestPath, JSON.stringify({ urls }, null, 2), 'utf-8');
}

