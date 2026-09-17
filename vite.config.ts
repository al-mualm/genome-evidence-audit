import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {fileURLToPath, URL} from 'node:url';
export default defineConfig({base:process.env.SITE_BASE_PATH||'/',build:{outDir:'dist/client'},resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},css:{postcss:{plugins:[tailwindcss()]}},plugins:[react()]});
