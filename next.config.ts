import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  /** Keep heavy Node packages off the client graph */
  serverExternalPackages: ['docx'],
  transpilePackages: [
    '@syncfusion/ej2-react-documenteditor',
    '@syncfusion/ej2-documenteditor',
    '@syncfusion/ej2-base',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
