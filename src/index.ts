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

const PackageSearchSchema = z.object({
  objects: z.array(
    z.object({
      package: z.object({
        name: z.string(),
        version: z.string(),
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        author: z
          .object({
            name: z.string().optional(),
            email: z.string().optional(),
          })
          .optional(),
        links: z
          .object({
            npm: z.string().optional(),
            homepage: z.string().optional(),
            repository: z.string().optional(),
          })
          .optional(),
      }),
    })
  ),
  total: z.number(),
});

const PackageVersionSchema = z.object({
  name: z.string(),
  versions: z.record(
    z.string(),
    z.object({
      version: z.string(),
      publish_time: z.string().optional(),
    })
  ),
  "dist-tags": z.record(z.string(), z.string()),
});

const PackageDependenciesSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
});

const DownloadStatsSchema = z.object({
  downloads: z.number(),
  start: z.string(),
  end: z.string(),
  package: z.string(),
});

const PackageInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  "dist-tags": z.record(z.string(), z.string()),
  versions: z.record(
    z.string(),
    z.object({
      name: z.string(),
      version: z.string(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      license: z.string().optional(),
      author: z.any().optional(),
      maintainers: z.array(z.any()).optional(),
      repository: z
        .object({
          type: z.string(),
          url: z.string(),
        })
        .optional(),
      dependencies: z.record(z.string(), z.string()).optional(),
      homepage: z.string().optional(),
    })
  ),
  time: z.record(z.string(), z.string()),
  license: z.string().optional(),
  readme: z.string().optional(),
});

const server = new McpServer({
  name: "npm-context-agent-mcp",
  version: "1.0.0",
  description: "A MCP server for the npm context agent",
});

// Helper function to fetch README from GitHub with branch fallback
async function fetchReadmeFromGitHub(repositoryUrl: string): Promise<string> {
  const githubUrl = new URL(repositoryUrl.replace("git+", ""));
  const repositoryPath = githubUrl.pathname.substring(1).replace(".git", "");

  // Try branches in order: main, master, default
  const branches = ["main", "master"];

  for (const branch of branches) {
    const readmeUrl = `https://raw.githubusercontent.com/${repositoryPath}/refs/heads/${branch}/README.md`;
    const readmeResponse = await fetch(readmeUrl);

    if (readmeResponse.ok) {
      return await readmeResponse.text();
    }
  }

  // If both branches fail, try without branch specification (will return default branch)
  const defaultReadmeUrl = `https://raw.githubusercontent.com/${repositoryPath}/README.md`;
  const defaultResponse = await fetch(defaultReadmeUrl);

  if (defaultResponse.ok) {
    return await defaultResponse.text();
  }

  throw new Error("README not found in main, master, or default branch");
}

// Tool: Get README data with version support
server.tool(
  "get_readme_data",
  "Get Data from readme file of a package",
  {
    packageName: z.string(),
    version: z.string().optional(),
  },
  async ({ packageName, version }) => {
    try {
      const versionPath = version || "latest";
      const encodedPackageName = encodeURIComponent(packageName);
      const response = await fetch(
        `https://registry.npmjs.org/${encodedPackageName}/${versionPath}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch package ${packageName}: ${response.statusText}`
        );
      }

      const rawData = await response.json();

      const parseResult = NpmRegistryResponseSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid package data structure: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;
      const { url: repositoryUrl } = data.repository;

      const readme = await fetchReadmeFromGitHub(repositoryUrl);

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

// Tool: Search packages
server.tool(
  "search_packages",
  "Search npm registry for packages by keyword",
  {
    query: z.string(),
    limit: z.number().optional(),
  },
  async ({ query, limit = 20 }) => {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodedQuery}&size=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to search packages: ${response.statusText}`);
      }

      const rawData = await response.json();
      const parseResult = PackageSearchSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid search results structure: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;
      const packages = data.objects.map((obj) => obj.package);

      const formattedResults = packages
        .map(
          (pkg) =>
            `Name: ${pkg.name}\nVersion: ${pkg.version}\nDescription: ${
              pkg.description || "N/A"
            }\n${pkg.author ? `Author: ${pkg.author.name || "N/A"}\n` : ""}${
              pkg.links?.npm ? `NPM: ${pkg.links.npm}\n` : ""
            }---`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${data.total} packages (showing ${packages.length}):\n\n${formattedResults}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching packages: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get package versions
server.tool(
  "get_package_versions",
  "Get all available versions of a package",
  {
    packageName: z.string(),
  },
  async ({ packageName }) => {
    try {
      const encodedPackageName = encodeURIComponent(packageName);
      const response = await fetch(
        `https://registry.npmjs.org/${encodedPackageName}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch package versions: ${response.statusText}`
        );
      }

      const rawData = await response.json();
      const parseResult = PackageVersionSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid package versions structure: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;
      const versions = Object.keys(data.versions);
      const latest = data["dist-tags"].latest;
      const tags = Object.entries(data["dist-tags"])
        .map(([tag, version]) => `${tag}: ${version}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Package: ${
              data.name
            }\n\nLatest version: ${latest}\n\nDist tags:\n${tags}\n\nAll versions (${
              versions.length
            }):\n${versions.join(", ")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching package versions: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get package dependencies
server.tool(
  "get_package_dependencies",
  "Get dependencies and devDependencies for a package",
  {
    packageName: z.string(),
    version: z.string().optional(),
  },
  async ({ packageName, version }) => {
    try {
      const versionPath = version || "latest";
      const encodedPackageName = encodeURIComponent(packageName);
      const response = await fetch(
        `https://registry.npmjs.org/${encodedPackageName}/${versionPath}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch package dependencies: ${response.statusText}`
        );
      }

      const rawData = await response.json();
      const parseResult = PackageDependenciesSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid package dependencies structure: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;

      const formatDeps = (deps: Record<string, string> | undefined) => {
        if (!deps) return "None";
        return Object.entries(deps)
          .map(([name, version]) => `  ${name}: ${version}`)
          .join("\n");
      };

      return {
        content: [
          {
            type: "text",
            text: `Package: ${data.name}\nVersion: ${
              data.version
            }\n\nDependencies:\n${formatDeps(
              data.dependencies
            )}\n\nDev Dependencies:\n${formatDeps(
              data.devDependencies
            )}\n\nPeer Dependencies:\n${formatDeps(data.peerDependencies)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching package dependencies: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get download stats
server.tool(
  "get_download_stats",
  "Get download statistics from npm",
  {
    packageName: z.string(),
    period: z.enum(["last-day", "last-week", "last-month"]).optional(),
  },
  async ({ packageName, period = "last-month" }) => {
    try {
      const encodedPackageName = encodeURIComponent(packageName);
      const response = await fetch(
        `https://api.npmjs.org/downloads/point/${period}/${encodedPackageName}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch download stats: ${response.statusText}`
        );
      }

      const rawData = await response.json();
      const parseResult = DownloadStatsSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid download stats structure: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;

      return {
        content: [
          {
            type: "text",
            text: `Package: ${
              data.package
            }\nDownloads (${period}): ${data.downloads.toLocaleString()}\nPeriod: ${
              data.start
            } to ${data.end}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching download stats: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get comprehensive package info
server.tool(
  "get_package_info",
  "Get comprehensive package metadata",
  {
    packageName: z.string(),
    version: z.string().optional(),
  },
  async ({ packageName, version }) => {
    try {
      const encodedPackageName = encodeURIComponent(packageName);
      const response = await fetch(
        `https://registry.npmjs.org/${encodedPackageName}${
          version ? `/${version}` : ""
        }`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch package info: ${response.statusText}`);
      }

      const rawData = await response.json();

      let formattedInfo = "";

      if (version) {
        // Single version info
        const versionData = rawData.versions?.[version];
        if (versionData) {
          formattedInfo = `Package: ${versionData.name}\nVersion: ${
            versionData.version
          }\nDescription: ${versionData.description || "N/A"}\nLicense: ${
            versionData.license || "N/A"
          }\nHomepage: ${versionData.homepage || "N/A"}\n\nKeywords: ${
            versionData.keywords?.join(", ") || "None"
          }\n\nAuthor: ${JSON.stringify(
            versionData.author || "N/A"
          )}\n\nRepository: ${versionData.repository?.url || "N/A"}`;
        }
      } else {
        // Full package info
        const parseResult = PackageInfoSchema.safeParse(rawData);

        if (!parseResult.success) {
          throw new Error(
            `Invalid package info structure: ${parseResult.error.message}`
          );
        }

        const data = parseResult.data;
        const latestVersion = data["dist-tags"].latest;
        const latestData = data.versions[latestVersion];

        formattedInfo = `Package: ${
          data.name
        }\nLatest Version: ${latestVersion}\nDescription: ${
          data.description || "N/A"
        }\nLicense: ${data.license || "N/A"}\n\nKeywords: ${
          latestData.keywords?.join(", ") || "None"
        }\n\nMaintainers: ${
          latestData.maintainers?.map((m: any) => m.name).join(", ") || "N/A"
        }\n\nTotal Versions: ${
          Object.keys(data.versions).length
        }\nDist Tags: ${Object.keys(data["dist-tags"]).join(", ")}`;
      }

      return {
        content: [
          {
            type: "text",
            text: formattedInfo,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching package info: ${
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
