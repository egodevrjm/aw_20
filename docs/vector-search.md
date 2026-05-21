# Vector Search Architecture

## Goal

Move AW_20 from keyword search into semantic retrieval.

## Recommended Stack

- OpenAI embeddings
- Supabase pgvector
- MCP retrieval tools

## Flow

```txt
canon files
    ↓
embedding generation
    ↓
Supabase pgvector
    ↓
semantic retrieval
    ↓
MCP tool response
```

## Environment Variables

```txt
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Supabase Setup

Run:

```sql
supabase/schema.sql
```

inside the SQL editor.

## Indexing

Run:

```bash
npm run index:vectors
```

## Future Direction

- hybrid search
- relationship graphing
- timeline reasoning
- lore chunking
- streaming retrieval
- continuity-aware context assembly
