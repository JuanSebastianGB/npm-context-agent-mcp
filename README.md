# npm-context-agent-mcp

A Model Context Protocol (MCP) server that provides comprehensive contextual information about npm packages, including README files, versions, dependencies, download statistics, and more.

<a href="https://glama.ai/mcp/servers/@JuanSebastianGB/npm-context-agent-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@JuanSebastianGB/npm-context-agent-mcp/badge" alt="NPM Context Agent MCP server" />
</a>

## 🚀 Features

### Core Capabilities

- **📦 Package Metadata** - Get detailed information about any npm package
- **📖 README Files** - Automatically fetches README from GitHub repositories with smart branch fallback
- **🔍 Package Search** - Search npm registry by keyword with customizable result limits
- **📋 Version History** - Get all available versions of a package with dist tags
- **🔗 Dependencies Info** - View dependencies, devDependencies, and peerDependencies
- **📊 Download Statistics** - Track package download trends (last day, week, or month)
- **ℹ️ Comprehensive Info** - Get full package metadata including keywords, license, maintainers
- **🔀 Package Comparison** - Compare two packages side-by-side
- **📦 Bundle Size** - Get package bundle size information from bundlephobia
- **⭐ Quality Metrics** - Get quality scores from npms.io

### MCP Resources

Resources provide application-driven data access:

- **package://{packageName}** - Package metadata as JSON resource
- **package://{packageName}/readme** - README content as markdown resource
- **package://{packageName}/dependencies** - Dependencies as JSON resource
- **package://{packageName}/versions** - Version history as JSON resource

### MCP Prompts

Ready-to-use prompt templates:

- **analyze-package** - Comprehensive package analysis prompt
- **compare-packages** - Compare two packages prompt
- **find-alternatives** - Find alternative packages prompt

### Transport Support

- **stdio Transport** - Traditional stdio-based communication (default)
- **HTTP Transport** - HTTP-based communication for remote access
- **Dual Mode** - Support both transports simultaneously

### Technical Features

- **🛡️ Type-safe validation** - Uses Zod for runtime schema validation
- **🏷️ Scoped package support** - Handles scoped packages like `@types/node`
- **🎯 Version support** - Fetch specific package versions for all operations
- **⚡ Smart branch fallback** - Automatically tries main → master → default branches
- **🔄 Error handling** - Graceful error handling with detailed error messages
- **📤 Structured output** - All tools return structured JSON for programmatic access
- **🎨 Modern MCP SDK** - Uses latest MCP SDK v1.20.2 with resources and prompts
- **🌐 HTTP & stdio** - Choose your transport mode based on your needs

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

#### Stdio Transport (Default)

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

#### HTTP Transport

To use HTTP transport, set the environment variable before starting:

```bash
export TRANSPORT_MODE=http
export PORT=3000  # optional, defaults to 3000
node build/index.js
```

Then connect to `http://localhost:3000/mcp` from your MCP client.

#### Dual Mode

To run both stdio and HTTP transports simultaneously:

```bash
export TRANSPORT_MODE=both
node build/index.js
```

**Environment Variables:**

- `TRANSPORT_MODE` - Transport mode: `stdio` (default), `http`, or `both`
- `PORT` - HTTP server port (default: 3000, only used for http/both modes)

### Quick Start Examples

**Tools:**

Get README for a package:

```json
{ "packageName": "react" }
```

Search for packages:

```json
{ "query": "state management", "limit": 5 }
```

Get all versions:

```json
{ "packageName": "svelte" }
```

Get dependencies:

```json
{ "packageName": "@types/node", "version": "24.0.0" }
```

Check download stats:

```json
{ "packageName": "lodash", "period": "last-week" }
```

Compare packages:

```json
{ "packageName1": "express", "packageName2": "fastify" }
```

Get bundle size:

```json
{ "packageName": "lodash", "version": "4.17.21" }
```

Get quality metrics:

```json
{ "packageName": "react" }
```

**Resources:**

Read package metadata:

```
package://react
```

Read package README:

```
package://react/readme
```

Read package dependencies:

```
package://react/dependencies
```

Read version history:

```
package://react/versions
```

**Prompts:**

Analyze a package:

```json
{ "packageName": "express" }
```

Compare two packages:

```json
{ "packageName1": "vue", "packageName2": "react" }
```

Find alternatives:

```json
{ "packageName": "lodash", "useCase": "utility functions" }
```

### Available Tools

| Tool                       | Description                       | Parameters                     |
| -------------------------- | --------------------------------- | ------------------------------ |
| `get_readme_data`          | Get package README from GitHub    | `packageName`, `version?`      |
| `search_packages`          | Search npm packages by keyword    | `query`, `limit?`              |
| `get_package_versions`     | Get all versions of a package     | `packageName`                  |
| `get_package_dependencies` | Get package dependencies          | `packageName`, `version?`      |
| `get_download_stats`       | Get download statistics           | `packageName`, `period?`       |
| `get_package_info`         | Get comprehensive package info    | `packageName`, `version?`      |
| `compare_packages`         | Compare two packages side-by-side | `packageName1`, `packageName2` |
| `get_package_size`         | Get bundle size information       | `packageName`, `version?`      |
| `get_package_quality`      | Get quality metrics from npms.io  | `packageName`                  |

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

#### `compare_packages`

Compare two packages side-by-side with detailed metrics.

**Parameters:**

- `packageName1` (string, required): First package to compare
- `packageName2` (string, required): Second package to compare

**Example:**

```json
{
  "packageName1": "express",
  "packageName2": "fastify"
}
```

**Response:**
Returns side-by-side comparison including versions, descriptions, download statistics, maintainers, and keywords.

---

#### `get_package_size`

Get bundle size information for a package from bundlephobia.

**Parameters:**

- `packageName` (string, required): The name of the npm package
- `version` (string, optional): Specific version to check (defaults to latest)

**Example:**

```json
{
  "packageName": "lodash",
  "version": "4.17.21"
}
```

**Response:**
Returns minified size, gzipped size, and dependency count.

---

#### `get_package_quality`

Get quality metrics from npms.io for a package.

**Parameters:**

- `packageName` (string, required): The name of the npm package

**Example:**

```json
{
  "packageName": "react"
}
```

**Response:**
Returns quality score, popularity score, and maintenance score.

---

### Available Resources

| Resource                               | Description             | MIME Type          |
| -------------------------------------- | ----------------------- | ------------------ |
| `package://{packageName}`              | Package metadata        | `application/json` |
| `package://{packageName}/readme`       | Package README content  | `text/markdown`    |
| `package://{packageName}/dependencies` | Package dependencies    | `application/json` |
| `package://{packageName}/versions`     | Package version history | `application/json` |

### Available Prompts

| Prompt              | Description                       | Arguments                      |
| ------------------- | --------------------------------- | ------------------------------ |
| `analyze-package`   | Comprehensive package analysis    | `packageName`                  |
| `compare-packages`  | Compare two packages              | `packageName1`, `packageName2` |
| `find-alternatives` | Find alternative packages         | `packageName`, `useCase?`      |

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

The server uses the `@modelcontextprotocol/sdk` v1.20.2 to create a standardized MCP server that:

1. Fetches package metadata from various npm APIs
2. Validates all responses using Zod schemas
3. For README fetching: Extracts the GitHub repository URL and fetches README with branch fallback
4. Returns formatted, structured data with both text and JSON output
5. Supports Resources for application-driven data access
6. Supports Prompts for reusable analysis templates
7. Provides multiple transport options (stdio, HTTP, or both)

### API Endpoints Used

- **npm Registry API**: `https://registry.npmjs.org/` - Package metadata, versions, dependencies
- **npm Search API**: `https://registry.npmjs.org/-/v1/search` - Package search functionality
- **npm Downloads API**: `https://api.npmjs.org/downloads/point/` - Download statistics
- **GitHub Raw Content**: `https://raw.githubusercontent.com/` - README file fetching
- **Bundlephobia API**: `https://bundlephobia.com/api/size` - Bundle size information
- **npms.io API**: `https://api.npms.io/v2/package/` - Quality metrics

### Data Flow

```
Client Request → MCP Server → Multiple APIs (npm, bundlephobia, npms.io, GitHub)
                                 ↓
                           Validation (Zod)
                                 ↓
                           Structured Response (Text + JSON)
```

### Error Handling

The server implements comprehensive error handling:

- HTTP errors from all APIs (npm registry, bundlephobia, npms.io, GitHub)
- Invalid response structures
- GitHub README fetch failures with branch fallback
- Network errors and timeouts
- Scoped package handling
- Missing package or version errors

All errors are returned with descriptive messages and proper error flags in both text and structured formats.

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
- `express` - HTTP server for HTTP transport mode

## 🔧 Supported Package Types

- Regular packages: `lodash`, `express`, `react`
- Scoped packages: `@types/node`, `@babel/core`, `@angular/core`
- Specific versions: All endpoints support optional version parameters

## 📝 Version History

### Version 2.0.0 (Current)

**Major Update** - MCP SDK modernization and new features

**New Features:**

- ✅ MCP Resources support (4 resources)
- ✅ MCP Prompts support (3 prompts)
- ✅ HTTP transport mode
- ✅ Dual transport mode (stdio + HTTP)
- ✅ Package comparison tool
- ✅ Bundle size tool (bundlephobia integration)
- ✅ Quality metrics (npms.io integration)
- ✅ Structured output for all tools
- ✅ Modern SDK v1.20.2 with registerTool/Resource/Prompt APIs

**Improvements:**

- ✅ All tools migrated to `registerTool()` API
- ✅ All tools return structured content
- ✅ Better error handling and type safety
- ✅ Enhanced documentation

**Note:**

- Removed security checking tool due to unavailable public API for vulnerability data

### Version 1.0.0

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

MIT License

Copyright (c) 2025 Juan Sebastian Gonzalez

See [LICENSE.md](LICENSE.md) for full license text.

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by the npm registry API
- README content sourced from GitHub
- Quality metrics provided by [npms.io](https://npms.io/)
- Bundle size data from [Bundlephobia](https://bundlephobia.com/)
