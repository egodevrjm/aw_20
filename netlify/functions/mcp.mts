import type { Context, Config } from '@netlify/functions';

import {
  searchCanon,
  listCanonFiles,
  getCanonFile,
} from '../../../src/canon.js';

import { semanticSearch } from '../../../src/semantic.js';

export default async (req: Request, context: Context) => {
  try {
    const url = new URL(req.url);
    const tool = url.searchParams.get('tool');
    const query = url.searchParams.get('query') ?? '';
    const path = url.searchParams.get('path') ?? '';

    let payload: unknown = {
      ok: true,
      endpoint: 'aw20-mcp',
    };

    if (tool === 'search_canon') {
      payload = searchCanon(query);
    }

    if (tool === 'semantic_search') {
      payload = semanticSearch(query);
    }

    if (tool === 'list_canon_files') {
      payload = listCanonFiles();
    }

    if (tool === 'get_canon_file') {
      payload = getCanonFile(path);
    }

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'content-type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
};

export const config: Config = {
  path: '/mcp',
};
