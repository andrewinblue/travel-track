import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.5.165'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
};

export default nextConfig;
