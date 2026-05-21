# AW_20 MCP Server

A starter MCP (Model Context Protocol) server for the AW_20 universe.

## Features

- `search_canon`
- Markdown/text canon search
- TypeScript + Node.js
- MCP SDK ready

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

## Canon Files

Place lore files inside:

```txt
/canon
```

Example:

```txt
canon/
  alex.md
  timeline.md
  locations.md
```

## MCP Tool

### search_canon

Searches canon files for matching text.

Example:

```txt
search_canon("Kensington")
```

## Next Steps

Planned:

- semantic vector search
- embeddings
- character endpoints
- timeline queries
- continuity state
- multi-version canon support
- GitHub-backed indexing
