#!/bin/bash
# Déploiement Batonnage → Cloud Run + Cloud Storage (données persistantes)
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
set -e

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${2:-europe-west1}"
SERVICE_NAME="batonnage"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"
BUCKET_NAME="${PROJECT_ID}-batonnage-data"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Aucun projet GCP trouvé."
  echo "Usage: ./deploy.sh MON_PROJECT_ID [REGION]"
  echo "  ou:  gcloud config set project MON_PROJECT_ID && ./deploy.sh"
  exit 1
fi

echo "========================================"
echo "  Déploiement Batonnage sur Cloud Run"
echo "  Projet : $PROJECT_ID"
echo "  Région : $REGION"
echo "========================================"

# 1. APIs nécessaires
echo ""
echo "▶ Activation des APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  --project "$PROJECT_ID"

# 2. Bucket GCS pour SQLite + uploads (créé une seule fois)
echo ""
echo "▶ Vérification du bucket de données..."
if ! gcloud storage buckets describe "gs://$BUCKET_NAME" --project "$PROJECT_ID" &>/dev/null; then
  echo "  Création du bucket gs://$BUCKET_NAME ..."
  gcloud storage buckets create "gs://$BUCKET_NAME" \
    --location "$REGION" \
    --project "$PROJECT_ID"
  echo "  ✅ Bucket créé"
else
  echo "  ✅ Bucket existant réutilisé"
fi

# 3. Build de l'image Docker via Cloud Build
echo ""
echo "▶ Build de l'image Docker (Cloud Build)..."
gcloud builds submit \
  --tag "$IMAGE" \
  --project "$PROJECT_ID" \
  .

# 4. Déploiement Cloud Run
#
#  --min-instances 1          → évite le cold-start (le fichier SQLite doit rester en mémoire)
#  --add-volume type=gcs      → monte le bucket GCS à /data (persistance SQLite + uploads)
#  DATA_DIR=/data             → sql.js lit/écrit le .db dans ce dossier monté
#  COOKIE_SECURE=true         → cookies sécurisés (HTTPS obligatoire sur Cloud Run)
#
# ⚠️  Après le premier déploiement, récupère l'URL du service puis relance avec :
#      FRONTEND_URL=https://... APP_URL=https://... ./deploy.sh
#      pour activer le CORS et le callback Azure SSO.
#
echo ""
echo "▶ Déploiement sur Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --port 8080 \
  --min-instances 1 \
  --max-instances 5 \
  --memory 512Mi \
  --cpu 1 \
  --allow-unauthenticated \
  --add-volume "name=data,type=cloud-storage,bucket=$BUCKET_NAME" \
  --add-volume-mount "volume=data,mount-path=/data" \
  --set-env-vars "NODE_ENV=production,DATA_DIR=/data,COOKIE_SECURE=true${FRONTEND_URL:+,FRONTEND_URL=$FRONTEND_URL}${APP_URL:+,APP_URL=$APP_URL}" \
  --project "$PROJECT_ID"

echo ""
echo "========================================"
echo "✅ Déploiement terminé !"
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format "value(status.url)")
echo "🌐 URL : $SERVICE_URL"
echo ""
echo "⚠️  Si c'est le premier déploiement, relance le script avec l'URL :"
echo "   FRONTEND_URL=$SERVICE_URL APP_URL=$SERVICE_URL ./deploy.sh $PROJECT_ID $REGION"
echo "========================================"
