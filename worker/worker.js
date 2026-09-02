/**
 * Yasir Faraz and Co. — Blog API (Cloudflare Worker + KV)
 * ---------------------------------------------------------------
 * DEPLOY STEPS
 * 1. Install wrangler:              npm install -g wrangler
 * 2. Login:                          wrangler login
 * 3. Create the KV namespace:        wrangler kv namespace create BLOG_KV
 *    -> copy the returned "id" into wrangler.toml (see wrangler.toml in this folder)
 * 4. Set the admin password secret:  wrangler secret put ADMIN_PASSWORD
 *    -> enter the password CA Yasir Faraz will log in with
 * 5. Deploy:                         wrangler deploy
 * 6. Copy the deployed Worker URL (e.g. https://yfc-blog.<subdomain>.workers.dev)
 *    into API_BASE at the top of assets/blog.js and assets/admin.js
 *
 * DATA MODEL
 * All posts are stored as a single JSON array under KV key "posts".
 * Fine for a daily-thoughts blog; if volume grows into the thousands,
 * switch to one KV key per post (id as key) + a separate index key.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function withCors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', '*');
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  return resp;
}

function json(data, status = 200) {
  return withCors(new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }));
}

async function getPosts(env) {
  const raw = await env.BLOG_KV.get('posts');
  return raw ? JSON.parse(raw) : [];
}

async function savePosts(env, posts) {
  await env.BLOG_KV.put('posts', JSON.stringify(posts));
}

async function getVideos(env) {
  const raw = await env.BLOG_KV.get('videos');
  return raw ? JSON.parse(raw) : [];
}

async function saveVideos(env, videos) {
  await env.BLOG_KV.put('videos', JSON.stringify(videos));
}

function checkAuth(request, env) {
  const supplied = request.headers.get('X-Admin-Password') || '';
  return supplied.length > 0 && supplied === env.ADMIN_PASSWORD;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }

    // POST /api/verify  { password }  -> { ok: true/false }
    if (pathname === '/api/verify' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const ok = (body.password || '') === env.ADMIN_PASSWORD;
      return json({ ok });
    }

    // GET /api/posts -> public, newest first
    if (pathname === '/api/posts' && method === 'GET') {
      const posts = await getPosts(env);
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      return json(posts);
    }

    // POST /api/posts  { title, content } -> protected, creates a post
    if (pathname === '/api/posts' && method === 'POST') {
      if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      if (!body.title || !body.content) return json({ error: 'title and content are required' }, 400);
      const posts = await getPosts(env);
      const post = {
        id: crypto.randomUUID(),
        title: body.title.trim(),
        content: body.content.trim(),
        date: new Date().toISOString(),
      };
      posts.push(post);
      await savePosts(env, posts);
      return json(post, 201);
    }

    // PUT /api/posts/:id  { title, content } -> protected, edits a post
    const putMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (putMatch && method === 'PUT') {
      if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);
      const id = putMatch[1];
      const body = await request.json().catch(() => ({}));
      const posts = await getPosts(env);
      const idx = posts.findIndex(p => p.id === id);
      if (idx === -1) return json({ error: 'Post not found' }, 404);
      if (body.title) posts[idx].title = body.title.trim();
      if (body.content) posts[idx].content = body.content.trim();
      posts[idx].updatedAt = new Date().toISOString();
      await savePosts(env, posts);
      return json(posts[idx]);
    }

    // DELETE /api/posts/:id -> protected
    if (putMatch && method === 'DELETE') {
      if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);
      const id = putMatch[1];
      const posts = await getPosts(env);
      const filtered = posts.filter(p => p.id !== id);
      await savePosts(env, filtered);
      return json({ ok: true });
    }

    // GET /api/videos -> public, newest first
    if (pathname === '/api/videos' && method === 'GET') {
      const videos = await getVideos(env);
      videos.sort((a, b) => new Date(b.date) - new Date(a.date));
      return json(videos);
    }

    // POST /api/videos  { title, url, description } -> protected, adds a video
    if (pathname === '/api/videos' && method === 'POST') {
      if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      if (!body.title || !body.url) return json({ error: 'title and url are required' }, 400);
      const videos = await getVideos(env);
      const video = {
        id: crypto.randomUUID(),
        title: body.title.trim(),
        url: body.url.trim(),
        description: (body.description || '').trim(),
        date: new Date().toISOString(),
      };
      videos.push(video);
      await saveVideos(env, videos);
      return json(video, 201);
    }

    // PUT /api/videos/:id  { title, url, description } -> protected, edits a video
    const videoMatch = pathname.match(/^\/api\/videos\/([^/]+)$/);
    if (videoMatch && method === 'PUT') {
      if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);
      const id = videoMatch[1];
      const body = await request.json().catch(() => ({}));
      const videos = await getVideos(env);
      const idx = videos.findIndex(v => v.id === id);
      if (idx === -1) return json({ error: 'Video not found' }, 404);
      if (body.title) videos[idx].title = body.title.trim();
      if (body.url) videos[idx].url = body.url.trim();
      if (body.description !== undefined) videos[idx].description = body.description.trim();
      videos[idx].updatedAt = new Date().toISOString();
      await saveVideos(env, videos);
      return json(videos[idx]);
    }

    // DELETE /api/videos/:id -> protected
    if (videoMatch && method === 'DELETE') {
      if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);
      const id = videoMatch[1];
      const videos = await getVideos(env);
      const filtered = videos.filter(v => v.id !== id);
      await saveVideos(env, filtered);
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  },
};
