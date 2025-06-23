# Playwright SEO Audit API

This project runs a SEO audit on a given URL using Puppeteer.

## Usage

### Build and run with Docker Compose:

```bash
docker compose up --build -d
```

API will be available at `http://localhost:3000/api/seo/audit`.

### Payload example:

```json
{
  "url": "https://example.com",
  "options": {
    "timeout": 20000,
    "waitUntil": "domcontentloaded"
  }
}
```