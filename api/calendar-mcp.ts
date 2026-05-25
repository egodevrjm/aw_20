import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  calendarMetadata,
  calendarWindowBrief,
  getEvent,
  privacyRiskScan,
  queryCalendar,
} from '../src/calendar.js';

function createServer() {
  const server = new Server(
    {
      name: 'aw-20-calendar-mcp',
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
        name: 'calendar_metadata',
        description: 'Return calendar dataset metadata: row count, columns, date span, and hash. Use this first to verify the loaded calendar version.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'events_calendar_query',
        description: 'Structured query over the AW_20 events diary/calendar. Filter by date range, city, country, event kind, category, diary layer, Alex default status, visibility, likely rooms, and privacy risk.',
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
            visibility: { type: 'string' },
            likely_rooms: { type: 'string' },
            limit: { type: 'number' },
          },
        },
      },
      {
        name: 'event_lookup',
        description: 'Look up a single event by event_id, event name, or canon note text. Useful when a scene references a specific diary entry.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Event id, title, or phrase.' },
          },
          required: ['query'],
        },
      },
      {
        name: 'calendar_window_brief',
        description: 'Build a scene-planning brief for a date window: hard commitments, public-world weather, privacy-risk events, and scheduling guidance.',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Inclusive start date, YYYY-MM-DD.' },
            end_date: { type: 'string', description: 'Inclusive end date, YYYY-MM-DD.' },
          },
          required: ['start_date', 'end_date'],
        },
      },
      {
        name: 'privacy_risk_scan',
        description: 'Return high privacy-risk calendar entries inside a date range. Use before placing scenes in public, travel, hotels, parties, arrivals, or paparazzi-heavy contexts.',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Inclusive start date, YYYY-MM-DD.' },
            end_date: { type: 'string', description: 'Inclusive end date, YYYY-MM-DD.' },
          },
          required: ['start_date', 'end_date'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = request.params.name;
    const args = request.params.arguments ?? {};

    let result: unknown;

    if (tool === 'calendar_metadata') result = calendarMetadata();
    else if (tool === 'events_calendar_query') {
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
        visibility: args.visibility ? String(args.visibility) : undefined,
        likely_rooms: args.likely_rooms ? String(args.likely_rooms) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : undefined,
      });
    }
    else if (tool === 'event_lookup') result = getEvent(String(args.query ?? ''));
    else if (tool === 'calendar_window_brief') result = calendarWindowBrief(String(args.start_date ?? ''), String(args.end_date ?? ''));
    else if (tool === 'privacy_risk_scan') result = privacyRiskScan(String(args.start_date ?? ''), String(args.end_date ?? ''));
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
