import fs from 'node:fs';
import path from 'node:path';

export type PersistenceProvider = 'github' | 'local-ephemeral';

export type StoryState = {
  currentArc?: string;
  activeTimeline?: string;
  continuityNotes?: string[];
  updatedAt: string;
  persistence?: {
    provider: PersistenceProvider;
    durable: boolean;
    message: string;
  };
};

const STATE_DIR = path.resolve('./state');
const STATE_FILE = path.join(STATE_DIR, 'story-state.json');
const GITHUB_STATE_PATH = process.env.AW20_STATE_PATH ?? 'state/story-state.json';
const GITHUB_REPO = process.env.AW20_STATE_REPO ?? 'egodevrjm/aw_20';
const GITHUB_BRANCH = process.env.AW20_STATE_BRANCH ?? 'main';

function baseState(provider: PersistenceProvider, durable: boolean, message: string): StoryState {
  return {
    updatedAt: new Date().toISOString(),
    continuityNotes: [],
    persistence: {
      provider,
      durable,
      message,
    },
  };
}

function ensureStateDirectory() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function getToken(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.AW20_GITHUB_TOKEN;
}

function githubApiUrl(): string {
  return `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_STATE_PATH}`;
}

function normalizeContinuityNotes(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  if (Array.isArray(value)) {
    return value.map(String).map((note) => note.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((note) => note.trim()).filter(Boolean);
      }
    } catch {
      // Not JSON; treat as plain text below.
    }

    if (trimmed.includes('\n')) {
      return trimmed.split('\n').map((note) => note.trim()).filter(Boolean);
    }

    return [trimmed];
  }

  return [String(value).trim()].filter(Boolean);
}

function normalizeStoryStateInput(partial: Partial<StoryState>): Partial<StoryState> {
  const normalized: Partial<StoryState> = { ...partial };
  const continuityNotes = normalizeContinuityNotes((partial as Record<string, unknown>).continuityNotes);

  if (continuityNotes !== undefined) {
    normalized.continuityNotes = continuityNotes;
  }

  return normalized;
}

function normalizeStoryState(state: StoryState): StoryState {
  return {
    ...state,
    continuityNotes: normalizeContinuityNotes(state.continuityNotes) ?? [],
  };
}

async function readGithubState(): Promise<{ state: StoryState; sha?: string }> {
  const token = getToken();
  if (!token) {
    return {
      state: baseState(
        'local-ephemeral',
        false,
        'No GitHub token configured. State reads use local serverless fallback and may not persist across sessions.'
      ),
    };
  }

  const response = await fetch(`${githubApiUrl()}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aw20-mcp',
    },
  });

  if (response.status === 404) {
    return {
      state: baseState('github', true, 'No persisted GitHub state file found yet; a new one will be created on update.'),
    };
  }

  if (!response.ok) {
    return {
      state: baseState('local-ephemeral', false, `GitHub state read failed: ${response.status} ${response.statusText}`),
    };
  }

  const data = await response.json() as { content: string; sha: string };
  const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
  const state = normalizeStoryState(JSON.parse(decoded) as StoryState);

  return {
    state: {
      ...state,
      persistence: {
        provider: 'github',
        durable: true,
        message: `Loaded durable state from ${GITHUB_REPO}/${GITHUB_STATE_PATH}.`,
      },
    },
    sha: data.sha,
  };
}

async function writeGithubState(state: StoryState, sha?: string): Promise<StoryState> {
  const token = getToken();
  const normalizedState = normalizeStoryState(state);

  if (!token) return writeLocalState(normalizedState);

  const body: Record<string, unknown> = {
    message: 'Update AW_20 story state',
    content: Buffer.from(JSON.stringify(normalizedState, null, 2)).toString('base64'),
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
    return {
      ...writeLocalState(normalizedState),
      persistence: {
        provider: 'local-ephemeral',
        durable: false,
        message: `GitHub state write failed: ${response.status} ${response.statusText}. Wrote local fallback only.`,
      },
    };
  }

  return {
    ...normalizedState,
    persistence: {
      provider: 'github',
      durable: true,
      message: `Persisted durable state to ${GITHUB_REPO}/${GITHUB_STATE_PATH}.`,
    },
  };
}

function readLocalState(): StoryState {
  ensureStateDirectory();

  if (!fs.existsSync(STATE_FILE)) {
    return baseState('local-ephemeral', false, 'No durable provider configured. Local state may not persist across Vercel serverless sessions.');
  }

  return {
    ...normalizeStoryState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as StoryState),
    persistence: {
      provider: 'local-ephemeral',
      durable: false,
      message: 'Read local serverless state. This may not persist across sessions.',
    },
  };
}

function writeLocalState(state: StoryState): StoryState {
  ensureStateDirectory();
  const normalizedState = normalizeStoryState(state);
  fs.writeFileSync(STATE_FILE, JSON.stringify(normalizedState, null, 2));

  return {
    ...normalizedState,
    persistence: {
      provider: 'local-ephemeral',
      durable: false,
      message: 'Wrote local serverless fallback state. This may not persist across sessions.',
    },
  };
}

export async function getStoryState(): Promise<StoryState> {
  const token = getToken();
  if (!token) return readLocalState();

  return (await readGithubState()).state;
}

export async function updateStoryState(partial: Partial<StoryState>): Promise<StoryState> {
  const normalizedPartial = normalizeStoryStateInput(partial);
  const token = getToken();

  if (!token) {
    const current = readLocalState();
    return writeLocalState({
      ...current,
      ...normalizedPartial,
      updatedAt: new Date().toISOString(),
    });
  }

  const { state: current, sha } = await readGithubState();
  const updated: StoryState = {
    ...current,
    ...normalizedPartial,
    updatedAt: new Date().toISOString(),
  };

  return writeGithubState(updated, sha);
}
