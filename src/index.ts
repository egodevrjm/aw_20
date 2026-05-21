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

const server = new Server(
  {
    name: 'aw-20-mcp',
    version: '0.2.0',
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
        description: 'Semantic-style keyword search across AW_20 canon files.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_canon_files',
        description: 'List indexed canon files and headings.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_canon_file',
        description: 'Retrieve a canon file by path.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
            },
          },
          required: ['path'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = request.params.name;

  if (tool === 'search_canon') {
    const query = String(request.params.arguments?.query ?? '');
    const results = searchCanon(query);

    return {
      content: [
        {
          type: 'text',
          text: results.length
            ? JSON.stringify(results, null, 2)
            : 'No canon matches found.',
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
    const document = getCanonFile(filePath);

    return {
      content: [
        {
          type: 'text',
          text: document
            ? JSON.stringify(document, null, 2)
            : 'Canon file not found.',
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
