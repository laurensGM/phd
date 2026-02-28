import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [mdx(), react()],
  site: 'https://your-username.github.io',
  base: '/',
  output: 'static',
  trailingSlash: 'always',
});
