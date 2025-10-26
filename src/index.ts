import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Zod schemas for npm registry response validation
const NpmRegistryResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  repository: z.object({
    type: z.string(),
    url: z.string(),
  }),
});

const server = new McpServer({
  name: "npm-context-agent-mcp",
  version: "1.0.0",
  description: "A MCP server for the npm context agent",
});

server.tool(
  "get_readme_data",
  "Get Data from readme file of a package",
  {
    packageName: z.string(),
  },
  async ({ packageName }) => {
    try {
      // Fetch package metadata from npm registry
      const response = await fetch(
        `https://registry.npmjs.org/${packageName}/latest`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch package: ${response.statusText}`);
      }

      const rawData = await response.json();

      // Validate response structure with Zod
      const parseResult = NpmRegistryResponseSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid package data structure: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;
      const { url: repositoryUrl } = data.repository;

      const githubUrl = new URL(repositoryUrl.replace("git+", ""));
      const repositoryPath = githubUrl.pathname
        .substring(1)
        .replace(".git", "");

      const readmeUrl = `https://raw.githubusercontent.com/${repositoryPath}/refs/heads/main/README.md`;

      const readmeResponse = await fetch(readmeUrl);

      if (!readmeResponse.ok) {
        throw new Error(`Failed to fetch README: ${readmeResponse.statusText}`);
      }

      const readme = await readmeResponse.text();
      return {
        content: [
          {
            type: "text",
            text: `Package: ${data.name}\nVersion: ${
              data.version
            }\nDescription: ${
              data.description || "N/A"
            }\nRepository: ${repositoryUrl}\n\nREADME:\n${readme}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching package ${packageName}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("npm-context-agent-mcp server started");
};

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
