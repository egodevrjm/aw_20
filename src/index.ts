import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';

const server = new Server(
  {
    name: 'aw-20-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const CONTENT_DIR = path.resolve('./canon');

function searchCanon(query: string): string[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    return ['No canon directory found yet.'];
  }

  const files = fs.readdirSync(CONTENT_DIR);
  const matches: string[] = [];

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);

    if (!fs.statSync(fullPath).isFile()) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');

    if (content.toLowerCase().includes(query.toLowerCase())) {
      matches.push(file);
    }
  }

  return matches;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_canon',
        description: 'Search the AW_20 canon files.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for lore/canon.',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'search_canon') {
    const query = String(request.params.arguments?.query ?? '');

    const matches = searchCanon(query);

    return {
      content: [
        {
          type: 'text',
          text: matches.length
            ? `Matches:\n${matches.join('\n')}`
            : 'No matches found.',
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
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
