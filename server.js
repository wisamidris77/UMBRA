/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Node.js Static File Server
 * ==========================================================================
 * A dependency-free static file web server using built-in Node.js modules.
 * Run this file using command: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Strip query parameters and hash from request URL
  const urlPath = req.url.split('?')[0].split('#')[0];

  // Normalize URL path to prevent directory traversal
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

  // Get file extension
  const ext = path.extname(filePath).toLowerCase();
  let contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Read and serve file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Page not found
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 File Not Found</h1>', 'utf-8');
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success: send content
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log(`🚀 ORBITAL BOUND server started!`);
  console.log(`👉 Open your browser at: http://localhost:${PORT}`);
  console.log('======================================================\n');
});
