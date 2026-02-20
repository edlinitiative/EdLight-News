/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@edlight-news/types", "@edlight-news/firebase"],
  experimental: {
    // Prevent webpack from bundling firebase-admin and its gRPC/SSL dependencies.
    // When bundled, OpenSSL certificate handling breaks with:
    //   "error:1E08010C:DECODER routines::unsupported"
    // By externalising them, Node.js loads them natively at runtime instead.
    serverComponentsExternalPackages: [
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
