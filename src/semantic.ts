import crypto from 'node:crypto';

import { SearchResult, loadCanon } from './canon.js';

export type SemanticResult = SearchResult & {
  similarity: number;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function vectorise(text: string): Map<string, number> {
  const vector = new Map<string, number>();

  for (const token of tokenize(text)) {
    vector.set(token, (vector.get(token) ?? 0) + 1);
  }

  return vector;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const value of a.values()) {
    magnitudeA += value * value;
  }

  for (const value of b.values()) {
    magnitudeB += value * value;
  }

  for (const [key, value] of a.entries()) {
    dot += value * (b.get(key) ?? 0);
  }

  if (!magnitudeA || !magnitudeB) return 0;

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function makeExcerpt(content: string, length = 420): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, length);
}

export function semanticSearch(query: string, limit = 10): SemanticResult[] {
  const queryVector = vectorise(query);

  return loadCanon()
    .map((document) => {
      const similarity = cosineSimilarity(
        queryVector,
        vectorise(`${document.title}\n${document.headings.join('\n')}\n${document.content}`)
      );

      return {
        path: document.path,
        title: document.title,
        score: Math.round(similarity * 1000),
        similarity,
        excerpt: makeExcerpt(document.content),
      };
    })
    .filter((result) => result.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || a.path.localeCompare(b.path))
    .slice(0, limit);
}

export function canonFingerprint(): string {
  const hash = crypto.createHash('sha256');

  for (const document of loadCanon()) {
    hash.update(document.path);
    hash.update(document.content);
  }

  return hash.digest('hex');
}
