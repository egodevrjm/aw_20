import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  getCanonFile,
  listCanonFiles,
  searchCanon,
} from '../src/canon.js';
import { semanticSearch } from '../src/semantic.js';
import { canonFingerprint } from '../src/semantic.js';
import { getStoryState, updateStoryState } from '../src/state.js';

function createServer() {
  const server = new Server(
    {
      name: 'aw-20-mcp',
      version: '0.6.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_canon',
        description: 'Weighted keyword search across AW_20 canon files.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
      {
        name: 'semantic_search',
        description: 'Local semantic similarity search across AW_20 canon.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
      {
        name: 'list_canon_files',
        description: 'List indexed AW_20 canon files.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_canon_file',
        description: 'Retrieve a canon file by path.',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
      {
        name: 'get_story_state',
        description: 'Read continuity and active story state.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'update_story_state',
        description: 'Update continuity state.',
        inputSchema: {
          type: 'object',
          properties: {
            currentArc: { type: 'string' },
            activeTimeline: { type: 'string' },
          },
        },
      },
      {
        name: 'canon_fingerprint',
        description: 'Generate a deterministic hash of canon state.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = request.params.name;
    const args = request.params.arguments ?? {};

    let result: unknown;

    if (tool === 'search_canon') result = searchCanon(String(args.query ?? ''));
    else if (tool === 'semantic_search') result = semanticSearch(String(args.query ?? ''));
    else if (tool === 'list_canon_files') result = listCanonFiles();
    else if (tool === 'get_canon_file') result = getCanonFile(String(args.path ?? '')) ?? null;
    else if (tool === 'get_story_state') result = getStoryState();
    else if (tool === 'update_story_state') result = updateStoryState(args);
    else if (tool === 'canon_fingerprint') result = canonFingerprint();
    else throw new Error(`Unknown tool: ${tool}`);

    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  return server;
}

export default async function handler(req: any, res: any) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
