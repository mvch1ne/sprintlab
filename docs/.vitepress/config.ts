import { defineConfig } from 'vitepress';
import mathjax3 from 'markdown-it-mathjax3';

export default defineConfig({
  title: 'SprintLab Docs',
  description: 'Technical documentation for SprintLab — sprint kinematic analysis from video.',
  base: '/zero/',

  markdown: {
    config: (md) => {
      md.use(mathjax3);
    },
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Math Reference', link: '/math' },
      { text: 'GitHub', link: 'https://github.com/mvch1ne/zero' },
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Architecture', link: '/architecture' },
        ],
      },
      {
        text: 'Frontend',
        items: [
          { text: 'Overview', link: '/frontend/overview' },
          { text: 'Viewport', link: '/frontend/viewport' },
          { text: 'Pose Engine', link: '/frontend/pose-engine' },
          { text: 'Calibration', link: '/frontend/calibration' },
          { text: 'Metrics Engine', link: '/frontend/metrics' },
          { text: 'Telemetry Panel', link: '/frontend/telemetry' },
        ],
      },
      {
        text: 'Backend',
        items: [
          { text: 'Overview', link: '/backend/overview' },
          { text: 'API Reference', link: '/backend/api' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Math Reference', link: '/math' },
          { text: 'Testing', link: '/testing' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/mvch1ne/zero' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 A. Sabit Ariff',
    },
  },
});
