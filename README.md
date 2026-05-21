# AW_20 MCP Server

Structured MCP server for the AW_20 canon universe.

## Features

- Recursive canon indexing
- Markdown heading extraction
- Weighted canon search
- MCP tool endpoints
- TypeScript and Node.js
- GitHub Actions build workflow

## MCP Tools

### search_canon
Search all canon files.

Example:

```txt
search_canon("Kensington")
```

### list_canon_files
List indexed canon files.

### get_canon_file
Retrieve a canon file by path.

Example:

```txt
get_canon_file("characters/alex-wilson.md")
```

## Setup

```bash
npm install
npm run build
npm start
```

## Development

```bash
npm run dev
```

## Suggested Canon Layout

```txt
canon/
  characters/
  locations/
  timelines/
  songs/
  fashion/
```

## Architecture

```txt
MCP Client
  ↓
AW_20 MCP Server
  ↓
Canon Index
  ↓
Markdown and JSON files
```

## Planned Next Steps

- semantic search
- embeddings
- timeline queries
- continuity memory
- version switching
- graph relationships
- Supabase vector support
