# Deploying aitech to Google Cloud Run

One container serves the React frontend **and** the FastAPI backend on a single
domain (`aitechh.co`). Supabase stays external. Cloud Run scales to zero, so an
idle app costs ~nothing.

You do **not** need Docker installed — Cloud Build builds the image in the cloud
from the `Dockerfile`.

---

## Step 0 — Install the gcloud CLI (one time)

Windows: download and run the installer from
<https://cloud.google.com/sdk/docs/install> (pick "Google Cloud CLI installer").
When it finishes, **open a new terminal** and check:

```bash
gcloud version
```

---

## Step 1 — Log in and select your project

```bash
gcloud auth login
gcloud config set project project-08e315e8-ebbe-42f6-9ac
```

(Use the project ID from your GCP dashboard.)

## Step 2 — Enable the APIs (one time)

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Step 3 — Fill in your secrets

Open `env.deploy.yaml` (already created, gitignored) and paste your **current**
Supabase **service** key into `SUPABASE_SERVICE_KEY`. Everything else is filled in.

## Step 4 — Deploy 🚀

From the repo root:

```bash
gcloud run deploy aitech --source . --region europe-west1 --allow-unauthenticated --env-vars-file env.deploy.yaml --memory 512Mi
```

- First run takes ~3–5 min (it builds the image).
- It prints a URL like `https://aitech-xxxxxxxx-ew.a.run.app` — open it, that's your live app.
- Re-run the exact same command any time to deploy updates.

> Region note: `europe-west1` (Belgium) is a safe, cheap default and close to a
> Frankfurt Supabase. For lowest latency to UAE users you can use `me-central1`
> (Doha) instead — just keep the region consistent across commands.

## Step 5 — Point your domain at it

```bash
gcloud beta run domain-mappings create --service aitech --domain aitechh.co --region europe-west1
gcloud beta run domain-mappings create --service aitech --domain www.aitechh.co --region europe-west1
```

- The first time, Google asks you to **verify domain ownership** (it opens
  Search Console — add the TXT record it gives you at your domain registrar).
- Then it prints **DNS records** (A / AAAA for the root, CNAME for www). Add
  those at your domain registrar (where you bought aitechh.co).
- SSL is automatic once DNS propagates (can take 15 min–a few hours).

## Step 6 — Tell Supabase about the domain (auth)

Supabase dashboard → **Authentication → URL Configuration** → set **Site URL** to
`https://aitechh.co` and add it under **Redirect URLs**. (Password login works
without this, but it's good hygiene and needed if you enable email links later.)

---

## Updating later

Just **push to `main`** — CI/CD deploys automatically (see below). To deploy
manually instead:

```bash
gcloud run deploy aitech --source . --region europe-west1 --allow-unauthenticated --env-vars-file env.deploy.yaml --memory 512Mi
```

## CI/CD (GitHub Actions → Cloud Run)

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
1. **CI** — installs + typechecks + builds the frontend, and import-checks the backend.
2. **CD** — deploys to Cloud Run (only on push to `main`).

Auth is **keyless** via Workload Identity Federation — no service-account JSON is
stored in GitHub. Backend env vars already live on the Cloud Run service and are
**preserved across deploys**, so no secrets are needed in the pipeline. Pull
requests run CI only (no deploy).

One-time GCP setup (already done for this project): a `github-deployer` service
account with `run.admin` + build/storage/artifact roles, a `github-pool`
workload-identity pool, and a GitHub OIDC provider restricted to `Arsh-10/aitechh`.

## Troubleshooting

- **Build fails on npm**: make sure `frontend/.env.production` exists (it does).
- **App loads but API 500s**: check `SUPABASE_SERVICE_KEY` in `env.deploy.yaml`.
- **Logs**: `gcloud run services logs read aitech --region europe-west1 --limit 50`
- **Costs**: Cloud Run scales to zero; with the $300 trial you won't come close.
