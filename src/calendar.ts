import fs from 'node:fs';
import path from 'node:path';

export type CalendarEvent = Record<string, string>;

export type CalendarQueryInput = {
  start_date?: string;
  end_date?: string;
  city?: string;
  country?: string;
  event_kind?: string;
  category?: string;
  alex_default_status?: string;
  diary_layer?: string;
  privacy_risk?: string;
  limit?: number;
};

export type CalendarQueryResult = {
  query: CalendarQueryInput;
  count: number;
  events: CalendarEvent[];
};

const CALENDAR_PATH = path.resolve(process.cwd(), '54_EVENTS_DIARY_CALENDAR.csv');

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text: string): CalendarEvent[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: CalendarEvent = {};

    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });

    return row;
  });
}

export function loadCalendar(): CalendarEvent[] {
  if (!fs.existsSync(CALENDAR_PATH)) return [];
  return parseCsv(fs.readFileSync(CALENDAR_PATH, 'utf-8'));
}

function inDateRange(event: CalendarEvent, start?: string, end?: string): boolean {
  if (!start && !end) return true;

  const eventStart = event.start_date;
  const eventEnd = event.end_date || event.start_date;

  if (start && eventEnd < start) return false;
  if (end && eventStart > end) return false;

  return true;
}

function contains(value: string | undefined, query: string | undefined): boolean {
  if (!query) return true;
  return (value ?? '').toLowerCase().includes(query.toLowerCase());
}

const STATUS_PRIORITY: Record<string, number> = {
  attended: 0,
  completed: 1,
  default: 2,
  public_weather: 3,
  not_default: 4,
};

const DIARY_LAYER_PRIORITY: Record<string, number> = {
  hard_commitment: 0,
  canon_private: 1,
  past_context: 2,
  public_weather: 3,
};

function rank(value: string, table: Record<string, number>): number {
  return table[value] ?? 99;
}

export function queryCalendar(input: CalendarQueryInput): CalendarQueryResult {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const events = loadCalendar()
    .filter((event) => inDateRange(event, input.start_date, input.end_date))
    .filter((event) => contains(event.city, input.city))
    .filter((event) => contains(event.country, input.country))
    .filter((event) => contains(event.event_kind, input.event_kind))
    .filter((event) => contains(event.category, input.category))
    .filter((event) => contains(event.alex_default_status, input.alex_default_status))
    .filter((event) => contains(event.diary_layer, input.diary_layer))
    .filter((event) => contains(event.privacy_risk, input.privacy_risk))
    .sort((a, b) => {
      const dateCompare = (a.start_date ?? '').localeCompare(b.start_date ?? '');
      if (dateCompare !== 0) return dateCompare;

      const statusCompare = rank(a.alex_default_status, STATUS_PRIORITY) - rank(b.alex_default_status, STATUS_PRIORITY);
      if (statusCompare !== 0) return statusCompare;

      return rank(a.diary_layer, DIARY_LAYER_PRIORITY) - rank(b.diary_layer, DIARY_LAYER_PRIORITY);
    })
    .slice(0, limit);

  return {
    query: input,
    count: events.length,
    events,
  };
}
