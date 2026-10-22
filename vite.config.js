import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works on Vercel, Netlify or a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
});
