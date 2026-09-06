# Phase 9 Deployment Runbook

This is the deployment path to use for this repo. It supersedes the older
manual-block commands in `plans/phase-9/plan.md` where they conflict.

Use PowerShell for the commands below. Do not paste the Gemini API key into a
shell command; create or rotate it in the Secret Manager console, or pipe it
through stdin only.

## 0. Required Values

Set these once in PowerShell:

```powershell
$PROJECT_ID = "<your-gcp-and-firebase-project-id>"
$REGION = "asia-south1" # decided at first deploy (2026-09-06); Firestore/Cloud Run/Storage/Artifact Registry all pinned here — keep stable
$SERVICE = "ai-scientific-journal"
$REPOSITORY = "ai-scientific-journal"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/app:v1"
$SA_EMAIL = "ai-scientific-journal-runtime@$PROJECT_ID.iam.gserviceaccount.com"
```

Firebase and Google Cloud should use the same project ID. Choose the region
before creating Firestore, because the Firestore location is not cheaply
changed later.

## 1. Local Preflight

```powershell
gcloud auth login
gcloud auth list
gcloud --version
firebase --version
node --version
git status --short --branch
```

Expected: `gcloud`, `firebase`, and Node are installed; `gcloud auth list`
shows the intended account as active; the branch is not `main`; no `.env`
files are tracked. Run repository-dependent commands from the project root,
where `Dockerfile` and `firebase.json` exist.

## 2. Create Or Select The Cloud Project

For a new project:

```powershell
gcloud projects create $PROJECT_ID --name="AI Scientific Journal"
gcloud config set project $PROJECT_ID
```

For an existing project:

```powershell
gcloud config set project $PROJECT_ID
```

Link billing in the Google Cloud console, or with:

```powershell
gcloud billing projects link $PROJECT_ID --billing-account="<billing-account-id>"
```

## 3. Enable APIs

```powershell
gcloud services enable `
  run.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  secretmanager.googleapis.com `
  iamcredentials.googleapis.com `
  firestore.googleapis.com `
  firebase.googleapis.com `
  identitytoolkit.googleapis.com `
  storage.googleapis.com `
  logging.googleapis.com `
  monitoring.googleapis.com
```

## 4. Add Firebase, Auth, And Firestore

```powershell
firebase login
firebase projects:addfirebase $PROJECT_ID
```

Then in the Firebase console:

- Authentication: enable Google sign-in and set a support email.
- Firestore: create the database in production mode, in `$REGION`.
- Register a web app named `ai-scientific-journal-web`.

Copy these public Firebase web values for the build:

```powershell
$VITE_FIREBASE_API_KEY = "<firebase-web-api-key>"
$VITE_FIREBASE_AUTH_DOMAIN = "$PROJECT_ID.firebaseapp.com"
$VITE_FIREBASE_PROJECT_ID = $PROJECT_ID
$VITE_FIREBASE_APP_ID = "<firebase-web-app-id>"
```

These are public web identifiers, not backend secrets. Vite embeds them during
the Docker build.

## 5. Create Artifact Registry

```powershell
gcloud artifacts repositories create $REPOSITORY `
  --repository-format=docker `
  --location=$REGION
```

If it already exists, continue.

## 6. Create Runtime Service Account

```powershell
gcloud iam service-accounts create ai-scientific-journal-runtime `
  --display-name="ai-scientific-journal runtime"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$SA_EMAIL" `
  --role="roles/datastore.user"
```

Do not grant `roles/owner` or `roles/editor` to this service account.

## 7. Configure Cloud Build Identity

The build identity is separate from `$SA_EMAIL`, which runs the application.
Check the default Cloud Build service account:

```powershell
$BUILD_SA = gcloud builds get-default-service-account --project=$PROJECT_ID
$BUILD_SA
```

Grant it permission to push to this Artifact Registry repository and write
Cloud Build logs:

```powershell
gcloud artifacts repositories add-iam-policy-binding $REPOSITORY `
  --location=$REGION `
  --member="serviceAccount:$BUILD_SA" `
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$BUILD_SA" `
  --role="roles/logging.logWriter"
```

The Cloud Build config uses `options.logging: CLOUD_LOGGING_ONLY`, so no
separate logs bucket permission is required for the MVP path.

## 8. Create Or Rotate The Gemini Secret

Recommended first setup: create `gemini-api-key` in the Secret Manager console
and paste the regenerated Gemini key there. Treat any key previously pasted
into chat or committed locally as exposed and revoke it.

Then grant this runtime service account access to this secret only:

```powershell
gcloud secrets add-iam-policy-binding gemini-api-key `
  --project=$PROJECT_ID `
  --member="serviceAccount:$SA_EMAIL" `
  --role="roles/secretmanager.secretAccessor"
```

## 9. Create Private Media Bucket

```powershell
gcloud storage buckets create "gs://$PROJECT_ID-media" `
  --location=$REGION `
  --uniform-bucket-level-access `
  --public-access-prevention

gcloud storage buckets add-iam-policy-binding "gs://$PROJECT_ID-media" `
  --member="serviceAccount:$SA_EMAIL" `
  --role="roles/storage.objectAdmin"
```

Signed media read URLs use service-account signing. Allow the runtime service
account to sign as itself:

```powershell
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL `
  --member="serviceAccount:$SA_EMAIL" `
  --role="roles/iam.serviceAccountTokenCreator"
```

## 10. Deploy Firestore Rules And Indexes

Run this before public Cloud Run exposure:

```powershell
firebase deploy --only "firestore:rules,firestore:indexes" --project $PROJECT_ID
```

Wait for required Firestore indexes to finish building before testing retrieval
or RAG behavior.

## 11. Build The Image With Firebase Web Config

This repo uses `infrastructure/cloud-run/cloudbuild.yaml` so Vite receives the
production Firebase config during the Docker build.

```powershell
gcloud builds submit . `
  --config infrastructure/cloud-run/cloudbuild.yaml `
  --substitutions "_IMAGE=$IMAGE,_VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY,_VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN,_VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID,_VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID"
```

`.gcloudignore` and `.dockerignore` exclude `.env`, `.env.production`, service
account files, credentials, `node_modules`, and build output.

## 12. Deploy Cloud Run

The first deploy does not yet know its final service URL, so CORS uses a
temporary non-localhost value. This value passes startup validation, but lock
CORS to the actual Cloud Run URL before browser testing.

```powershell
gcloud run deploy $SERVICE `
  --image $IMAGE `
  --region $REGION `
  --service-account $SA_EMAIL `
  --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=$PROJECT_ID,STORAGE_BUCKET=$PROJECT_ID-media,CORS_ORIGIN=https://placeholder.invalid,USE_FAKE_AI=false" `
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" `
  --labels "dev-tutorial=cloud-run-ai-challenge" `
  --allow-unauthenticated `
  --port 8080 `
  --timeout 60
```

The backend's Gemini call timeout defaults to 30 seconds (`AI_TIMEOUT_MS`), so a
60-second Cloud Run request timeout gives first-deploy headroom for retrieval
and request overhead without hiding slow failures.

Record the service URL:

```powershell
$SERVICE_URL = gcloud run services describe $SERVICE `
  --region $REGION `
  --format="value(status.url)"
```

Lock CORS to the Cloud Run origin:

```powershell
gcloud run services update $SERVICE `
  --region $REGION `
  --update-env-vars "CORS_ORIGIN=$SERVICE_URL"
```

## 13. Add Firebase Authorized Domain

Firebase console -> Authentication -> Settings -> Authorized domains -> add the
Cloud Run hostname only, without `https://`.

Example:

```text
ai-scientific-journal-xxxxx-uc.a.run.app
```

For local testing, Firebase wants `localhost`, not `http://localhost:8080`.

## 14. Smoke Test

```powershell
node scripts/smoke-test.mjs $SERVICE_URL

gcloud run services describe $SERVICE `
  --region $REGION `
  --format="value(metadata.labels)"
```

Then verify in the browser:

- App loads on `$SERVICE_URL`.
- Google sign-in and logout work.
- Create an observation, refresh, and confirm it persists.
- Chat works with real Gemini.
- Structured analysis is generated and shown.
- Retrieval works with known observations.
- Upload and view media.
- Use a second account to confirm it cannot access the first account's data.
- The label `dev-tutorial=cloud-run-ai-challenge` is present.

## 15. Troubleshooting Commands

```powershell
gcloud run services logs read $SERVICE --region $REGION --limit 100

gcloud run revisions list --service $SERVICE --region $REGION

gcloud secrets versions list gemini-api-key --project $PROJECT_ID

gcloud storage buckets describe "gs://$PROJECT_ID-media"
```

If the SPA loads but sign-in points at the demo Firebase project, rebuild the
image with the Firebase substitutions in step 10 and redeploy step 11.
