import fs from 'node:fs';
import path from 'node:path';
import canonIndex from '../canon-index.json' with { type: 'json' };

export type CanonDocument = {
  path: string;
  title: string;
  content: string;
  headings: string[];
  category: string;
  wordCount: number;
};

export type SearchResult = {
  path: string;
  title: string;
  score: number;
  excerpt: string;
};

export type CanonCheckResult = {
  query: string;
  verdict: 'canonical' | 'partial' | 'ambiguous' | 'not_found';
  confidence: number;
  guidance: string;
  matches: SearchResult[];
};

export type CanonSummary = {
  totalDocuments: number;
  totalWords: number;
  categories: Record<string, number>;
  documents: Pick<CanonDocument, 'path' | 'title' | 'category' | 'wordCount'>[];
};

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv']);
const CANON_SOURCE_ROOT = path.resolve(process.env.AW20_CANON_ROOT ?? process.cwd());
const SAMPLE_CANON_DIR = path.resolve(process.env.AW20_CANON_DIR ?? './canon');
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.vercel',
  '.netlify',
  'node_modules',
  'dist',
  'public',
  'api',
  'src',
  'netlify',
  'supabase',
  'docs',
]);

function walkDirectory(directory: string, ignoredDirectories = IGNORED_DIRECTORIES): string[] {
  if (!fs.existsSync(directory)) return [];

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      files.push(...walkDirectory(fullPath, ignoredDirectories));
    } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function extractTitle(content: string, fallback: string): string {
  const markdownTitle = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return markdownTitle || fallback.replace(/\.md$/i, '').replace(/_/g, ' ');
}

function extractHeadings(content: string): string[] {
  return [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1].trim());
}

function inferCategory(relativePath: string): string {
  if (relativePath.includes('/')) return relativePath.split('/')[0];

  const filename = path.basename(relativePath);

  if (/^\d+_/.test(filename)) return 'flat-canon';
  if (/project/i.test(filename)) return 'instructions';
  if (/readme/i.test(filename)) return 'meta';

  return 'root';
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function toCanonDocument(fullPath: string, root: string): CanonDocument {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const relativePath = path.relative(root, fullPath).split(path.sep).join('/');

  return {
    path: relativePath,
    title: extractTitle(content, path.basename(relativePath)),
    content,
    headings: extractHeadings(content),
    category: inferCategory(relativePath),
    wordCount: countWords(content),
  };
}

function normaliseIndexedDocument(document: any): CanonDocument {
  return {
    path: document.path,
    title: document.title,
    content: document.content,
    headings: document.headings ?? extractHeadings(document.content),
    category: document.category ?? inferCategory(document.path),
    wordCount: document.wordCount ?? countWords(document.content),
  };
}

function loadRootFlatCanon(): CanonDocument[] {
  const files = walkDirectory(CANON_SOURCE_ROOT)
    .filter((file) => path.extname(file).toLowerCase() === '.md')
    .filter((file) => !path.relative(CANON_SOURCE_ROOT, file).startsWith(`canon${path.sep}`));

  return files.map((file) => toCanonDocument(file, CANON_SOURCE_ROOT));
}

function loadSampleCanon(): CanonDocument[] {
  const files = walkDirectory(SAMPLE_CANON_DIR, new Set());
  return files.map((file) => toCanonDocument(file, SAMPLE_CANON_DIR));
}

export function loadCanon(): CanonDocument[] {
  const rootDocuments = loadRootFlatCanon();

  if (rootDocuments.length > 5) return rootDocuments;

  const sampleDocuments = loadSampleCanon();
  if (sampleDocuments.length > 0) return sampleDocuments;

  return (canonIndex as any[]).map(normaliseIndexedDocument);
}

function makeExcerpt(content: string, query: string, length = 700): string {
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
  const headings = document.headings.join(' ').toLowerCase();
  const content = document.content.toLowerCase();

  let score = 0;

  for (const term of terms) {
    const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (title.includes(term)) score += 12;
    if (pathName.includes(term)) score += 8;
    if (headings.includes(term)) score += 5;
    score += (content.match(new RegExp(safeTerm, 'g')) ?? []).length;
  }

  if (content.includes(query.toLowerCase())) score += 10;

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

export function canonCheck(query: string, limit = 5): CanonCheckResult {
  const trimmedQuery = query.trim();
  const canon = loadCanon();
  const matches = searchCanon(trimmedQuery, limit);
  const exactTitle = canon.some((document) => document.title.toLowerCase() === trimmedQuery.toLowerCase());
  const exactPath = canon.some((document) => document.path.toLowerCase().includes(trimmedQuery.toLowerCase()));

  if (exactTitle || exactPath || matches[0]?.score >= 18) {
    return {
      query: trimmedQuery,
      verdict: 'canonical',
      confidence: exactTitle || exactPath ? 0.95 : 0.82,
      guidance: 'Treat this as canon. Use the supporting matches as grounding before writing.',
      matches,
    };
  }

  if (matches.length > 1 && matches[0].score === matches[1].score) {
    return {
      query: trimmedQuery,
      verdict: 'ambiguous',
      confidence: 0.55,
      guidance: 'The concept appears in canon, but the match is ambiguous. Ask for or retrieve more context before making a specific claim.',
      matches,
    };
  }

  if (matches.length > 0) {
    return {
      query: trimmedQuery,
      verdict: 'partial',
      confidence: 0.65,
      guidance: 'There is partial support in canon. Avoid adding specific new facts unless the match clearly supports them.',
      matches,
    };
  }

  return {
    query: trimmedQuery,
    verdict: 'not_found',
    confidence: 0.2,
    guidance: 'Not found in available canon. Treat as non-canon unless the user explicitly introduces it.',
    matches: [],
  };
}

export function searchByCategory(category: string, query = '', limit = 20): SearchResult[] {
  const documents = loadCanon().filter((document) => document.category === category);

  if (!query.trim()) {
    return documents.slice(0, limit).map((document) => ({
      path: document.path,
      title: document.title,
      score: 1,
      excerpt: document.content.slice(0, 700).trim(),
    }));
  }

  return documents
    .map((document) => ({
      path: document.path,
      title: document.title,
      score: scoreDocument(document, query),
      excerpt: makeExcerpt(document.content, query),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

export function getCanonFile(filePath: string): CanonDocument | undefined {
  const safePath = path.normalize(filePath).replace(/^\.\.(\/|\\|$)/, '');
  return loadCanon().find((document) => document.path === safePath || document.path.endsWith(`/${safePath}`));
}

export function listCanonFiles(): Pick<CanonDocument, 'path' | 'title' | 'headings' | 'category' | 'wordCount'>[] {
  return loadCanon().map(({ path, title, headings, category, wordCount }) => ({ path, title, headings, category, wordCount }));
}

export function listCategories(): Record<string, Pick<CanonDocument, 'path' | 'title' | 'wordCount'>[]> {
  const categories: Record<string, Pick<CanonDocument, 'path' | 'title' | 'wordCount'>[]> = {};

  for (const document of loadCanon()) {
    categories[document.category] ??= [];
    categories[document.category].push({
      path: document.path,
      title: document.title,
      wordCount: document.wordCount,
    });
  }

  return categories;
}

export function canonSummary(): CanonSummary {
  const documents = loadCanon();
  const categories: Record<string, number> = {};

  for (const document of documents) {
    categories[document.category] = (categories[document.category] ?? 0) + 1;
  }

  return {
    totalDocuments: documents.length,
    totalWords: documents.reduce((total, document) => total + document.wordCount, 0),
    categories,
    documents: documents.map(({ path, title, category, wordCount }) => ({ path, title, category, wordCount })),
  };
}

export function findRelated(pathOrTitle: string, limit = 8): SearchResult[] {
  const documents = loadCanon();
  const source = documents.find(
    (document) =>
      document.path === pathOrTitle ||
      document.path.endsWith(`/${pathOrTitle}`) ||
      document.title.toLowerCase() === pathOrTitle.toLowerCase()
  );

  if (!source) return [];

  const seed = [source.title, ...source.headings].join(' ');

  return documents
    .filter((document) => document.path !== source.path)
    .map((document) => ({
      path: document.path,
      title: document.title,
      score: scoreDocument(document, seed),
      excerpt: document.content.slice(0, 700).trim(),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

export function getCharacter(name: string): CanonDocument | undefined {
  const normalised = name.toLowerCase();
  return loadCanon().find(
    (document) =>
      document.category === 'characters' &&
      (document.title.toLowerCase().includes(normalised) || document.path.toLowerCase().includes(normalised))
  );
}

export function getLocation(name: string): CanonDocument | undefined {
  const normalised = name.toLowerCase();
  return loadCanon().find(
    (document) =>
      document.category === 'locations' &&
      (document.title.toLowerCase().includes(normalised) || document.path.toLowerCase().includes(normalised))
  );
}
