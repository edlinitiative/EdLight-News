/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only transpile @edlight-news/types (pure TS types + Zod, safe to bundle).
  // @edlight-news/firebase is intentionally NOT transpiled — it ships a pre-built
  // dist/index.js and is kept out of webpack via serverComponentsExternalPackages.
  transpilePackages: ["@edlight-news/types"],
  experimental: {
    // Keep firebase-admin and its gRPC/SSL stack out of webpack entirely.
    // webpack emits a native require(); Node.js loads them from node_modules at
    // runtime where TLS certificate handling works correctly.
    serverComponentsExternalPackages: [
      "@edlight-news/firebase",
      "firebase-admin",
      "@google-cloud/firestore",
      "@grpc/grpc-js",
      "google-auth-library",
    ],
  },
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
