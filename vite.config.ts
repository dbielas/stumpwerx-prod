import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function mpaTrailingSlash(): Plugin {
  return {
    name: 'mpa-trailing-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url) {
          const [pathname, query] = req.url.split('?');
          if (pathname.length > 1 && !pathname.endsWith('/') && !pathname.includes('.')) {
            const candidate = path.resolve(__dirname, pathname.slice(1), 'index.html');
            if (fs.existsSync(candidate)) {
              res.writeHead(301, { Location: `${pathname}/${query ? `?${query}` : ''}` });
              res.end();
              return;
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [tailwindcss(), mpaTrailingSlash()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        treeRemoval: path.resolve(__dirname, 'tree-removal/index.html'),
        stumpGrinding: path.resolve(__dirname, 'stump-grinding/index.html'),
        stormDamage: path.resolve(__dirname, 'storm-damage/index.html'),
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: {
      ignored: ['**/public/img/**']
    }
  },
});
