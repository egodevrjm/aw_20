import fs from 'node:fs';
import path from 'node:path';

export type LedgerEntryInput = {
  session?: string;
  date?: string;
  category: string;
  fact: string;
  source?: string;
};

export type LedgerEntry = Required<Pick<LedgerEntryInput, 'category' | 'fact'>> & {
  id: string;
  session: string;
  date: string;
  source?: string;
  createdAt: string;
};

export type LedgerAppendResult = {
  entry: LedgerEntry;
  totalEntries: number;
  persistence: {
    provider: 'github' | 'local-ephemeral';
    durable: boolean;
    message: string;
  };
};

const LOCAL_LEDGER_DIR = path.resolve('./state');
const LOCAL_LEDGER_FILE = path.join(LOCAL_LEDGER_DIR, 'ledger.json');
const GITHUB_LEDGER_PATH = process.env.AW20_LEDGER_PATH ?? 'state/ledger.json';
const GITHUB_REPO = process.env.AW20_STATE_REPO ?? 'egodevrjm/aw_20';
const GITHUB_BRANCH = process.env.AW20_STATE_BRANCH ?? 'main';

function getToken(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.AW20_GITHUB_TOKEN;
}

function githubApiUrl(): string {
  return `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_LEDGER_PATH}`;
}

function makeId(input: LedgerEntryInput): string {
  const seed = `${input.session ?? 'session'}|${input.date ?? new Date().toISOString()}|${input.category}|${input.fact}`;
  return Buffer.from(seed).toString('base64url').slice(0, 24);
}

function normaliseEntry(input: LedgerEntryInput): LedgerEntry {
  return {
    id: makeId(input),
    session: input.session?.trim() || 'default',
    date: input.date?.trim() || new Date().toISOString().slice(0, 10),
    category: input.category.trim(),
    fact: input.fact.trim(),
    source: input.source?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

function ensureLocalDirectory() {
  if (!fs.existsSync(LOCAL_LEDGER_DIR)) {
    fs.mkdirSync(LOCAL_LEDGER_DIR, { recursive: true });
  }
}

function readLocalLedger(): LedgerEntry[] {
  ensureLocalDirectory();
  if (!fs.existsSync(LOCAL_LEDGER_FILE)) return [];
  return JSON.parse(fs.readFileSync(LOCAL_LEDGER_FILE, 'utf-8')) as LedgerEntry[];
}

function writeLocalLedger(entries: LedgerEntry[]): LedgerEntry[] {
  ensureLocalDirectory();
  fs.writeFileSync(LOCAL_LEDGER_FILE, JSON.stringify(entries, null, 2));
  return entries;
}

async function readGithubLedger(): Promise<{ entries: LedgerEntry[]; sha?: string }> {
  const token = getToken();
  if (!token) return { entries: readLocalLedger() };

  const response = await fetch(`${githubApiUrl()}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aw20-mcp',
    },
  });

  if (response.status === 404) return { entries: [] };
  if (!response.ok) return { entries: readLocalLedger() };

  const data = await response.json() as { content: string; sha: string };
  const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
  return {
    entries: JSON.parse(decoded) as LedgerEntry[],
    sha: data.sha,
  };
}

async function writeGithubLedger(entries: LedgerEntry[], sha?: string): Promise<LedgerAppendResult['persistence']> {
  const token = getToken();
  if (!token) {
    writeLocalLedger(entries);
    return {
      provider: 'local-ephemeral',
      durable: false,
      message: 'No GitHub token configured. Ledger wrote to local serverless fallback only.',
    };
  }

  const body: Record<string, unknown> = {
    message: 'Append AW_20 ledger entry',
    content: Buffer.from(JSON.stringify(entries, null, 2)).toString('base64'),
    branch: GITHUB_BRANCH,
  };

  if (sha) body.sha = sha;

  const response = await fetch(githubApiUrl(), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'aw20-mcp',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    writeLocalLedger(entries);
    return {
      provider: 'local-ephemeral',
      durable: false,
      message: `GitHub ledger write failed: ${response.status} ${response.statusText}. Wrote local fallback only.`,
    };
  }

  return {
    provider: 'github',
    durable: true,
    message: `Persisted ledger to ${GITHUB_REPO}/${GITHUB_LEDGER_PATH}.`,
  };
}

export async function appendLedger(input: LedgerEntryInput): Promise<LedgerAppendResult> {
  if (!input.category?.trim()) throw new Error('append_ledger requires category.');
  if (!input.fact?.trim()) throw new Error('append_ledger requires fact.');

  const entry = normaliseEntry(input);
  const { entries, sha } = await readGithubLedger();
  const nextEntries = [...entries, entry];
  const persistence = await writeGithubLedger(nextEntries, sha);

  return {
    entry,
    totalEntries: nextEntries.length,
    persistence,
  };
}
