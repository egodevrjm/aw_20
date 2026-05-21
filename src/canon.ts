import fs from 'node:fs';
import path from 'node:path';

export type CanonDocument = {
  path: string;
  title: string;
  content: string;
  headings: string[];
};

export type SearchResult = {
  path: string;
  title: string;
  score: number;
  excerpt: string;
};

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv']);

export const CANON_DIR = path.resolve(process.env.AW20_CANON_DIR ?? './canon');

function walkDirectory(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkDirectory(fullPath));
    } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function extractTitle(content: string, fallback: string): string {
  const markdownTitle = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return markdownTitle || fallback;
}

function extractHeadings(content: string): string[] {
  return [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1].trim());
}

function normaliseRelativePath(fullPath: string): string {
  return path.relative(CANON_DIR, fullPath).split(path.sep).join('/');
}

export function loadCanon(): CanonDocument[] {
  return walkDirectory(CANON_DIR).map((fullPath) => {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const relativePath = normaliseRelativePath(fullPath);

    return {
      path: relativePath,
      title: extractTitle(content, path.basename(relativePath)),
      content,
      headings: extractHeadings(content),
    };
  });
}

function makeExcerpt(content: string, query: string, length = 320): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) return content.slice(0, length).trim();

  const start = Math.max(0, index - Math.floor(length / 2));
  const end = Math.min(content.length, start + length);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';

  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

function scoreDocument(document: CanonDocument, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const title = document.title.toLowerCase();
  const pathName = document.path.toLowerCase();
  const content = document.content.toLowerCase();

  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) score += 10;
    if (pathName.includes(term)) score += 6;
    score += (content.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
  }

  if (content.includes(query.toLowerCase())) score += 8;

  return score;
}

export function searchCanon(query: string, limit = 10): SearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  return loadCanon()
    .map((document) => ({
      path: document.path,
      title: document.title,
      score: scoreDocument(document, trimmedQuery),
      excerpt: makeExcerpt(document.content, trimmedQuery),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

export function getCanonFile(filePath: string): CanonDocument | undefined {
  const safePath = path.normalize(filePath).replace(/^\.\.(\/|\\|$)/, '');
  return loadCanon().find((document) => document.path === safePath || document.path.endsWith(`/${safePath}`));
}

export function listCanonFiles(): Pick<CanonDocument, 'path' | 'title' | 'headings'>[] {
  return loadCanon().map(({ path, title, headings }) => ({ path, title, headings }));
}
