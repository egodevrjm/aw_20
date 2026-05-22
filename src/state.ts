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
  const state = JSON.parse(decoded) as StoryState;

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
  if (!token) return writeLocalState(state);

  const body: Record<string, unknown> = {
    message: 'Update AW_20 story state',
    content: Buffer.from(JSON.stringify(state, null, 2)).toString('base64'),
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
      ...writeLocalState(state),
      persistence: {
        provider: 'local-ephemeral',
        durable: false,
        message: `GitHub state write failed: ${response.status} ${response.statusText}. Wrote local fallback only.`,
      },
    };
  }

  return {
    ...state,
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
    ...(JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as StoryState),
    persistence: {
      provider: 'local-ephemeral',
      durable: false,
      message: 'Read local serverless state. This may not persist across sessions.',
    },
  };
}

function writeLocalState(state: StoryState): StoryState {
  ensureStateDirectory();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  return {
    ...state,
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
  const token = getToken();

  if (!token) {
    const current = readLocalState();
    return writeLocalState({
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  }

  const { state: current, sha } = await readGithubState();
  const updated: StoryState = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  return writeGithubState(updated, sha);
}
