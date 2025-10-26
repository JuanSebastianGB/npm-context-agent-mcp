# npm-context-agent-mcp

A Model Context Protocol (MCP) server that provides contextual information about npm packages, including README files directly from their GitHub repositories.

## 🚀 Features

- **Fetch npm package metadata** - Get detailed information about any npm package
- **Retrieve README files** - Automatically fetches README from GitHub repositories
- **Type-safe validation** - Uses Zod for runtime schema validation
- **Error handling** - Graceful error handling with detailed error messages
- **Zero dependencies** - Lightweight implementation using native fetch API

## 📋 Requirements

- Node.js 18+ (works with Node.js 20+ recommended)
- pnpm 10.19.0+

## 🛠️ Installation

### From npm (when published)

```bash
npm install -g npm-context-agent-mcp
```

### From source

```bash
git clone <repository-url>
cd npm-context-agent-mcp
pnpm install
pnpm build
```

## 🎯 Usage

### As an MCP Server

This server implements the Model Context Protocol and can be used with MCP-compatible clients.

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "npm-context-agent": {
      "command": "node",
      "args": ["path/to/npm-context-agent-mcp/build/index.js"]
    }
  }
}
```

### Available Tools

#### `get_readme_data`

Retrieves package information and README content from npm packages.

**Parameters:**

- `packageName` (string): The name of the npm package

**Example:**

```json
{
  "packageName": "zustand"
}
```

**Response:**
Returns package name, version, description, repository URL, and README content.

## 🏗️ Development

### Project Structure

```
npm-context-agent-mcp/
├── src/
│   └── index.ts          # Main MCP server implementation
├── build/                # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts

- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm inspect` - Run MCP inspector for testing

### Building

```bash
pnpm build
```

The build process compiles TypeScript and makes the output executable.

### Testing with MCP Inspector

```bash
pnpm inspect
```

This runs the MCP inspector which allows you to test the server interactively.

## 🏛️ Architecture

### MCP Server Implementation

The server uses the `@modelcontextprotocol/sdk` to create a standardized MCP server that:

1. Fetches package metadata from the npm registry API
2. Validates the response structure using Zod schemas
3. Extracts the GitHub repository URL
4. Constructs the raw GitHub README URL
5. Fetches and returns the README content

### Data Flow

```
Client Request → MCP Server → npm Registry API
                                 ↓
                           Validation (Zod)
                                 ↓
                           GitHub API
                                 ↓
                            Response
```

### Error Handling

The server implements comprehensive error handling:

- HTTP errors from npm registry
- Invalid response structures
- GitHub README fetch failures
- Network errors

All errors are returned with descriptive messages and proper error flags.

## 🔒 Type Safety

The project uses Zod for runtime validation:

```typescript
const NpmRegistryResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  repository: z.object({
    type: z.string(),
    url: z.string(),
  }),
});
```

This ensures type safety and prevents runtime errors from unexpected API responses.

## 📦 Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for server implementation
- `zod` - Runtime type validation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by the npm registry API
- README content sourced from GitHub
