import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Vite plugin to handle local memory file
function memoryApiPlugin() {
  const memoryDir = path.resolve(__dirname, 'memory');
  const memoryFile = path.resolve(memoryDir, 'user_profile.json');

  return {
    name: 'memory-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/memory') {
          res.setHeader('Content-Type', 'application/json');

          if (req.method === 'GET') {
            if (fs.existsSync(memoryFile)) {
              res.end(fs.readFileSync(memoryFile, 'utf-8'));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Memory not found' }));
            }
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                if (!fs.existsSync(memoryDir)) {
                  fs.mkdirSync(memoryDir, { recursive: true });
                }
                const data = JSON.parse(body);
                fs.writeFileSync(memoryFile, JSON.stringify(data, null, 2));
                res.end(JSON.stringify({ success: true, message: 'Memory saved' }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to write memory' }));
              }
            });
            return;
          }
        }
        next();
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), memoryApiPlugin()],
  server: {
    host: '127.0.0.1',
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
    },
  },
})
