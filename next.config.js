/** @type {import('next').NextConfig} */
const nextConfig = {
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
