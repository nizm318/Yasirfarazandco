# Yasir Faraz and Co. — Blog Backend

A tiny Cloudflare Worker + KV API so CA Yasir Faraz can post "daily thoughts"
from the /admin.html page without touching code.

## Deploy (one-time, ~5 minutes)

```bash
npm install -g wrangler
wrangler login

cd worker
wrangler kv namespace create BLOG_KV
# copy the "id" it prints into wrangler.toml -> kv_namespaces[0].id

wrangler secret put ADMIN_PASSWORD
# enter the password CA Yasir Faraz will log in with

wrangler deploy
```

Wrangler will print a URL like:

```
https://yfc-blog.<your-subdomain>.workers.dev
```

## Connect it to the site

Open both `assets/blog.js` and `assets/admin.js` and set:

```js
const API_BASE = "https://yfc-blog.<your-subdomain>.workers.dev";
```

Re-upload/redeploy the site (Netlify) and the Blog + Admin pages go live
immediately — no other changes needed.

## Using it day to day

- Public blog:  `yourdomain.com/blog.html`
- Admin login:  `yourdomain.com/admin.html` (password set above)
- Posts are stored in Cloudflare KV — no database to manage, effectively free
  at this scale (Cloudflare's free tier covers well beyond daily posting volume).
