/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Statik eksport: build natijasi (out/) backend tomonidan bir xil domenda beriladi
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
