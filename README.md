# OEM Key Part Finder

Node.js + Express web app for VIN-based OEM key, remote, and transponder part number lookup.

## Run locally

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Environment

Copy `.env.example` to `.env` if you want to customize port, cache TTL, or rate limit settings.

## API

```bash
curl -X POST http://localhost:3000/api/lookup \
  -H "Content-Type: application/json" \
  -d '{"vin":"2T3WFREV1EW114903"}'
```

## Lookup history

Lookup attempts are saved locally at runtime in:

```text
data/lookup-history.jsonl
data/lookup-history.csv
```

The `data/` folder is ignored by Git so VIN/search history is not published to GitHub.
