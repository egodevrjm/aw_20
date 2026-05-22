import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  canonCheck,
  getCanonFile,
  listCanonFiles,
  searchCanon,
} from '../src/canon.js';
import { semanticSearch } from '../src/semantic.js';
import { canonFingerprint } from '../src/semantic.js';
import { buildSceneBrief } from '../src/intelligence.js';
import { getStoryState, updateStoryState } from '../src/state.js';

function createServer() {
  const server = new Server(
    {
      name: 'aw-20-mcp',
      version: '0.9.0',
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
        name: 'scene_builder',
        description: 'Build a canon-grounded scene brief: likely characters, location/room context, building notes, relevant canon, and continuity warnings before writing a scene.',
        inputSchema: {
          type: 'object',
          properties: {
            premise: {
              type: 'string',
              description: 'The scene premise or user request.',
            },
            location: {
              type: 'string',
              description: 'Optional location or room to ground the scene in.',
            },
            characters: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional characters the user expects in the scene.',
            },
            purpose: {
              type: 'string',
              description: 'Optional dramatic or narrative purpose of the scene.',
            },
            tone: {
              type: 'string',
              description: 'Optional tone, e.g. comic, romantic, tense, press cut, grounded realism.',
            },
          },
          required: ['premise'],
        },
      },
      {
        name: 'canon_check',
        description: 'Check whether a name, concept, place, object, event, or claim is supported by AW_20 canon before using it in writing.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The canon claim, name, concept, object, event, or place to validate.',
            },
          },
          required: ['query'],
        },
      },
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
        description: 'Read continuity and active story state. Reports whether persistence is durable or serverless-ephemeral.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'update_story_state',
        description: 'Update continuity state. Uses durable GitHub-backed persistence when GITHUB_TOKEN or AW20_GITHUB_TOKEN is configured.',
        inputSchema: {
          type: 'object',
          properties: {
            currentArc: { type: 'string' },
            activeTimeline: { type: 'string' },
            continuityNotes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      {
        name: 'canon_fingerprint',
        description: 'Generate diagnostic canon fingerprint metadata: hash, document count, word count, indexed paths, and timestamp.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = request.params.name;
    const args = request.params.arguments ?? {};

    let result: unknown;

    if (tool === 'scene_builder') {
      result = buildSceneBrief({
        premise: String(args.premise ?? ''),
        location: args.location ? String(args.location) : undefined,
        characters: Array.isArray(args.characters) ? args.characters.map(String) : undefined,
        purpose: args.purpose ? String(args.purpose) : undefined,
        tone: args.tone ? String(args.tone) : undefined,
      });
    }
    else if (tool === 'canon_check') result = canonCheck(String(args.query ?? ''));
    else if (tool === 'search_canon') result = searchCanon(String(args.query ?? ''));
    else if (tool === 'semantic_search') result = semanticSearch(String(args.query ?? ''));
    else if (tool === 'list_canon_files') result = listCanonFiles();
    else if (tool === 'get_canon_file') result = getCanonFile(String(args.path ?? '')) ?? null;
    else if (tool === 'get_story_state') result = await getStoryState();
    else if (tool === 'update_story_state') result = await updateStoryState(args);
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
