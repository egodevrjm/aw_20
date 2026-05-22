import { canonCheck, searchCanon } from './canon.js';
import { wallCheck } from './wall.js';

export type CharacterLookupResult = {
  name: string;
  canonStatus: ReturnType<typeof canonCheck>;
  wall: ReturnType<typeof wallCheck>;
  likelyCanonFiles: ReturnType<typeof searchCanon>;
  relationshipEvidence: ReturnType<typeof searchCanon>;
  voiceEvidence: ReturnType<typeof searchCanon>;
  knowledgeEvidence: ReturnType<typeof searchCanon>;
  guidance: string;
};

export function characterLookup(name: string): CharacterLookupResult {
  const trimmedName = name.trim();

  const likelyCanonFiles = searchCanon(trimmedName, 8);
  const relationshipEvidence = searchCanon(`${trimmedName} relationship Alex family friend`, 6);
  const voiceEvidence = searchCanon(`${trimmedName} voice register tone dialogue`, 6);
  const knowledgeEvidence = searchCanon(`${trimmedName} knows access private public wall`, 6);
  const wall = wallCheck(trimmedName);
  const canonStatus = canonCheck(trimmedName, 6);

  return {
    name: trimmedName,
    canonStatus,
    wall,
    likelyCanonFiles,
    relationshipEvidence,
    voiceEvidence,
    knowledgeEvidence,
    guidance: 'Use canonStatus to decide whether the character is established. Use wall.access to constrain what they can know. Use the evidence arrays as provenance before writing dialogue, private knowledge, or relationships.',
  };
}
