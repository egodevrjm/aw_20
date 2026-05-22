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
import { queryCalendar } from '../src/calendar.js';
import { wallCheck } from '../src/wall.js';
import { characterLookup } from '../src/characters.js';
import { appendLedger } from '../src/ledger.js';
import { getStoryState, updateStoryState } from '../src/state.js';

function createServer() {
  const server = new Server(
    {
      name: 'aw-20-mcp',
      version: '1.0.0',
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
        name: 'events_calendar_query',
        description: 'Query the structured AW_20 events diary/calendar by date range and filters such as city, diary_layer, alex_default_status, and privacy_risk.',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Inclusive start date, YYYY-MM-DD.' },
            end_date: { type: 'string', description: 'Inclusive end date, YYYY-MM-DD.' },
            city: { type: 'string' },
            country: { type: 'string' },
            event_kind: { type: 'string' },
            category: { type: 'string' },
            alex_default_status: { type: 'string' },
            diary_layer: { type: 'string' },
            privacy_risk: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'wall_check',
        description: 'Check a character or role against The Wall knowledge gate and return their access level before writing dialogue, thoughts, texts, posts, or reactions.',
        inputSchema: {
          type: 'object',
          properties: {
            character: {
              type: 'string',
              description: 'Character name or role to check, e.g. Rosie, Knight Frank, press, London Lot, Serena Management.',
            },
          },
          required: ['character'],
        },
      },
      {
        name: 'get_character',
        description: 'Aggregated character lookup: canon status, likely canon files, relationship evidence, voice evidence, knowledge evidence, and Wall access guidance.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Character name to look up.',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'append_ledger',
        description: 'Append a structured, durable ledger entry separate from story state: session, date, category, fact, and optional source.',
        inputSchema: {
          type: 'object',
          properties: {
            session: { type: 'string' },
            date: { type: 'string', description: 'Event or session date, preferably YYYY-MM-DD.' },
            category: { type: 'string' },
            fact: { type: 'string' },
            source: { type: 'string' },
          },
          required: ['category', 'fact'],
        },
      },
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

    if (tool === 'events_calendar_query') {
      result = queryCalendar({
        start_date: args.start_date ? String(args.start_date) : undefined,
        end_date: args.end_date ? String(args.end_date) : undefined,
        city: args.city ? String(args.city) : undefined,
        country: args.country ? String(args.country) : undefined,
        event_kind: args.event_kind ? String(args.event_kind) : undefined,
        category: args.category ? String(args.category) : undefined,
        alex_default_status: args.alex_default_status ? String(args.alex_default_status) : undefined,
        diary_layer: args.diary_layer ? String(args.diary_layer) : undefined,
        privacy_risk: args.privacy_risk ? String(args.privacy_risk) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      });
    }
    else if (tool === 'wall_check') result = wallCheck(String(args.character ?? ''));
    else if (tool === 'get_character') result = characterLookup(String(args.name ?? ''));
    else if (tool === 'append_ledger') {
      result = await appendLedger({
        session: args.session ? String(args.session) : undefined,
        date: args.date ? String(args.date) : undefined,
        category: String(args.category ?? ''),
        fact: String(args.fact ?? ''),
        source: args.source ? String(args.source) : undefined,
      });
    }
    else if (tool === 'scene_builder') {
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
