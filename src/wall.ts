import { getCanonFile, searchCanon } from './canon.js';

export type WallCheckResult = {
  character: string;
  matchedPosition?: string;
  access: Record<string, string>;
  guidance: string;
  supportingExcerpt: string;
};

const POSITION_ALIASES: Record<string, string[]> = {
  'Alex': ['alex'],
  'Rosie / Homer': ['rosie', 'homer'],
  'Dawson elders / closest family': ['dawson', 'closest family', 'family elder'],
  'Godparents / godfamily elders': ['godparent', 'godfamily'],
  'Brain Trust: Apple / Iris / Lila / Kaia / Rocco': ['apple', 'iris', 'lila', 'kaia', 'rocco', 'brain trust'],
  'Close peers outside Brain Trust': ['close peer', 'peer'],
  'London Lot': ['london lot'],
  'Serena Management': ['serena management', 'serena'],
  'AW family-office staff': ['family office', 'aw staff'],
  'Knight Frank / household staff': ['knight frank', 'household staff'],
  'Walker Holdings staff': ['walker holdings'],
  'Press / fans': ['press', 'fan', 'fans'],
};

function parseMarkdownTable(content: string): Array<Record<string, string>> {
  const lines = content.split('\n').filter((line) => line.trim().startsWith('|'));
  if (lines.length < 3) return [];

  const headers = lines[0].split('|').slice(1, -1).map((cell) => cell.trim());

  return lines.slice(2).map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });

    return row;
  });
}

function aliasMatch(character: string): string | undefined {
  const normalised = character.toLowerCase();

  for (const [position, aliases] of Object.entries(POSITION_ALIASES)) {
    if (aliases.some((alias) => normalised.includes(alias))) return position;
  }

  return undefined;
}

export function wallCheck(character: string): WallCheckResult {
  const wall = getCanonFile('42_THE_WALL.md');
  const content = wall?.content ?? searchCanon('Position Map Public identity Boundary career pressure Operations Private family texture Albury interior', 1)[0]?.excerpt ?? '';
  const rows = parseMarkdownTable(content);
  const matchedPosition = aliasMatch(character);
  const row = rows.find((candidate) => candidate.Position === matchedPosition);

  if (row) {
    return {
      character,
      matchedPosition,
      access: row,
      guidance: 'Use only the union of this character position access. Do not leak restricted operational, chat, property, or private family knowledge beyond this row.',
      supportingExcerpt: content.slice(0, 1200),
    };
  }

  return {
    character,
    matchedPosition,
    access: {},
    guidance: 'No direct wall position matched. Treat as public/social layer only unless canon search proves a closer role. Run search_canon for the character before writing privileged knowledge.',
    supportingExcerpt: content.slice(0, 1200),
  };
}
