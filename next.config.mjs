/** @type {import('next').NextConfig} */
const nextConfig = {
  // SECURITY: Do not ignore TypeScript build errors in production
  // This ensures type safety issues are caught before deployment
  images: {
    unoptimized: true,
  },
}

export default nextConfig
