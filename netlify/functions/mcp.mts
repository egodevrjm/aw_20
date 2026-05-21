import type { Config } from '@netlify/functions';
import fs from 'node:fs';
import path from 'node:path';

type CanonDocument = {
  path: string;
  title: string;
  content: string;
  headings: string[];
};

const CANON_DIR = path.resolve(process.cwd(), 'canon');
const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv']);

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
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback;
}

function extractHeadings(content: string): string[] {
  return [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1].trim());
}

function loadCanon(): CanonDocument[] {
  return walkDirectory(CANON_DIR).map((fullPath) => {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const relativePath = path.relative(CANON_DIR, fullPath).split(path.sep).join('/');

    return {
      path: relativePath,
      title: extractTitle(content, path.basename(relativePath)),
      content,
      headings: extractHeadings(content),
    };
  });
}

function searchCanon(query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return loadCanon()
    .map((document) => {
      const haystack = `${document.title}\n${document.path}\n${document.headings.join('\n')}\n${document.content}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);

      return {
        path: document.path,
        title: document.title,
        score,
        excerpt: document.content.replace(/\s+/g, ' ').slice(0, 420),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

function getCanonFile(filePath: string) {
  return loadCanon().find((document) => document.path === filePath || document.path.endsWith(`/${filePath}`)) ?? null;
}

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const tool = url.searchParams.get('tool');
    const query = url.searchParams.get('query') ?? '';
    const filePath = url.searchParams.get('path') ?? '';

    let payload: unknown = {
      ok: true,
      endpoint: 'aw20-mcp',
      tools: ['search_canon', 'semantic_search', 'list_canon_files', 'get_canon_file'],
    };

    if (tool === 'search_canon' || tool === 'semantic_search') payload = searchCanon(query);
    if (tool === 'list_canon_files') payload = loadCanon().map(({ path, title, headings }) => ({ path, title, headings }));
    if (tool === 'get_canon_file') payload = getCanonFile(filePath);

    return Response.json(payload);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};

export const config: Config = {
  path: '/mcp',
};
