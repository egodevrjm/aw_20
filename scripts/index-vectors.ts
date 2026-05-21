import fs from 'node:fs';
import path from 'node:path';

const CANON_DIR = path.resolve('./canon');

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const files = walk(CANON_DIR);

  console.log('Vector indexing scaffold');
  console.log(`Found ${files.length} canon files.`);

  console.log('\nNext steps:');
  console.log('- connect OpenAI embeddings');
  console.log('- connect Supabase pgvector');
  console.log('- upsert canon embeddings');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
