#!/usr/bin/env bash
# One-time GCP setup for app monitoring (safe to re-run).
#
#   1. Enables the APIs
#   2. Workload Identity Federation pool "app-logging" that trusts Firebase
#      Auth ID tokens, so the app can write to Cloud Logging directly
#      (no Cloud Function, no key in the app). Writers get logWriter only.
#   3. Log-based metrics + the "The Big Race — App Health" dashboard
#   4. Uploads the re-encoded videos (videos/encoded) to Firebase Storage
#
# Prereqs:  gcloud auth login   (with an Owner/Editor account on the project)
# Usage:    gcp/setup.sh [--skip-videos]
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_ID=triptailor-71050
PROJECT_NUMBER=138789959645
POOL=app-logging
PROVIDER=firebase
BUCKET=gs://triptailor-71050.firebasestorage.app
G="gcloud --project=$PROJECT_ID --quiet"

echo "▸ Enabling APIs"
$G services enable iam.googleapis.com sts.googleapis.com logging.googleapis.com monitoring.googleapis.com

echo "▸ Workload Identity pool + Firebase provider"
if ! $G iam workload-identity-pools describe $POOL --location=global >/dev/null 2>&1; then
  $G iam workload-identity-pools create $POOL --location=global \
    --display-name="App logging" \
    --description="Lets signed-in app users write to Cloud Logging (logWriter only)"
fi
if ! $G iam workload-identity-pools providers describe $PROVIDER --location=global --workload-identity-pool=$POOL >/dev/null 2>&1; then
  $G iam workload-identity-pools providers create-oidc $PROVIDER --location=global \
    --workload-identity-pool=$POOL \
    --issuer-uri="https://securetoken.google.com/$PROJECT_ID" \
    --allowed-audiences="$PROJECT_ID" \
    --attribute-mapping="google.subject=assertion.sub" \
    --attribute-condition="assertion.aud == '$PROJECT_ID'"
fi

echo "▸ Granting roles/logging.logWriter to the pool"
$G projects add-iam-policy-binding $PROJECT_ID \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/*" \
  --role=roles/logging.logWriter --condition=None >/dev/null

echo "▸ Log-based metrics"
for f in gcp/metrics/*.yaml; do
  name=$(basename "$f" .yaml)
  if $G logging metrics describe "$name" >/dev/null 2>&1; then
    $G logging metrics update "$name" --config-from-file="$f" >/dev/null
  else
    $G logging metrics create "$name" --config-from-file="$f" >/dev/null
  fi
  echo "  ✓ $name"
done

echo "▸ Dashboard"
existing=$($G monitoring dashboards list --format='value(name,displayName)' | awk -F'\t' '$2=="The Big Race — App Health"{print $1; exit}')
if [[ -n "$existing" ]]; then
  etag=$($G monitoring dashboards describe "$existing" --format='value(etag)')
  python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); d["etag"]=sys.argv[2]; json.dump(d,open(sys.argv[3],"w"))' \
    gcp/dashboard.json "$etag" /tmp/tbr-dashboard.json
  $G monitoring dashboards update "$existing" --config-from-file=/tmp/tbr-dashboard.json >/dev/null
else
  $G monitoring dashboards create --config-from-file=gcp/dashboard.json >/dev/null
fi
echo "  ✓ https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"

if [[ "${1:-}" != "--skip-videos" ]]; then
  echo "▸ Uploading re-encoded videos (new names — the old files are left untouched)"
  for f in videos/encoded/*/*.mp4; do
    lang=$(basename "$(dirname "$f")"); key=$(basename "$f" .mp4)
    gcloud storage cp "$f" "$BUCKET/race_v2_${lang}_${key}.mp4" \
      --content-type=video/mp4 --cache-control="public, max-age=31536000" --quiet
  done
  echo "▸ Checking one upload is publicly readable like the old videos"
  curl -sI "https://firebasestorage.googleapis.com/v0/b/triptailor-71050.firebasestorage.app/o/race_v2_en_v1.mp4?alt=media" | head -1
fi

echo "✓ Done"
