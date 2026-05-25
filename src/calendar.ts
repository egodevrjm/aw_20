import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
  visibility?: string;
  likely_rooms?: string;
  limit?: number;
};

export type CalendarQueryResult = {
  query: CalendarQueryInput;
  count: number;
  events: CalendarEvent[];
};

export type CalendarMetadata = {
  eventCount: number;
  columns: string[];
  firstDate?: string;
  lastDate?: string;
  hash: string;
};

export type CalendarBrief = {
  start_date: string;
  end_date: string;
  summary: {
    totalEvents: number;
    attendedOrCompleted: number;
    publicWeather: number;
    highPrivacyRisk: number;
    mediumPrivacyRisk: number;
  };
  hardEvents: CalendarEvent[];
  publicWeather: CalendarEvent[];
  privacyRisks: CalendarEvent[];
  sceneGuidance: string[];
};

export type EventLookupResult = {
  query: string;
  event?: CalendarEvent;
  matches: CalendarEvent[];
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

function rawCalendar(): string {
  if (!fs.existsSync(CALENDAR_PATH)) return '';
  return fs.readFileSync(CALENDAR_PATH, 'utf-8');
}

export function loadCalendar(): CalendarEvent[] {
  const raw = rawCalendar();
  if (!raw) return [];
  return parseCsv(raw);
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

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const dateCompare = (a.start_date ?? '').localeCompare(b.start_date ?? '');
    if (dateCompare !== 0) return dateCompare;

    const statusCompare = rank(a.alex_default_status, STATUS_PRIORITY) - rank(b.alex_default_status, STATUS_PRIORITY);
    if (statusCompare !== 0) return statusCompare;

    return rank(a.diary_layer, DIARY_LAYER_PRIORITY) - rank(b.diary_layer, DIARY_LAYER_PRIORITY);
  });
}

export function queryCalendar(input: CalendarQueryInput): CalendarQueryResult {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const events = sortEvents(loadCalendar()
    .filter((event) => inDateRange(event, input.start_date, input.end_date))
    .filter((event) => contains(event.city, input.city))
    .filter((event) => contains(event.country, input.country))
    .filter((event) => contains(event.event_kind, input.event_kind))
    .filter((event) => contains(event.category, input.category))
    .filter((event) => contains(event.alex_default_status, input.alex_default_status))
    .filter((event) => contains(event.diary_layer, input.diary_layer))
    .filter((event) => contains(event.privacy_risk, input.privacy_risk))
    .filter((event) => contains(event.visibility, input.visibility))
    .filter((event) => contains(event.likely_rooms, input.likely_rooms)))
    .slice(0, limit);

  return {
    query: input,
    count: events.length,
    events,
  };
}

export function calendarMetadata(): CalendarMetadata {
  const raw = rawCalendar();
  const events = loadCalendar();
  const columns = raw ? parseCsvLine(raw.split(/\r?\n/)[0]) : [];
  const dates = events.map((event) => event.start_date).filter(Boolean).sort();

  return {
    eventCount: events.length,
    columns,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    hash: crypto.createHash('sha256').update(raw).digest('hex'),
  };
}

export function getEvent(query: string): EventLookupResult {
  const normalised = query.toLowerCase();
  const matches = loadCalendar().filter((event) =>
    event.event_id?.toLowerCase() === normalised ||
    event.event_name?.toLowerCase().includes(normalised) ||
    event.canon_note?.toLowerCase().includes(normalised)
  );

  return {
    query,
    event: matches[0],
    matches: matches.slice(0, 10),
  };
}

export function calendarWindowBrief(start_date: string, end_date: string): CalendarBrief {
  const events = queryCalendar({ start_date, end_date, limit: 200 }).events;
  const hardEvents = events.filter((event) => ['attended', 'completed', 'default'].includes(event.alex_default_status));
  const publicWeather = events.filter((event) => event.diary_layer === 'public_weather' || event.alex_default_status === 'public_weather');
  const privacyRisks = events.filter((event) => ['high', 'medium'].includes(event.privacy_risk));

  const sceneGuidance = [
    hardEvents.length
      ? 'There are canon/personal commitments in this window; check them before scheduling scenes.'
      : 'No hard personal commitments found in this window.',
    publicWeather.length
      ? 'Public-world events exist in this window; use them as background chatter/weather, not default attendance.'
      : 'No major public-weather events found in this window.',
    privacyRisks.some((event) => event.privacy_risk === 'high')
      ? 'High privacy-risk events exist; avoid casual public exposure unless canon says it happens.'
      : 'No high privacy-risk event flagged in this window.',
  ];

  return {
    start_date,
    end_date,
    summary: {
      totalEvents: events.length,
      attendedOrCompleted: hardEvents.length,
      publicWeather: publicWeather.length,
      highPrivacyRisk: privacyRisks.filter((event) => event.privacy_risk === 'high').length,
      mediumPrivacyRisk: privacyRisks.filter((event) => event.privacy_risk === 'medium').length,
    },
    hardEvents,
    publicWeather,
    privacyRisks,
    sceneGuidance,
  };
}

export function privacyRiskScan(start_date: string, end_date: string): CalendarQueryResult {
  return {
    query: { start_date, end_date, privacy_risk: 'high', limit: 200 },
    count: queryCalendar({ start_date, end_date, privacy_risk: 'high', limit: 200 }).count,
    events: queryCalendar({ start_date, end_date, privacy_risk: 'high', limit: 200 }).events,
  };
}
