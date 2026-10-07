const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'todos.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

let todos = [];
try {
  todos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch {}

const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2));

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(/^\/api\/todos(?:\/(\d+))?$/);

  if (match) {
    const id = match[1] && Number(match[1]);
    if (req.method === 'GET' && !id) return send(res, 200, todos);
    if (req.method === 'POST' && !id) {
      const { text } = await readBody(req);
      if (!text || !String(text).trim()) return send(res, 400, { error: 'text required' });
      const todo = { id: Date.now(), text: String(text).trim(), done: false };
      todos.push(todo);
      save();
      return send(res, 201, todo);
    }
    const todo = todos.find((t) => t.id === id);
    if (!todo) return send(res, 404, { error: 'not found' });
    if (req.method === 'PATCH') {
      const { done } = await readBody(req);
      todo.done = Boolean(done);
      save();
      return send(res, 200, todo);
    }
    if (req.method === 'DELETE') {
      todos = todos.filter((t) => t.id !== id);
      save();
      return send(res, 204, null);
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  const file = url.pathname === '/' ? 'index.html' : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
  fs.readFile(full, (err, content) => {
    if (err) return send(res, 404, { error: 'not found' });
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
    res.writeHead(200, { 'Content-Type': types[path.extname(full)] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => console.log(`Todo app running at http://localhost:${PORT}`));
