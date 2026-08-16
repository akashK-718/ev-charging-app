/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit uses dynamic require() for its font/image subsystem — prevent webpack
  // from bundling it and let Node resolve it at runtime in serverless functions.
  // The webpack externals function is belt-and-suspenders: serverExternalPackages
  // targets the ssr/rsc layers, but the explicit externals callback reliably
  // catches pdfkit regardless of how webpack resolves it (CJS vs ESM entry).
  serverExternalPackages: ['pdfkit'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const prev = config.externals ?? [];
      const prevArr = Array.isArray(prev) ? prev : [prev];
      config.externals = [
        ...prevArr,
        ({ request }, callback) => {
          if (request === 'pdfkit') return callback(null, `commonjs ${request}`);
          callback();
        },
      ];
    }
    return config;
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.supabase.co' }
    ]
  },
  async rewrites() {
    return {
      // beforeFiles runs before static-file lookup, so this takes priority
      // over any public/sw.js that might still exist (and over the default
      // Next.js static file handler). The browser always sees the URL as
      // /sw.js — the rewrite is transparent — so SW scope defaults to /.
      beforeFiles: [
        { source: '/sw.js', destination: '/api/sw' },
      ],
    };
  },
};

module.exports = nextConfig;
