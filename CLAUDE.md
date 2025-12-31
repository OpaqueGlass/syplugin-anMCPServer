# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Development mode with watch (outputs to ./dev or custom path)
pnpm build          # Production build (outputs to ./dist and creates package.zip)
pnpm lint           # Run ESLint with auto-fix
```

To change the development output directory, run `pnpm change-dir` and modify `scripts/devInfo.json`.

## Architecture Overview

This is a **Siyuan Note plugin** that provides an MCP (Model Context Protocol) server, allowing AI clients to interact with Siyuan Note through standardized tools.

### Core Components

**MCP Server (`src/server/index.ts`)**
- Express.js HTTP server with Streamable HTTP transport (primary) and SSE (deprecated)
- Multi-method authentication: local Bearer token, Cloudflare Access JWT, Cloudflare Linked Apps OAuth
- Registers tools from all tool providers and handles MCP protocol

**Tool Providers (`src/tools/`)**
- Each provider extends `McpToolsProvider<T>` and implements `getTools()` returning `McpTool[]`
- Tools have: `name`, `description`, `schema` (Zod validators), `handler`, `annotations`
- Annotations (`readOnlyHint`, `destructiveHint`) control which tools are available in read-only modes

**Siyuan API Layer (`src/syapi/index.ts`)**
- Wrapper functions for all Siyuan kernel API calls (SQL queries, block operations, notebooks, etc.)
- Uses internal fetch to `/api/*` endpoints

**Plugin Entry (`src/index.ts`)**
- Extends Siyuan `Plugin` class
- Manages settings UI with persistence per-device (using system ID suffix)
- Creates history tab using Vue 3 + Element Plus

### Key Patterns

- **Path alias**: `@/` resolves to `src/`
- **i18n**: Use `lang("key")` from `src/utils/lang.ts`; translations in `src/i18n/{en_US,zh_CN}.json`
- **Static prompts**: Markdown files in `static/` are imported as raw strings via raw-loader
- **Settings persistence**: Settings keyed by `"SETTINGS_" + device_id_suffix` to support different configs per device

### Authentication Flow (`src/utils/cloudflareAccess.ts`)

1. Check for `Cf-Access-Jwt-Assertion` header (Cloudflare Access)
2. Check Bearer token - if JWT-like, validate as Cloudflare Linked App OAuth
3. Fall back to local Bearer token validation (SHA-256 hash comparison)
4. JWKS and validated tokens are cached for performance

### Build Configuration

- Target: `electron-renderer` (runs inside Siyuan's Electron environment)
- Externals: `siyuan` module is external (provided by runtime)
- Vue 3 SFC support via vue-loader
- SCSS for styling (extracted to `index.css`)

## Important Types

```typescript
// MCP Tool definition (src/types/mcp.ts)
interface McpTool<T> {
    name: string;
    description: string;
    schema: Record<string, z.ZodType<any>>;  // Zod validators
    handler: (args: T, extra: any) => Promise<McpResponse>;
    annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
    };
}
```

## Adding a New Tool

1. Create or modify a provider in `src/tools/`
2. Implement `McpToolsProvider.getTools()` returning your tools
3. Add tool title translation keys to `src/i18n/*.json`
4. Use `getPluginInstance()` to access plugin settings
5. Use helper functions from `src/utils/mcpResponse.ts` for responses
