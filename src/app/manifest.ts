/* eslint-disable @typescript-eslint/no-explicit-any */
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SprintScale CMS',
    short_name: 'SprintScale',
    description: 'After-School Club Management System',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0071e3',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable any' as any,
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any' as any,
      },
    ],
    screenshots: [],
    categories: ['education', 'productivity'],
  };
}
