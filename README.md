# npm-context-agent-mcp

A Model Context Protocol (MCP) server that provides comprehensive contextual information about npm packages, including README files, versions, dependencies, download statistics, and more.

## 🚀 Features

### Core Capabilities

- **📦 Package Metadata** - Get detailed information about any npm package
- **📖 README Files** - Automatically fetches README from GitHub repositories with smart branch fallback
- **🔍 Package Search** - Search npm registry by keyword with customizable result limits
- **📋 Version History** - Get all available versions of a package with dist tags
- **🔗 Dependencies Info** - View dependencies, devDependencies, and peerDependencies
- **📊 Download Statistics** - Track package download trends (last day, week, or month)
- **ℹ️ Comprehensive Info** - Get full package metadata including keywords, license, maintainers

### Technical Features

- **🛡️ Type-safe validation** - Uses Zod for runtime schema validation
- **🏷️ Scoped package support** - Handles scoped packages like `@types/node`
- **🎯 Version support** - Fetch specific package versions for all operations
- **⚡ Smart branch fallback** - Automatically tries main → master → default branches
- **🔄 Error handling** - Graceful error handling with detailed error messages
- **🚀 Zero dependencies** - Lightweight implementation using native fetch API

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

### Quick Start Examples

**Get README for a package:**

```json
{ "packageName": "react" }
```

**Search for packages:**

```json
{ "query": "state management", "limit": 5 }
```

**Get all versions:**

```json
{ "packageName": "svelte" }
```

**Get dependencies:**

```json
{ "packageName": "@types/node", "version": "24.0.0" }
```

**Check download stats:**

```json
{ "packageName": "lodash", "period": "last-week" }
```

### Available Tools

| Tool                       | Description                    | Parameters                |
| -------------------------- | ------------------------------ | ------------------------- |
| `get_readme_data`          | Get package README from GitHub | `packageName`, `version?` |
| `search_packages`          | Search npm packages by keyword | `query`, `limit?`         |
| `get_package_versions`     | Get all versions of a package  | `packageName`             |
| `get_package_dependencies` | Get package dependencies       | `packageName`, `version?` |
| `get_download_stats`       | Get download statistics        | `packageName`, `period?`  |
| `get_package_info`         | Get comprehensive package info | `packageName`, `version?` |

#### `get_readme_data`

Retrieves package information and README content from npm packages.

**Parameters:**

- `packageName` (string, required): The name of the npm package
- `version` (string, optional): Specific version to fetch (defaults to latest)

**Example:**

```json
{
  "packageName": "zustand",
  "version": "5.0.0"
}
```

**Response:**
Returns package name, version, description, repository URL, and README content.

---

#### `search_packages`

Search npm registry for packages by keyword.

**Parameters:**

- `query` (string, required): Search keyword
- `limit` (number, optional): Maximum number of results (default: 20)

**Example:**

```json
{
  "query": "state management",
  "limit": 10
}
```

**Response:**
Returns matching packages with names, versions, descriptions, authors, and links.

---

#### `get_package_versions`

Get all available versions of a package.

**Parameters:**

- `packageName` (string, required): The name of the npm package

**Example:**

```json
{
  "packageName": "react"
}
```

**Response:**
Returns list of all versions, dist tags, and latest version.

---

#### `get_package_dependencies`

Get dependencies and devDependencies for a package.

**Parameters:**

- `packageName` (string, required): The name of the npm package
- `version` (string, optional): Specific version to fetch (defaults to latest)

**Example:**

```json
{
  "packageName": "@types/node",
  "version": "24.0.0"
}
```

**Response:**
Returns dependencies, devDependencies, and peerDependencies for the specified version.

---

#### `get_download_stats`

Get download statistics from npm.

**Parameters:**

- `packageName` (string, required): The name of the npm package
- `period` (string, optional): Time period - "last-day", "last-week", or "last-month" (default: "last-month")

**Example:**

```json
{
  "packageName": "lodash",
  "period": "last-week"
}
```

**Response:**
Returns download counts and date range for the specified period.

---

#### `get_package_info`

Get comprehensive package metadata.

**Parameters:**

- `packageName` (string, required): The name of the npm package
- `version` (string, optional): Specific version to fetch (defaults to all versions)

**Example:**

```json
{
  "packageName": "express",
  "version": "4.18.0"
}
```

**Response:**
Returns comprehensive package information including keywords, license, maintainers, and repository details.

---

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
3. For README fetching: Extracts the GitHub repository URL and fetches README with branch fallback
4. Returns formatted, structured data

### API Endpoints Used

- **npm Registry API**: `https://registry.npmjs.org/` - Package metadata, versions, dependencies
- **npm Search API**: `https://registry.npmjs.org/-/v1/search` - Package search functionality
- **npm Downloads API**: `https://api.npmjs.org/downloads/point/` - Download statistics
- **GitHub Raw Content**: `https://raw.githubusercontent.com/` - README file fetching

### Data Flow

```
Client Request → MCP Server → npm Registry API
                                 ↓
                           Validation (Zod)
                                 ↓
                           GitHub API (for README)
                                 ↓
                            Formatted Response
```

### Error Handling

The server implements comprehensive error handling:

- HTTP errors from npm registry
- Invalid response structures
- GitHub README fetch failures with branch fallback
- Network errors
- Scoped package handling

All errors are returned with descriptive messages and proper error flags.

### README Fetching with Branch Fallback

The server intelligently fetches README files by trying multiple branches in order:

1. Try `main` branch
2. Try `master` branch
3. Try default branch (no branch specification)

This ensures maximum compatibility across different repository configurations.

## 🔒 Type Safety

The project uses Zod for runtime validation across all tools:

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

This ensures type safety and prevents runtime errors from unexpected API responses across all API endpoints.

## 📦 Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for server implementation
- `zod` - Runtime type validation

## 🔧 Supported Package Types

- Regular packages: `lodash`, `express`, `react`
- Scoped packages: `@types/node`, `@babel/core`, `@angular/core`
- Specific versions: All endpoints support optional version parameters

## 📝 Version History

### Version 1.0.0 (Current)

**Initial Release** - Complete npm context agent MCP server

**Features:**

- ✅ README fetching with branch fallback
- ✅ Package search functionality
- ✅ Version history retrieval
- ✅ Dependencies analysis
- ✅ Download statistics
- ✅ Comprehensive package info
- ✅ Scoped package support
- ✅ Version-specific queries
- ✅ Zod schema validation
- ✅ Comprehensive error handling

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by the npm registry API
- README content sourced from GitHub
