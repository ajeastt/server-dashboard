import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const ROOT = '/host';

function safeResolve(userPath) {
  const requested = path.resolve(ROOT, '.' + userPath);
  if (!requested.startsWith(ROOT)) {
    throw new Error('Access denied: path traversal detected');
  }
  return requested;
}

function displayPath(absolutePath) {
  if (absolutePath === ROOT) return '/';
  return absolutePath.slice(ROOT.length) || '/';
}

export async function listDirectory(userPath) {
  const target = safeResolve(userPath);
  const entries = await fs.readdir(target, { withFileTypes: true });

  const items = [];
  for (const entry of entries) {
    const fullPath = path.join(target, entry.name);
    try {
      const stat = await fs.lstat(fullPath);
      items.push({
        name: entry.name,
        path: displayPath(fullPath),
        size: stat.size,
        mode: stat.mode.toString(8).slice(-4),
        mtime: stat.mtimeMs,
        type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
        isSymlink: entry.isSymbolicLink(),
      });
    } catch {}
  }

  items.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  const current = displayPath(target);
  const parent = current === '/' ? null : path.dirname(current) || '/';

  return { path: current, parent, items };
}

export async function readFileContent(userPath) {
  const target = safeResolve(userPath);

  const stat = await fs.stat(target);
  if (stat.isDirectory()) {
    throw new Error('Cannot read a directory as file');
  }

  const maxSize = 10 * 1024 * 1024;
  if (stat.size > maxSize) {
    throw new Error('File too large to preview (max 10 MB)');
  }

  let content;
  const ext = path.extname(target).toLowerCase();
  const textExts = ['.txt', '.md', '.json', '.yml', '.yaml', '.xml', '.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.sh', '.bash', '.zsh', '.env', '.conf', '.cfg', '.ini', '.toml', '.cfg', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.sql', '.log', '.env', '.gitignore', '.dockerignore', '.dockerfile', '.nginx', '.cnf', '.properties', '.svelte', '.vue', '.lock', '.yml', '.yaml', '.mod', '.sum', '.service', '.timer', '.socket'];

  const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar', '.o', '.so', '.dll', '.exe', '.wasm', '.mp3', '.mp4', '.avi', '.mov', '.bin', '.db', '.sqlite', '.parquet'];

  if (binaryExts.includes(ext)) {
    return { content: null, binary: true, encoding: null };
  }

  try {
    content = await fs.readFile(target, 'utf-8');
    return { content, binary: false, encoding: 'utf-8' };
  } catch {
    return { content: null, binary: true, encoding: null };
  }
}
