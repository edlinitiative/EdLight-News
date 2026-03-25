/** @type {import('next').NextConfig} */

// These packages must never be webpack-bundled. When bundled, firebase-admin's
// gRPC/SSL stack breaks with "DECODER routines::unsupported".
// Listed here so both serverComponentsExternalPackages AND the custom webpack
// externals function stay in sync.
const FIREBASE_EXTERNALS = [
  "firebase-admin",
  "@google-cloud/firestore",
  "@grpc/grpc-js",
  "google-auth-library",
];

// Playwright and its transitive deps must be kept external — they rely on
// native binaries and Node.js built-ins that webpack cannot bundle.
const PLAYWRIGHT_EXTERNALS = [
  "playwright-core",
  "playwright",
  "chromium-bidi",
  "electron",
  "@edlight-news/renderer",
];

const nextConfig = {
  // Allow images from Firebase Storage, Wikimedia Commons, and common publisher CDNs
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  // @edlight-news/firebase is transpiled from source so webpack can bundle it
  // into the serverless function — avoiding the pnpm-symlink runtime resolution
  // problem that occurs when the package is externalised on Vercel.
  // @edlight-news/types is pure TS/Zod, always safe to bundle.
  transpilePackages: ["@edlight-news/types", "@edlight-news/firebase"],
  experimental: {
    // Belt-and-suspenders: also list firebase-admin packages here so Next.js
    // marks them external through its own mechanism.
    serverComponentsExternalPackages: [
      ...FIREBASE_EXTERNALS,
      ...PLAYWRIGHT_EXTERNALS,
    ],
  },
  webpack(config, { isServer }) {
    // When Next.js transpiles workspace packages from TypeScript source,
    // imports like './admin.js' need to resolve to './admin.ts'.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };

    if (isServer) {
      // serverComponentsExternalPackages only externalises packages when the
      // importer is itself inside node_modules. When @edlight-news/firebase is
      // transpiled (i.e. treated as app code), that context check fails and
      // firebase-admin gets bundled anyway.
      //
      // This custom externals function unconditionally externalises the
      // firebase-admin family regardless of which file is importing them,
      // guaranteeing they are loaded by Node.js natively at runtime.
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];

      config.externals = [
        ...existingExternals,
        ({ request }, callback) => {
          if (
            FIREBASE_EXTERNALS.some(
              (pkg) => request === pkg || request.startsWith(pkg + "/")
            ) ||
            PLAYWRIGHT_EXTERNALS.some(
              (pkg) => request === pkg || request.startsWith(pkg + "/")
            )
          ) {
            return callback(null, "commonjs " + request);
          }
          callback();
        },
      ];
    }

    return config;
  },
};

module.exports = nextConfig;

