/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@edlight-news/types", "@edlight-news/firebase"],
  webpack(config) {
    // When Next.js transpiles workspace packages from TypeScript source,
    // imports like './admin.js' need to resolve to './admin.ts'.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

module.exports = nextConfig;
