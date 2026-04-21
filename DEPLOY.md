# Deployment Guide — Railway

Der eBay Volume Tool ist multi-tenant SaaS mit Next.js 15 + Auth.js v5 + Postgres. Gehostet auf Railway via Dockerfile (one-click from GitHub).

## 1. Erstmaliger Deploy

1. **GitHub-Repo pushen** (falls noch nicht):
   ```bash
   git init && git add . && git commit -m "Initial commit"
   # Repo auf github.com anlegen, dann:
   git remote add origin git@github.com:<user>/ebay-volume-tool.git
   git push -u origin main
   ```

2. **Railway-Projekt anlegen**
   - Login auf https://railway.app
   - "New Project" → "Deploy from GitHub Repo" → Repo wählen
   - Railway erkennt `Dockerfile` automatisch.

3. **Postgres-Addon hinzufügen**
   - Im Projekt: "+ New" → "Database" → "Add PostgreSQL"
   - Railway setzt `DATABASE_URL` automatisch als reference env var.

4. **Env-Variables setzen** (Project → Variables):
   | Variable | Wert |
   |---|---|
   | `AUTH_SECRET` | `openssl rand -hex 32` → Output hier einfügen (für Auth.js JWT-Signing) |
   | `AUTH_URL` | Railway-gegebene Domain, z.B. `https://ebay-volume.up.railway.app` |
   | `TOKEN_ENCRYPTION_KEY` | Separater `openssl rand -hex 32` (für Credential-Encryption) |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | automatisch von Postgres-Addon |

5. **Migrations beim Deploy**
   - In Railway: Service Settings → Deploy → Pre-Deploy Command: `pnpm db:migrate`
   - ODER einmalig lokal gegen die Railway-DB:
     ```bash
     railway run pnpm db:migrate
     ```

6. **Deploy triggered automatisch** auf jeden Push auf `main`.

## 2. Custom Domain (optional)

- Railway Settings → "Generate Domain" oder eigene Domain verbinden
- SSL automatisch via Let's Encrypt
- `AUTH_URL` auf die neue Domain updaten

## 3. User-Registrierung

Nach erfolgreichem Deploy:
1. Öffne `https://<your-domain>/auth/signup`
2. Account erstellen
3. Settings-Page öffnen, eBay + Icecat + Discord creds eintragen
4. Dashboard zeigt Getting-Started-Flow

## 4. Updates

Push auf `main` → Railway auto-deployed. Migrations laufen via Pre-Deploy Command.

## 5. Logs + Monitoring

- Railway Dashboard → Deployments → "View Logs"
- Für Production-ready Monitoring später: Sentry für Errors, Datadog/Grafana für Metrics.

## 6. Backup

- Railway Postgres-Addon hat automatische Daily-Backups (Pro-Plan)
- Für zusätzliche Sicherheit: `pg_dump` via Scheduled Job

## Cost Estimate (Hobby → Pro)

- **Hobby Plan ($5/mo):** Reicht für dich + paar Testuser, $5 Credit inklusive, typisch ~$3-7/mo Verbrauch
- **Pro Plan ($20/mo):** Für mehr Traffic + Team-Features + 99.9% SLA

## Troubleshooting

### Build fails mit "Cannot find module"

Prüfe dass `pnpm-lock.yaml` committed ist. Railway bricht ab wenn Lock-File fehlt.

### Login funktioniert nicht nach Deploy

Prüfe `AUTH_URL` — muss exakt die Railway-URL sein (inkl. https://).
