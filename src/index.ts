import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  getCanonFile,
  listCanonFiles,
  searchCanon,
} from './canon.js';

import {
  canonFingerprint,
  semanticSearch,
} from './semantic.js';

import {
  getStoryState,
  updateStoryState,
} from './state.js';

const server = new Server(
  {
    name: 'aw-20-mcp',
    version: '0.3.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_canon',
        description: 'Weighted keyword search across canon files.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
      {
        name: 'semantic_search',
        description: 'Local semantic similarity search across canon.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_canon_files',
        description: 'List indexed canon files.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_canon_file',
        description: 'Retrieve a canon file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      },
      {
        name: 'get_story_state',
        description: 'Read continuity and active story state.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
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
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = request.params.name;

  if (tool === 'search_canon') {
    const query = String(request.params.arguments?.query ?? '');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(searchCanon(query), null, 2),
        },
      ],
    };
  }

  if (tool === 'semantic_search') {
    const query = String(request.params.arguments?.query ?? '');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(semanticSearch(query), null, 2),
        },
      ],
    };
  }

  if (tool === 'list_canon_files') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(listCanonFiles(), null, 2),
        },
      ],
    };
  }

  if (tool === 'get_canon_file') {
    const filePath = String(request.params.arguments?.path ?? '');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(getCanonFile(filePath) ?? null, null, 2),
        },
      ],
    };
  }

  if (tool === 'get_story_state') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(getStoryState(), null, 2),
        },
      ],
    };
  }

  if (tool === 'update_story_state') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(updateStoryState(request.params.arguments ?? {}), null, 2),
        },
      ],
    };
  }

  if (tool === 'canon_fingerprint') {
    return {
      content: [
        {
          type: 'text',
          text: canonFingerprint(),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${tool}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('AW_20 MCP server running');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
