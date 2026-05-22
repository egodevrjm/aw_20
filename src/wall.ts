import { getCanonFile, searchCanon } from './canon.js';

export type WallCheckResult = {
  character: string;
  matchedPosition?: string;
  access: Record<string, string>;
  guidance: string;
  supportingExcerpt: string;
  resolution: 'named-map' | 'role-alias' | 'search-inferred' | 'fallback';
};

const NAMED_POSITION_MAP: Record<string, string> = {
  latham: 'Serena Management',
  daniel: 'Serena Management',
  declan: 'Serena Management',
  karla: 'Serena Management',
  'lede company': 'Serena Management',
  'knight frank': 'Knight Frank / household staff',
  rosie: 'Rosie / Homer',
  homer: 'Rosie / Homer',
  apple: 'Brain Trust: Apple / Iris / Lila / Kaia / Rocco',
  iris: 'Brain Trust: Apple / Iris / Lila / Kaia / Rocco',
  lila: 'Brain Trust: Apple / Iris / Lila / Kaia / Rocco',
  kaia: 'Brain Trust: Apple / Iris / Lila / Kaia / Rocco',
  rocco: 'Brain Trust: Apple / Iris / Lila / Kaia / Rocco',
};

const PUBLIC_LAYER_TERMS = [
  'press',
  'the press',
  'tabloid',
  'tabloids',
  'journalist',
  'journalists',
  'reporter',
  'reporters',
  'media',
  'paparazzi',
  'pap',
  'paps',
  'fan',
  'fans',
  'public',
  'public layer',
  'social media',
  'twitter',
  'x',
  'tiktok',
  'instagram',
];

const POSITION_ALIASES: Record<string, string[]> = {
  'Alex': ['alex'],
  'Rosie / Homer': ['rosie', 'homer'],
  'Dawson elders / closest family': ['dawson', 'closest family', 'family elder'],
  'Godparents / godfamily elders': ['godparent', 'godfamily'],
  'Brain Trust: Apple / Iris / Lila / Kaia / Rocco': ['apple', 'iris', 'lila', 'kaia', 'rocco', 'brain trust'],
  'Close peers outside Brain Trust': ['close peer', 'peer'],
  'London Lot': ['london lot'],
  'Serena Management': ['serena management', 'serena', 'latham', 'management', 'manager', 'publicist', 'comms team', 'pr team'],
  'AW family-office staff': ['family office', 'aw staff'],
  'Knight Frank / household staff': ['knight frank', 'household staff', 'household', 'butler', 'house manager'],
  'Walker Holdings staff': ['walker holdings'],
  'Press / fans': PUBLIC_LAYER_TERMS,
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

function hasPublicLayerTerm(character: string): boolean {
  const normalised = character.toLowerCase();
  return PUBLIC_LAYER_TERMS.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\b)${escaped}(\\b|$)`, 'i').test(normalised);
  });
}

function namedMatch(character: string): string | undefined {
  const normalised = character.toLowerCase();

  for (const [name, position] of Object.entries(NAMED_POSITION_MAP)) {
    if (normalised.includes(name)) return position;
  }

  return undefined;
}

function aliasMatch(character: string): string | undefined {
  if (hasPublicLayerTerm(character)) return 'Press / fans';

  const normalised = character.toLowerCase();

  for (const [position, aliases] of Object.entries(POSITION_ALIASES)) {
    if (aliases.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|\\b)${escaped}(\\b|$)`, 'i').test(normalised);
    })) return position;
  }

  return undefined;
}

function inferFromSearch(character: string): string | undefined {
  if (hasPublicLayerTerm(character)) return 'Press / fans';

  const evidence = searchCanon(`${character} Serena Management Knight Frank family office Walker Holdings Brain Trust London Lot`, 5);
  const combined = evidence.map((result) => `${result.title}\n${result.path}\n${result.excerpt}`).join('\n').toLowerCase();

  if (combined.includes('serena management') || combined.includes('serena/al.x')) return 'Serena Management';
  if (combined.includes('knight frank') || combined.includes('household staff')) return 'Knight Frank / household staff';
  if (combined.includes('family-office') || combined.includes('family office')) return 'AW family-office staff';
  if (combined.includes('walker holdings')) return 'Walker Holdings staff';
  if (combined.includes('brain trust')) return 'Brain Trust: Apple / Iris / Lila / Kaia / Rocco';
  if (combined.includes('london lot')) return 'London Lot';

  return undefined;
}

function resolvePosition(character: string): { position?: string; resolution: WallCheckResult['resolution'] } {
  if (hasPublicLayerTerm(character)) return { position: 'Press / fans', resolution: 'role-alias' };

  const named = namedMatch(character);
  if (named) return { position: named, resolution: 'named-map' };

  const alias = aliasMatch(character);
  if (alias) return { position: alias, resolution: 'role-alias' };

  const inferred = inferFromSearch(character);
  if (inferred) return { position: inferred, resolution: 'search-inferred' };

  return { resolution: 'fallback' };
}

export function wallCheck(character: string): WallCheckResult {
  const wall = getCanonFile('42_THE_WALL.md');
  const content = wall?.content ?? searchCanon('Position Map Public identity Boundary career pressure Operations Private family texture Albury interior', 1)[0]?.excerpt ?? '';
  const rows = parseMarkdownTable(content);
  const { position: matchedPosition, resolution } = resolvePosition(character);
  const row = rows.find((candidate) => candidate.Position === matchedPosition);

  if (row) {
    return {
      character,
      matchedPosition,
      access: row,
      resolution,
      guidance: 'Use only the union of this character position access. Do not leak restricted operational, chat, property, or private family knowledge beyond this row.',
      supportingExcerpt: content.slice(0, 1200),
    };
  }

  return {
    character,
    matchedPosition,
    access: {},
    resolution,
    guidance: 'No direct wall position matched. Treat as public/social layer only unless canon search proves a closer role. Run search_canon for the character before writing privileged knowledge.',
    supportingExcerpt: content.slice(0, 1200),
  };
}
