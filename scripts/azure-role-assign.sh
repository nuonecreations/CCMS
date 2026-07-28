#!/usr/bin/env bash
set -euo pipefail

APP_NAME="nwsdbcallcenter"
RESOURCE_GROUP="CCMS-App-RG"
WEBAPP_NAME="nwsdbcallcenter"
ROLE="Contributor"
TENANT_ID="b1d18611-91b1-46a1-a409-9e0d92d3dc11"
SUBSCRIPTION_ID="6fdcaca9-de99-4402-81da-518487a24ae5"

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI is required."
  exit 1
fi

echo "Using Azure tenant: ${TENANT_ID}"
echo "Using Azure subscription: ${SUBSCRIPTION_ID}"
echo "Using Azure app name: ${APP_NAME}"
echo "Using resource group: ${RESOURCE_GROUP}"
echo "Using web app name: ${WEBAPP_NAME}"

echo "Checking Azure login..."
az account show > /dev/null

APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv || true)
if [[ -z "$APP_ID" ]]; then
  echo "ERROR: Azure AD app '$APP_NAME' not found."
  exit 1
fi

SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query objectId -o tsv || true)
if [[ -z "$SP_OBJECT_ID" ]]; then
  echo "ERROR: Service principal for app ID $APP_ID not found."
  exit 1
fi

echo "Service principal object ID: $SP_OBJECT_ID"

echo "Assigning role '$ROLE' at resource group scope..."
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --role "$ROLE" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}"

echo "Assigning role '$ROLE' at App Service scope..."
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --role "$ROLE" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/${WEBAPP_NAME}"

echo "Role assignment complete."
