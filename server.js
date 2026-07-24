// AC Portfolio — local dev server with file write API
// Uses only Node.js built-in modules.  No npm install needed.
// Run: node server.js [port]

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2]) || 8080;
const ROOT = __dirname;
const PROJECTS_DIR = path.join(ROOT, 'content', 'projects');
const INDEX_PATH   = path.join(PROJECTS_DIR, 'index.json');

// ── MIME ──────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
};

// ── UTILS ─────────────────────────────────────────────────────
function notFound(res, msg) {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: msg || 'Not found' }));
}

function serverError(res, err) {
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: err.message || String(err) }));
}

function ok(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data || { ok: true }));
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
  });
}

// ── STATIC SERVE ──────────────────────────────────────────────
function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(ROOT)) return notFound(res, 'Invalid path');

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return notFound(res, 'Is a directory');

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    if (e.code === 'ENOENT') notFound(res, 'File not found');
    else serverError(res, e);
  }
}

// ── API HANDLERS ──────────────────────────────────────────────

// POST /api/save-scenes  { slug, data }
async function saveScenes(req, res) {
  try {
    const body = await readBody(req);
    const { slug, data } = body;
    if (!slug || !data) return notFound(res, 'Missing slug or data');

    const dir = path.join(PROJECTS_DIR, slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, 'scenes.json');
    writeJSON(filePath, data);
    console.log('[OK] Saved scenes:', filePath);
    ok(res, { saved: filePath });
  } catch (e) { serverError(res, e); }
}

// POST /api/save-project  { slug, data }
async function saveProject(req, res) {
  try {
    const body = await readBody(req);
    const { slug, data } = body;
    if (!slug || !data) return notFound(res, 'Missing slug or data');

    const dir = path.join(PROJECTS_DIR, slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, 'project.json');
    writeJSON(filePath, data);
    console.log('[OK] Saved project:', filePath);
    ok(res, { saved: filePath });
  } catch (e) { serverError(res, e); }
}

// POST /api/create-project  { slug, title, type, icon, date, description, cover }
async function createProject(req, res) {
  try {
    const body = await readBody(req);
    const slug = body.slug;
    if (!slug) return notFound(res, 'Missing slug');

    const dir = path.join(PROJECTS_DIR, slug);
    if (fs.existsSync(dir)) return notFound(res, 'Project already exists: ' + slug);
    fs.mkdirSync(dir, { recursive: true });

    // project.json
    const projectData = {
      slug,
      title: body.title || slug,
      type: body.type || 'PROJECT',
      icon: body.icon || 'icons/project.svg',
      date: body.date || new Date().toISOString().slice(0,7).replace('-',' ').toUpperCase(),
      description: body.description || '',
      cover: body.cover || 'posts/tired_20260718.jpg'
    };
    writeJSON(path.join(dir, 'project.json'), projectData);

    // scenes.json
    const scenesData = {
      canvasWidth: '200vw',
      scenes: [{ id: 'opening', x: 0, width: '100vw', elements: [] }]
    };
    writeJSON(path.join(dir, 'scenes.json'), scenesData);

    // project library folder
    const libDir = path.join(dir, 'library', 'components');
    fs.mkdirSync(libDir, { recursive: true });
    writeJSON(path.join(dir, 'library', 'index.json'), { components: [], animations: [], effects: [] });

    // Update index.json
    let index;
    try { index = readJSON(INDEX_PATH); } catch(e) { index = { projects: [] }; }
    if (!index.projects.includes(slug)) {
      index.projects.push(slug);
      writeJSON(INDEX_PATH, index);
    }

    console.log('[OK] Created project:', slug);
    ok(res, { created: slug, dir });
  } catch (e) { serverError(res, e); }
}

// DELETE /api/delete-project  (slug in query string)
async function deleteProject(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const slug = url.searchParams.get('slug');
    if (!slug) return notFound(res, 'Missing slug');

    const dir = path.join(PROJECTS_DIR, slug);
    if (!fs.existsSync(dir)) return notFound(res, 'Project not found: ' + slug);

    // Remove directory recursively
    fs.rmSync(dir, { recursive: true, force: true });

    // Remove from index.json
    try {
      const index = readJSON(INDEX_PATH);
      index.projects = index.projects.filter(s => s !== slug);
      writeJSON(INDEX_PATH, index);
    } catch(e) {}

    console.log('[OK] Deleted project:', slug);
    ok(res, { deleted: slug });
  } catch (e) { serverError(res, e); }
}

// POST /api/add-to-index  { slug }
async function addToIndex(req, res) {
  try {
    const body = await readBody(req);
    const slug = body.slug;
    if (!slug) return notFound(res, 'Missing slug');

    let index;
    try { index = readJSON(INDEX_PATH); } catch(e) { index = { projects: [] }; }
    if (!index.projects.includes(slug)) {
      index.projects.push(slug);
      writeJSON(INDEX_PATH, index);
    }
    console.log('[OK] Added to index:', slug);
    ok(res, { index });
  } catch (e) { serverError(res, e); }
}

// POST /api/save-library-component  { id, data }
// ── Shared library ─────────────────────────────────────────

async function saveLibraryComponent(req, res) {
  try {
    const body = await readBody(req);
    const { id, data } = body;
    if (!id || !data) return notFound(res, 'Missing id or data');
    const dir = path.join(ROOT, 'library', 'shared', 'components');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJSON(path.join(dir, id + '.json'), data);
    console.log('[OK] Saved shared component:', id);
    ok(res, { saved: id });
  } catch (e) { serverError(res, e); }
}

async function saveLibraryIndex(req, res) {
  try {
    const body = await readBody(req);
    const { data } = body;
    if (!data) return notFound(res, 'Missing data');
    writeJSON(path.join(ROOT, 'library', 'shared', 'index.json'), data);
    console.log('[OK] Saved shared library index');
    ok(res, { saved: 'index.json' });
  } catch (e) { serverError(res, e); }
}

async function deleteLibraryComponent(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    if (!id) return notFound(res, 'Missing id');
    const fp = path.join(ROOT, 'library', 'shared', 'components', id + '.json');
    if (!fs.existsSync(fp)) return notFound(res, 'Component not found: ' + id);
    fs.unlinkSync(fp);
    const ip = path.join(ROOT, 'library', 'shared', 'index.json');
    if (fs.existsSync(ip)) {
      const idx = readJSON(ip);
      idx.components = (idx.components || []).filter(c => c !== id);
      writeJSON(ip, idx);
    }
    console.log('[OK] Deleted shared component:', id);
    ok(res, { deleted: id });
  } catch (e) { serverError(res, e); }
}

// ── Project-scoped library ─────────────────────────────────

async function saveProjectComponent(req, res) {
  try {
    const body = await readBody(req);
    const { slug, id, data } = body;
    if (!slug || !id || !data) return notFound(res, 'Missing slug, id, or data');
    const dir = path.join(PROJECTS_DIR, slug, 'library', 'components');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeJSON(path.join(dir, id + '.json'), data);
    const ip = path.join(PROJECTS_DIR, slug, 'library', 'index.json');
    let idx = { components: [], animations: [], effects: [] };
    try { idx = readJSON(ip); } catch(e) {}
    if (idx.components.indexOf(id) < 0) {
      idx.components.push(id);
      writeJSON(ip, idx);
    }
    console.log('[OK] Saved project component: ' + id + ' for ' + slug);
    ok(res, { saved: id, slug: slug });
  } catch (e) { serverError(res, e); }
}

async function saveProjectIndex(req, res) {
  try {
    const body = await readBody(req);
    const { slug, data } = body;
    if (!slug || !data) return notFound(res, 'Missing slug or data');
    writeJSON(path.join(PROJECTS_DIR, slug, 'library', 'index.json'), data);
    console.log('[OK] Saved project library index for ' + slug);
    ok(res, { saved: 'index.json', slug: slug });
  } catch (e) { serverError(res, e); }
}

// GET /api/open-project-folder?slug=...
async function openProjectFolder(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const slug = url.searchParams.get('slug');
    if (!slug) return notFound(res, 'Missing slug');
    const dir = path.join(PROJECTS_DIR, slug);
    if (!fs.existsSync(dir)) return notFound(res, 'Project not found: ' + slug);
    const { exec } = require('child_process');
    if (process.platform === 'win32') {
      exec('explorer "' + dir + '"');
    } else if (process.platform === 'darwin') {
      exec('open "' + dir + '"');
    } else {
      exec('xdg-open "' + dir + '"');
    }
    console.log('[OK] Opened project folder: ' + dir);
    ok(res, { opened: dir });
  } catch (e) { serverError(res, e); }
}

// GET /api/list-project-files?slug=...&type=image,video
async function listProjectFiles(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const slug = url.searchParams.get('slug');
    if (!slug) return notFound(res, 'Missing slug');
    const dir = path.join(PROJECTS_DIR, slug);
    if (!fs.existsSync(dir)) return notFound(res, 'Project not found: ' + slug);

    const types = (url.searchParams.get('type') || 'image,video,gif,svg,model').split(',');
    const imageExts = ['.jpg','.jpeg','.png','.gif','.webp','.svg','.webm','.mp4','.mov','.glb','.gltf','.json'];
    const allowedExts = types.includes('all') ? null : imageExts;

    function scanDir(d, basePath) {
      let results = [];
      try {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'library' || entry.name === 'node_modules') continue;
          const full = path.join(d, entry.name);
          const rel = path.relative(dir, full).replace(/\\/g, '/');
          if (entry.isDirectory()) {
            results = results.concat(scanDir(full, basePath));
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!allowedExts || allowedExts.includes(ext)) {
              results.push({
                name: entry.name,
                path: 'content/projects/' + slug + '/' + rel,
                ext: ext
              });
            }
          }
        }
      } catch(e) {}
      return results;
    }
    const files = scanDir(dir, dir);
    ok(res, { files: files, projectSlug: slug });
  } catch (e) { serverError(res, e); }
}

// ── ROUTER ────────────────────────────────────────────────────
const API = {
  'POST /api/save-scenes':              saveScenes,
  'POST /api/save-project':             saveProject,
  'POST /api/create-project':           createProject,
  'DELETE /api/delete-project':          deleteProject,
  'POST /api/add-to-index':             addToIndex,
  'POST /api/save-library-component':   saveLibraryComponent,
  'POST /api/save-library-index':       saveLibraryIndex,
  'DELETE /api/delete-library-component': deleteLibraryComponent,
  'POST /api/save-project-component':   saveProjectComponent,
  'POST /api/save-project-index':       saveProjectIndex,
  'GET /api/open-project-folder':        openProjectFolder,
  'GET /api/list-project-files':         listProjectFiles,
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const key = req.method + ' ' + urlPath;
  const handler = API[key];

  if (handler) {
    handler(req, res);
  } else if (urlPath.startsWith('/api/')) {
    // API requests that don't match → JSON error, never HTML
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unknown API endpoint: ' + key }));
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  AC Portfolio Server');
  console.log('  -------------------');
  console.log('  http://localhost:' + PORT);
  console.log('  http://localhost:' + PORT + '/editor.html');
  console.log('');
  console.log('  API: save / create / delete projects');
  console.log('  Press Ctrl+C to stop');
  console.log('');
});
