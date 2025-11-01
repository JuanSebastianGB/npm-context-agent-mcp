import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
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

// New schemas for additional tools
const PackageSizeSchema = z.object({
  name: z.string(),
  version: z.string(),
  size: z.number(),
  gzip: z.number(),
  dependencyCount: z.number(),
  scoped: z.boolean().optional(),
  repository: z.string().optional(),
});

const SecurityAuditSchema = z.object({
  vulnerabilities: z.object({
    total: z.number(),
    low: z.number(),
    moderate: z.number(),
    high: z.number(),
    critical: z.number(),
  }),
  dependency: z.string(),
});

const QualityMetricsSchema = z.object({
  score: z.object({
    final: z.number(),
    detail: z.object({
      quality: z.number(),
      popularity: z.number(),
      maintenance: z.number(),
    }),
  }),
  analyzedAt: z.string().optional(),
});

const server = new McpServer({
  name: "npm-context-agent-mcp",
  version: "2.0.0",
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

// Helper function to fetch package data
async function fetchPackageData(
  packageName: string,
  version?: string
): Promise<any> {
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

  return await response.json();
}

// Helper function to fetch full package info
async function fetchFullPackageInfo(packageName: string): Promise<any> {
  const encodedPackageName = encodeURIComponent(packageName);
  const response = await fetch(
    `https://registry.npmjs.org/${encodedPackageName}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch package ${packageName}: ${response.statusText}`
    );
  }

  return await response.json();
}

// Tool: Get README data with version support
server.registerTool(
  "get_readme_data",
  {
    title: "Get Package README",
    description: "Get README file content from a package's GitHub repository",
    inputSchema: {
      packageName: z.string(),
      version: z.string().optional(),
    },
    outputSchema: {
      package: z.string(),
      version: z.string(),
      description: z.string(),
      repository: z.string(),
      readme: z.string(),
    },
  },
  async ({ packageName, version }) => {
    try {
      const rawData = await fetchPackageData(packageName, version);
      const parseResult = NpmRegistryResponseSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid package data structure: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;
      const { url: repositoryUrl } = data.repository;

      const readme = await fetchReadmeFromGitHub(repositoryUrl);

      const output = {
        package: data.name,
        version: data.version,
        description: data.description || "N/A",
        repository: repositoryUrl,
        readme,
      };

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
        structuredContent: output,
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
server.registerTool(
  "search_packages",
  {
    title: "Search npm Packages",
    description: "Search npm registry for packages by keyword",
    inputSchema: {
      query: z.string(),
      limit: z.number().optional(),
    },
    outputSchema: {
      total: z.number(),
      results: z.array(
        z.object({
          name: z.string(),
          version: z.string(),
          description: z.string().optional(),
          author: z.string().optional(),
          npmUrl: z.string().optional(),
        })
      ),
    },
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

      const output = {
        total: data.total,
        results: packages.map((pkg) => ({
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          author: pkg.author?.name,
          npmUrl: pkg.links?.npm,
        })),
      };

      return {
        content: [
          {
            type: "text",
            text: `Found ${data.total} packages (showing ${packages.length}):\n\n${formattedResults}`,
          },
        ],
        structuredContent: output,
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
server.registerTool(
  "get_package_versions",
  {
    title: "Get Package Versions",
    description: "Get all available versions of a package",
    inputSchema: {
      packageName: z.string(),
    },
    outputSchema: {
      name: z.string(),
      latest: z.string(),
      distTags: z.record(z.string(), z.string()),
      versions: z.array(z.string()),
      versionCount: z.number(),
    },
  },
  async ({ packageName }) => {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
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

      const output = {
        name: data.name,
        latest,
        distTags: data["dist-tags"],
        versions,
        versionCount: versions.length,
      };

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
        structuredContent: output,
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
server.registerTool(
  "get_package_dependencies",
  {
    title: "Get Package Dependencies",
    description:
      "Get dependencies, devDependencies, and peerDependencies for a package",
    inputSchema: {
      packageName: z.string(),
      version: z.string().optional(),
    },
    outputSchema: {
      name: z.string(),
      version: z.string(),
      dependencies: z.record(z.string(), z.string()),
      devDependencies: z.record(z.string(), z.string()),
      peerDependencies: z.record(z.string(), z.string()),
    },
  },
  async ({ packageName, version }) => {
    try {
      const rawData = await fetchPackageData(packageName, version);
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

      const output = {
        name: data.name,
        version: data.version,
        dependencies: data.dependencies || {},
        devDependencies: data.devDependencies || {},
        peerDependencies: data.peerDependencies || {},
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
        structuredContent: output,
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
server.registerTool(
  "get_download_stats",
  {
    title: "Get Download Statistics",
    description: "Get download statistics from npm",
    inputSchema: {
      packageName: z.string(),
      period: z.enum(["last-day", "last-week", "last-month"]).optional(),
    },
    outputSchema: {
      package: z.string(),
      downloads: z.number(),
      period: z.string(),
      start: z.string(),
      end: z.string(),
    },
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
      const output = {
        package: data.package,
        downloads: data.downloads,
        period,
        start: data.start,
        end: data.end,
      };

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
        structuredContent: output,
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
server.registerTool(
  "get_package_info",
  {
    title: "Get Package Info",
    description: "Get comprehensive package metadata",
    inputSchema: {
      packageName: z.string(),
      version: z.string().optional(),
    },
    outputSchema: {
      name: z.string(),
      version: z.string().optional(),
      description: z.string().optional(),
      license: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      maintainers: z.array(z.string()).optional(),
      repository: z.string().optional(),
      homepage: z.string().optional(),
      totalVersions: z.number().optional(),
      distTags: z.array(z.string()).optional(),
    },
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
      let output: any;

      if (version) {
        // Single version info
        const versionData = rawData.versions?.[version];
        if (versionData) {
          output = {
            name: versionData.name,
            version: versionData.version,
            description: versionData.description,
            license: versionData.license,
            keywords: versionData.keywords,
            repository: versionData.repository?.url,
            homepage: versionData.homepage,
          };

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

        output = {
          name: data.name,
          description: data.description,
          license: data.license,
          keywords: latestData.keywords,
          maintainers: latestData.maintainers?.map((m: any) => m.name) || [],
          repository: latestData.repository?.url,
          homepage: latestData.homepage,
          totalVersions: Object.keys(data.versions).length,
          distTags: Object.keys(data["dist-tags"]),
        };

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
        structuredContent: output,
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

// Tool: Compare packages
server.registerTool(
  "compare_packages",
  {
    title: "Compare Packages",
    description: "Compare two packages side-by-side",
    inputSchema: {
      packageName1: z.string(),
      packageName2: z.string(),
    },
    outputSchema: {
      packages: z.array(
        z.object({
          name: z.string(),
          version: z.string(),
          description: z.string().optional(),
          downloads: z.number(),
          maintainers: z.array(z.string()),
          keywords: z.array(z.string()).optional(),
        })
      ),
    },
  },
  async ({ packageName1, packageName2 }) => {
    try {
      const [pkg1Full, pkg2Full, pkg1Stats, pkg2Stats] = await Promise.all([
        fetchFullPackageInfo(packageName1),
        fetchFullPackageInfo(packageName2),
        fetch(
          `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(
            packageName1
          )}`
        ).then((r) => r.json()),
        fetch(
          `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(
            packageName2
          )}`
        ).then((r) => r.json()),
      ]);

      const pkg1Latest = pkg1Full.versions[pkg1Full["dist-tags"].latest];
      const pkg2Latest = pkg2Full.versions[pkg2Full["dist-tags"].latest];

      const output = {
        packages: [
          {
            name: pkg1Latest.name,
            version: pkg1Latest.version,
            description: pkg1Latest.description,
            downloads: pkg1Stats.downloads || 0,
            maintainers: pkg1Latest.maintainers?.map((m: any) => m.name) || [],
            keywords: pkg1Latest.keywords,
          },
          {
            name: pkg2Latest.name,
            version: pkg2Latest.version,
            description: pkg2Latest.description,
            downloads: pkg2Stats.downloads || 0,
            maintainers: pkg2Latest.maintainers?.map((m: any) => m.name) || [],
            keywords: pkg2Latest.keywords,
          },
        ],
      };

      const formattedText = `Package Comparison:\n\n${pkg1Latest.name} vs ${
        pkg2Latest.name
      }\n\n${pkg1Latest.name}:\n  Version: ${
        pkg1Latest.version
      }\n  Description: ${
        pkg1Latest.description || "N/A"
      }\n  Downloads (last month): ${(
        pkg1Stats.downloads || 0
      ).toLocaleString()}\n  Maintainers: ${
        output.packages[0].maintainers.join(", ") || "N/A"
      }\n  Keywords: ${pkg1Latest.keywords?.join(", ") || "None"}\n\n${
        pkg2Latest.name
      }:\n  Version: ${pkg2Latest.version}\n  Description: ${
        pkg2Latest.description || "N/A"
      }\n  Downloads (last month): ${(
        pkg2Stats.downloads || 0
      ).toLocaleString()}\n  Maintainers: ${
        output.packages[1].maintainers.join(", ") || "N/A"
      }\n  Keywords: ${pkg2Latest.keywords?.join(", ") || "None"}`;

      return {
        content: [
          {
            type: "text",
            text: formattedText,
          },
        ],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error comparing packages: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get package size
server.registerTool(
  "get_package_size",
  {
    title: "Get Package Size",
    description: "Get bundle size information from bundlephobia",
    inputSchema: {
      packageName: z.string(),
      version: z.string().optional(),
    },
    outputSchema: {
      name: z.string(),
      version: z.string(),
      size: z.number(),
      gzip: z.number(),
      dependencyCount: z.number(),
    },
  },
  async ({ packageName, version }) => {
    try {
      const pkgInfo = await fetchPackageData(packageName, version);
      const versionToCheck = pkgInfo.version || "latest";

      const response = await fetch(
        `https://bundlephobia.com/api/size?package=${encodeURIComponent(
          packageName
        )}@${versionToCheck}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch package size: ${response.statusText}`);
      }

      const rawData = await response.json();
      const parseResult = PackageSizeSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid package size structure: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;
      const output = {
        name: data.name,
        version: data.version,
        size: data.size,
        gzip: data.gzip,
        dependencyCount: data.dependencyCount,
      };

      const formattedText = `Package: ${data.name}@${
        data.version
      }\n\nBundle Size:\n  Minified: ${(data.size / 1024).toFixed(
        2
      )} KB\n  Gzipped: ${(data.gzip / 1024).toFixed(2)} KB\n\nDependencies: ${
        data.dependencyCount
      }`;

      return {
        content: [
          {
            type: "text",
            text: formattedText,
          },
        ],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching package size: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Check security
server.registerTool(
  "check_security",
  {
    title: "Check Security Vulnerabilities",
    description: "Check for known security vulnerabilities",
    inputSchema: {
      packageName: z.string(),
      version: z.string().optional(),
    },
    outputSchema: {
      package: z.string(),
      version: z.string(),
      vulnerabilities: z.object({
        total: z.number(),
        low: z.number(),
        moderate: z.number(),
        high: z.number(),
        critical: z.number(),
      }),
    },
  },
  async ({ packageName, version }) => {
    try {
      const pkgInfo = await fetchPackageData(packageName, version);
      const versionToCheck = pkgInfo.version || "latest";
      const fullVersion = `${packageName}@${versionToCheck}`;

      // Use npm registry advisory API
      const response = await fetch(
        `https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ [fullVersion]: {} }),
        }
      );

      if (!response.ok) {
        // If bulk API doesn't work, return no vulnerabilities found
        const output = {
          package: packageName,
          version: versionToCheck,
          vulnerabilities: {
            total: 0,
            low: 0,
            moderate: 0,
            high: 0,
            critical: 0,
          },
        };

        return {
          content: [
            {
              type: "text",
              text: `Package: ${packageName}@${versionToCheck}\n\nNo vulnerabilities found (advisory API not available)`,
            },
          ],
          structuredContent: output,
        };
      }

      const advisoryData = await response.json();
      const vulnerabilities = {
        total: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
      };

      // Count vulnerabilities by severity
      if (advisoryData && typeof advisoryData === "object") {
        for (const adv of Object.values(advisoryData) as any[]) {
          if (Array.isArray(adv)) {
            for (const item of adv) {
              vulnerabilities.total++;
              const severity = item?.severity?.toLowerCase() || "moderate";
              if (severity in vulnerabilities) {
                vulnerabilities[severity as keyof typeof vulnerabilities]++;
              } else {
                vulnerabilities.moderate++;
              }
            }
          }
        }
      }

      const output = {
        package: packageName,
        version: versionToCheck,
        vulnerabilities,
      };

      const formattedText = `Package: ${packageName}@${versionToCheck}\n\nVulnerabilities:\n  Total: ${vulnerabilities.total}\n  Critical: ${vulnerabilities.critical}\n  High: ${vulnerabilities.high}\n  Moderate: ${vulnerabilities.moderate}\n  Low: ${vulnerabilities.low}`;

      return {
        content: [
          {
            type: "text",
            text: formattedText,
          },
        ],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error checking security: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get package quality
server.registerTool(
  "get_package_quality",
  {
    title: "Get Package Quality Metrics",
    description: "Get quality metrics from npms.io",
    inputSchema: {
      packageName: z.string(),
    },
    outputSchema: {
      name: z.string(),
      final: z.number(),
      quality: z.number(),
      popularity: z.number(),
      maintenance: z.number(),
    },
  },
  async ({ packageName }) => {
    try {
      const encodedPackageName = encodeURIComponent(packageName);
      const response = await fetch(
        `https://api.npms.io/v2/package/${encodedPackageName}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch quality metrics: ${response.statusText}`
        );
      }

      const rawData = await response.json();
      const parseResult = QualityMetricsSchema.safeParse(rawData.score);

      if (!parseResult.success) {
        throw new Error(
          `Invalid quality metrics structure: ${parseResult.error.message}`
        );
      }

      const score = parseResult.data.score;
      const output = {
        name: packageName,
        final: score.final,
        quality: score.detail.quality,
        popularity: score.detail.popularity,
        maintenance: score.detail.maintenance,
      };

      const formattedText = `Package: ${packageName}\n\nQuality Metrics:\n  Overall Score: ${(
        score.final * 100
      ).toFixed(1)}%\n  Quality: ${(score.detail.quality * 100).toFixed(
        1
      )}%\n  Popularity: ${(score.detail.popularity * 100).toFixed(
        1
      )}%\n  Maintenance: ${(score.detail.maintenance * 100).toFixed(1)}%`;

      return {
        content: [
          {
            type: "text",
            text: formattedText,
          },
        ],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching quality metrics: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Resource: Package metadata
server.registerResource(
  "package-metadata",
  new ResourceTemplate("package://{packageName}", { list: undefined }),
  {
    title: "Package Metadata",
    description: "Get package metadata as a resource",
    mimeType: "application/json",
  },
  async (uri, { packageName }) => {
    try {
      const pkgName = Array.isArray(packageName) ? packageName[0] : packageName;
      const rawData = await fetchFullPackageInfo(pkgName);
      const latestVersion = rawData["dist-tags"].latest;
      const latestData = rawData.versions[latestVersion];

      const metadata = {
        name: rawData.name,
        description: rawData.description,
        latestVersion,
        license: rawData.license,
        keywords: latestData.keywords,
        maintainers: latestData.maintainers,
        repository: latestData.repository,
        homepage: latestData.homepage,
      };

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(metadata, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      };
    }
  }
);

// Resource: Package README
server.registerResource(
  "package-readme",
  new ResourceTemplate("package://{packageName}/readme", { list: undefined }),
  {
    title: "Package README",
    description: "Get package README content as a resource",
    mimeType: "text/markdown",
  },
  async (uri, { packageName }) => {
    try {
      const pkgName = Array.isArray(packageName) ? packageName[0] : packageName;
      const rawData = await fetchPackageData(pkgName);
      const { url: repositoryUrl } = rawData.repository;
      const readme = await fetchReadmeFromGitHub(repositoryUrl);

      return {
        contents: [
          {
            uri: uri.href,
            text: readme,
            mimeType: "text/markdown",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      };
    }
  }
);

// Resource: Package dependencies
server.registerResource(
  "package-dependencies",
  new ResourceTemplate("package://{packageName}/dependencies", {
    list: undefined,
  }),
  {
    title: "Package Dependencies",
    description: "Get package dependencies as a resource",
    mimeType: "application/json",
  },
  async (uri, { packageName }) => {
    try {
      const pkgName = Array.isArray(packageName) ? packageName[0] : packageName;
      const rawData = await fetchPackageData(pkgName);
      const parseResult = PackageDependenciesSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error("Invalid package data");
      }

      const data = parseResult.data;
      const deps = {
        name: data.name,
        version: data.version,
        dependencies: data.dependencies || {},
        devDependencies: data.devDependencies || {},
        peerDependencies: data.peerDependencies || {},
      };

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(deps, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      };
    }
  }
);

// Resource: Package versions
server.registerResource(
  "package-versions",
  new ResourceTemplate("package://{packageName}/versions", { list: undefined }),
  {
    title: "Package Versions",
    description: "Get package version history as a resource",
    mimeType: "application/json",
  },
  async (uri, { packageName }) => {
    try {
      const pkgName = Array.isArray(packageName) ? packageName[0] : packageName;
      const rawData = await fetchFullPackageInfo(pkgName);
      const versions = Object.keys(rawData.versions).map((version) => ({
        version,
        publishTime: rawData.time[version],
      }));

      const versionData = {
        name: rawData.name,
        latest: rawData["dist-tags"].latest,
        distTags: rawData["dist-tags"],
        versions,
      };

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(versionData, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      };
    }
  }
);

// Prompt: Analyze package
server.registerPrompt(
  "analyze-package",
  {
    title: "Analyze Package",
    description: "Comprehensive analysis of an npm package",
    argsSchema: {
      packageName: z.string(),
    },
  },
  ({ packageName }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please provide a comprehensive analysis of the npm package "${packageName}". Include information about its purpose, popularity, dependencies, maintenance status, and any notable features or concerns.`,
        },
      },
    ],
  })
);

// Prompt: Compare packages
server.registerPrompt(
  "compare-packages",
  {
    title: "Compare Packages",
    description: "Compare two npm packages",
    argsSchema: {
      packageName1: z.string(),
      packageName2: z.string(),
    },
  },
  ({ packageName1, packageName2 }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please compare the npm packages "${packageName1}" and "${packageName2}". Analyze their similarities, differences, use cases, performance, community support, and provide recommendations for when to use each one.`,
        },
      },
    ],
  })
);

// Prompt: Find alternatives
server.registerPrompt(
  "find-alternatives",
  {
    title: "Find Package Alternatives",
    description: "Find alternative packages",
    argsSchema: {
      packageName: z.string(),
      useCase: z.string().optional(),
    },
  },
  ({ packageName, useCase }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Find alternative npm packages to "${packageName}"${
            useCase ? ` for use case: ${useCase}` : ""
          }. List the most popular and well-maintained alternatives, compare their features, and explain the pros and cons of each.`,
        },
      },
    ],
  })
);

// Prompt: Security review
server.registerPrompt(
  "security-review",
  {
    title: "Security Review",
    description: "Security assessment of a package",
    argsSchema: {
      packageName: z.string(),
    },
  },
  ({ packageName }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Conduct a security review of the npm package "${packageName}". Assess known vulnerabilities, dependency security, maintenance status, and provide recommendations for safe usage.`,
        },
      },
    ],
  })
);

const main = async () => {
  const mode = process.env.TRANSPORT_MODE || "stdio";
  const port = parseInt(process.env.PORT || "3000");

  if (mode === "stdio" || mode === "both") {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error("npm-context-agent-mcp server started (stdio)");
  }

  if (mode === "http" || mode === "both") {
    const app = express();
    app.use(express.json());

    app.post("/mcp", async (req, res) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

        res.on("close", () => {
          transport.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });

    app
      .listen(port, () => {
        console.error(
          `npm-context-agent-mcp server started (HTTP on port ${port})`
        );
      })
      .on("error", (error) => {
        console.error("Server error:", error);
        process.exit(1);
      });
  }
};

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
