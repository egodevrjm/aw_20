import { CanonDocument, canonCheck, loadCanon, searchCanon } from './canon.js';

export type CanonChunk = {
  id: string;
  path: string;
  title: string;
  category: string;
  heading: string;
  text: string;
  wordCount: number;
};

export type ContextPack = {
  query: string;
  documents: ReturnType<typeof searchCanon>;
  chunks: CanonChunk[];
  suggestedPrompt: string;
};

export type SceneBuilderInput = {
  premise: string;
  location?: string;
  characters?: string[];
  purpose?: string;
  tone?: string;
};

export type SceneBuilderOutput = {
  premise: string;
  purpose?: string;
  tone?: string;
  canonStatus: ReturnType<typeof canonCheck>[];
  suggestedCharacters: ReturnType<typeof searchCanon>;
  suggestedLocations: ReturnType<typeof searchCanon>;
  settingBrief: CanonChunk[];
  relevantContext: CanonChunk[];
  roomAndBuildingNotes: string[];
  continuityWarnings: string[];
  scenePrompt: string;
};

export type ConflictFinding = {
  type: 'possible-date-conflict' | 'duplicate-title' | 'empty-document' | 'short-document';
  severity: 'low' | 'medium' | 'high';
  message: string;
  paths: string[];
};

export type ExtractedEvent = {
  path: string;
  title: string;
  dateOrYear: string;
  sentence: string;
};

const TAG_PATTERNS: Record<string, RegExp[]> = {
  music: [/piano/i, /song/i, /album/i, /studio/i, /guitar/i, /academy/i],
  property: [/house/i, /townhouse/i, /villa/i, /room/i, /residence/i, /estate/i],
  celebrity: [/paparazzi/i, /public image/i, /media/i, /celebrity/i, /fame/i],
  fashion: [/suit/i, /dress/i, /watch/i, /style/i, /fashion/i],
  relationship: [/wife/i, /girlfriend/i, /friend/i, /family/i, /relationship/i],
  timeline: [/\b\d{4}\b/, /before/i, /after/i, /during/i],
  emotional: [/lonely/i, /isolated/i, /grief/i, /hope/i, /fear/i, /love/i],
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitIntoSections(document: CanonDocument): CanonChunk[] {
  const lines = document.content.split('\n');
  const chunks: CanonChunk[] = [];
  let heading = document.title;
  let buffer: string[] = [];
  let index = 0;

  function flush() {
    const text = buffer.join('\n').trim();
    if (!text) return;

    chunks.push({
      id: `${document.path}#${index}`,
      path: document.path,
      title: document.title,
      category: document.category,
      heading,
      text,
      wordCount: wordCount(text),
    });

    index += 1;
    buffer = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flush();
      heading = headingMatch[1].trim();
    } else {
      buffer.push(line);
    }
  }

  flush();
  return chunks;
}

export function chunkCanon(): CanonChunk[] {
  return loadCanon().flatMap(splitIntoSections);
}

export function searchChunks(query: string, limit = 12): CanonChunk[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return chunkCanon()
    .map((chunk) => {
      const haystack = `${chunk.title}\n${chunk.heading}\n${chunk.text}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.path.localeCompare(b.chunk.path))
    .slice(0, limit)
    .map(({ chunk }) => chunk);
}

export function buildContextPack(query: string): ContextPack {
  const documents = searchCanon(query, 8);
  const chunks = searchChunks(query, 12);

  return {
    query,
    documents,
    chunks,
    suggestedPrompt: `Use the following AW_20 canon context to answer questions about: ${query}`,
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function buildSceneBrief(input: SceneBuilderInput): SceneBuilderOutput {
  const premise = input.premise.trim();
  const location = input.location?.trim();
  const characters = input.characters ?? [];
  const purpose = input.purpose?.trim();
  const tone = input.tone?.trim();

  const lookupTerms = uniqueStrings([
    premise,
    location ?? '',
    ...characters,
    purpose ?? '',
    tone ?? '',
  ]);

  const canonStatus = lookupTerms.slice(0, 12).map((term) => canonCheck(term));
  const suggestedCharacters = searchCanon(`characters ${characters.join(' ')} ${premise}`, 8);
  const suggestedLocations = searchCanon(`locations ${location ?? ''} ${premise}`, 8);
  const settingBrief = searchChunks(`${location ?? ''} room building house studio residence ${premise}`, 10);
  const relevantContext = searchChunks(lookupTerms.join(' '), 16);

  const roomAndBuildingNotes = settingBrief.length
    ? settingBrief.map((chunk) => `${chunk.title} / ${chunk.heading}: ${chunk.text.slice(0, 280)}`)
    : ['No specific room/building canon found. Use a neutral setting unless the user supplies one.'];

  const continuityWarnings = canonStatus
    .filter((status) => status.verdict === 'not_found' || status.verdict === 'ambiguous')
    .map((status) => `${status.query}: ${status.guidance}`);

  const namedCharacters = characters.length ? characters.join(', ') : 'Use only characters clearly supported by canon or introduced by the user.';
  const sceneLocation = location ?? 'Choose the strongest canon-supported location from the context.';

  return {
    premise,
    purpose,
    tone,
    canonStatus,
    suggestedCharacters,
    suggestedLocations,
    settingBrief,
    relevantContext,
    roomAndBuildingNotes,
    continuityWarnings,
    scenePrompt: [
      `Build a scene for: ${premise}`,
      `Purpose: ${purpose ?? 'not specified'}`,
      `Tone: ${tone ?? 'match canon and user instruction'}`,
      `Characters: ${namedCharacters}`,
      `Location: ${sceneLocation}`,
      'Use only canon-supported details unless the user explicitly adds new facts.',
      'Before writing, resolve any continuity warnings and ground the room/building description in settingBrief.',
    ].join('\n'),
  };
}

export function inferTagsForDocument(document: CanonDocument): string[] {
  const text = `${document.title}\n${document.headings.join('\n')}\n${document.content}`;

  return Object.entries(TAG_PATTERNS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
    .map(([tag]) => tag)
    .sort();
}

export function canonOntology() {
  return loadCanon().map((document) => ({
    path: document.path,
    title: document.title,
    category: document.category,
    tags: inferTagsForDocument(document),
    headings: document.headings,
    wordCount: document.wordCount,
  }));
}

export function detectContinuityConflicts(): ConflictFinding[] {
  const documents = loadCanon();
  const findings: ConflictFinding[] = [];
  const titleMap = new Map<string, CanonDocument[]>();

  for (const document of documents) {
    const key = document.title.toLowerCase();
    titleMap.set(key, [...(titleMap.get(key) ?? []), document]);

    if (!document.content.trim()) {
      findings.push({
        type: 'empty-document',
        severity: 'high',
        message: `Empty canon document: ${document.title}`,
        paths: [document.path],
      });
    }

    if (document.wordCount > 0 && document.wordCount < 30) {
      findings.push({
        type: 'short-document',
        severity: 'low',
        message: `Very short canon document: ${document.title}`,
        paths: [document.path],
      });
    }
  }

  for (const [title, matches] of titleMap.entries()) {
    if (matches.length > 1) {
      findings.push({
        type: 'duplicate-title',
        severity: 'medium',
        message: `Duplicate canon title: ${title}`,
        paths: matches.map((match) => match.path),
      });
    }
  }

  const dateClaims = new Map<string, CanonDocument[]>();

  for (const document of documents) {
    for (const match of document.content.matchAll(/\b(19|20)\d{2}\b/g)) {
      const year = match[0];
      dateClaims.set(year, [...(dateClaims.get(year) ?? []), document]);
    }
  }

  for (const [year, matches] of dateClaims.entries()) {
    const uniqueCategories = new Set(matches.map((match) => match.category));
    if (matches.length > 5 && uniqueCategories.size > 2) {
      findings.push({
        type: 'possible-date-conflict',
        severity: 'low',
        message: `Year ${year} appears across many canon areas; review for continuity density.`,
        paths: [...new Set(matches.map((match) => match.path))],
      });
    }
  }

  return findings;
}

export function extractTimelineEvents(): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];

  for (const document of loadCanon()) {
    const sentences = document.content.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      const match = sentence.match(/\b(19|20)\d{2}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
      if (!match) continue;

      events.push({
        path: document.path,
        title: document.title,
        dateOrYear: match[0],
        sentence: sentence.trim(),
      });
    }
  }

  return events;
}
