import fs from 'node:fs';
import path from 'node:path';

export type StoryState = {
  currentArc?: string;
  activeTimeline?: string;
  continuityNotes?: string[];
  updatedAt: string;
};

const STATE_DIR = path.resolve('./state');
const STATE_FILE = path.join(STATE_DIR, 'story-state.json');

function ensureStateDirectory() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

export function getStoryState(): StoryState {
  ensureStateDirectory();

  if (!fs.existsSync(STATE_FILE)) {
    return {
      updatedAt: new Date().toISOString(),
      continuityNotes: [],
    };
  }

  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as StoryState;
}

export function updateStoryState(partial: Partial<StoryState>): StoryState {
  ensureStateDirectory();

  const current = getStoryState();

  const updated: StoryState = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2));

  return updated;
}
