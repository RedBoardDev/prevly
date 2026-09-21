import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const devDir = join(root, 'dev');
const bundle = resolve(root, '../internal/feedback/assets/feedback.js');
const port = Number(process.env.PORT ?? 4177);

const store = [];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((done, fail) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => done(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

function parseMultipart(buffer, boundary) {
  const parts = [];
  const sep = Buffer.from(`\r\n--${boundary}`);
  const body = Buffer.concat([Buffer.from('\r\n'), buffer]);
  let index = body.indexOf(sep);
  while (index !== -1) {
    const next = body.indexOf(sep, index + sep.length);
    if (next === -1) break;
    const chunk = body.subarray(index + sep.length, next);
    if (chunk.subarray(0, 2).toString() === '--') break;
    const headerEnd = chunk.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const headers = chunk.subarray(2, headerEnd).toString('utf8');
    const data = chunk.subarray(headerEnd + 4);
    const name = /name="([^"]*)"/.exec(headers)?.[1] ?? '';
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? '';
    parts.push({ name, type, data });
    index = next;
  }
  return parts;
}

async function handlePost(req, res) {
  const contentType = req.headers['content-type'] ?? '';
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  if (!boundary) return json(res, 415, { error: 'expected multipart/form-data' });

  const raw = await readBody(req);
  const parts = parseMultipart(raw, boundary[1] ?? boundary[2]);
  const metaPart = parts.find((part) => part.name === 'meta');
  const shotPart = parts.find((part) => part.name === 'screenshot');
  if (!metaPart) return json(res, 400, { error: 'missing meta part' });

  let meta;
  try {
    meta = JSON.parse(metaPart.data.toString('utf8'));
  } catch {
    return json(res, 400, { error: 'meta is not valid json' });
  }
  if (!meta.author || !meta.comment || !meta.page) {
    return json(res, 400, { error: 'author, comment and page are required' });
  }

  const id = randomUUID();
  const record = {
    id,
    repo: 'akord-securite/KARE',
    pr: 1268,
    app: 'kare',
    page: meta.page,
    author: meta.author,
    comment: meta.comment,
    selector: meta.selector ?? null,
    element: meta.element ?? null,
    click: meta.click ?? null,
    rect: meta.rect ?? null,
    viewport: meta.viewport ?? null,
    created_at: new Date().toISOString(),
    comment_url: `https://github.com/akord-securite/KARE/pull/1268#issuecomment-${store.length + 1}`,
    screenshot_url: shotPart ? `/_prevly/feedback/${id}/screenshot.png` : null,
  };

  store.push({
    record,
    meta,
    metaType: metaPart.type,
    screenshot: shotPart?.data ?? null,
    screenshotType: shotPart?.type ?? null,
  });

  console.log(
    `[dev] feedback ${id} · ${meta.author} · "${meta.comment}" · selector=${meta.selector ?? '-'} · screenshot=${shotPart ? `${shotPart.data.length}B` : 'none'} · console=${meta.console?.length ?? 0}`,
  );
  return json(res, 201, { item: record });
}

async function serveFile(res, path) {
  try {
    const data = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const path = url.pathname;

  try {
    if (path === '/health') return json(res, 200, { ok: true });

    // The apps behind a login answer the entry url with a redirect that drops
    // the query string; this route reproduces that in the mock.
    if (path === '/redirect-me') {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }

    if (path === '/_prevly/feedback.js') return serveFile(res, bundle);

    // Mirrors the daemon: the flag has to survive the app's own redirects, so
    // it is a cookie the server sets, never a query parameter.
    if (path === '/_prevly/activate') {
      const to = url.searchParams.get('to');
      const target = to && to.startsWith('/') && !to.startsWith('//') ? to : '/';
      res.writeHead(302, {
        'Set-Cookie': 'prevly_feedback=1; Path=/; Max-Age=7776000; SameSite=Lax',
        'Cache-Control': 'no-store',
        Location: target,
      });
      return res.end();
    }

    if (path === '/_prevly/api/feedback') {
      if (req.method === 'GET') {
        return json(res, 200, { items: store.map((entry) => entry.record).reverse() });
      }
      if (req.method === 'POST') return handlePost(req, res);
      return json(res, 405, { error: 'method not allowed' });
    }

    const shot = /^\/_prevly\/feedback\/([^/]+)\/screenshot\.png$/.exec(path);
    if (shot) {
      const entry = store.find((item) => item.record.id === shot[1]);
      if (!entry?.screenshot) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(entry.screenshot);
    }

    if (path.startsWith('/_prevly/')) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }

    if (path === '/_dev/received') {
      return json(
        res,
        200,
        store.map((entry) => ({
          meta: entry.meta,
          metaType: entry.metaType,
          screenshotBytes: entry.screenshot?.length ?? 0,
          screenshotType: entry.screenshotType,
          isPng: entry.screenshot
            ? entry.screenshot.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : false,
        })),
      );
    }

    if (path === '/_dev/reset') {
      store.length = 0;
      return json(res, 200, { ok: true });
    }

    const file = path === '/' ? 'index.html' : normalize(path).replace(/^(\.\.[/\\])+/, '');
    return serveFile(res, join(devDir, file));
  } catch (error) {
    console.error('[dev] handler failed', error);
    return json(res, 500, { error: String(error) });
  }
});

server.listen(port, () => {
  console.log(`[dev] mock preview on http://localhost:${port}/?prevly_feedback=1`);
  console.log(`[dev] widget bundle served from ${bundle}`);
});
