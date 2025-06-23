# Playwright SEO Audit API

## Endpoints

- `GET /health` — check service health
- `POST /api/seo/audit` — body: `{ "url": "https://example.com" }`

## Docker

```
docker build -t playwright-seo-audit .
docker run -p 3000:3000 playwright-seo-audit
```
