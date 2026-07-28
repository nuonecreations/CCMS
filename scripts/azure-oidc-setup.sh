#!/usr/bin/env bash
set -euo pipefail

APP_NAME="nwsdbcallcenter"
GITHUB_REPO="nuonecreations/CCMS"
GITHUB_BRANCH="main"
GITHUB_SECRET_CLIENT_ID="AZUREAPPSERVICE_CLIENTID_A19AE181128142B48BEF63E489B3D6C6"
GITHUB_SECRET_TENANT_ID="AZUREAPPSERVICE_TENANTID_74B564F81F9540F1BCF5F3F7FFEA4296"
GITHUB_SECRET_SUBSCRIPTION_ID="AZUREAPPSERVICE_SUBSCRIPTIONID_F56DD8BBB20F475CBE144862EADFD4A6"

TENANT_ID="b1d18611-91b1-46a1-a409-9e0d92d3dc11"
SUBSCRIPTION_ID="6fdcaca9-de99-4402-81da-518487a24ae5"

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI is required."
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI is required."
  exit 1
fi

echo "Using Azure tenant: ${TENANT_ID}"
echo "Using Azure subscription: ${SUBSCRIPTION_ID}"
echo "Using GitHub repo: ${GITHUB_REPO}"
echo "Using branch: ${GITHUB_BRANCH}"
echo "Using Azure AD app name: ${APP_NAME}"

echo "Checking Azure login..."
az account show > /dev/null

echo "Looking up or creating Azure AD application..."
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv || true)

if [[ -z "$APP_ID" ]]; then
  echo "Creating Azure AD application named $APP_NAME..."
  APP_ID=$(az ad app create \
    --display-name "$APP_NAME" \
    --sign-in-audience AzureADMyOrg \
    --query appId -o tsv)
  echo "Created app ID: $APP_ID"
else
  echo "Found existing app ID: $APP_ID"
fi

APP_OBJECT_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].id" -o tsv)
if [[ -z "$APP_OBJECT_ID" ]]; then
  echo "ERROR: Unable to resolve Azure AD app object ID for $APP_NAME"
  exit 1
fi

echo "Creating federated identity credential..."
az rest --method PUT \
  --uri "https://graph.microsoft.com/v1.0/applications/${APP_OBJECT_ID}/federatedIdentityCredentials/github-actions-main" \
  --headers "Content-Type=application/json" \
  --body @- <<'EOF'
{
  "name": "github-actions-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:nuonecreations/CCMS:ref:refs/heads/main",
  "description": "GitHub Actions OIDC for CCMS main branch",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF

echo "Federated identity credential created."

echo "Setting GitHub secrets..."
gh secret set "$GITHUB_SECRET_CLIENT_ID" --body "$APP_ID" --repo "$GITHUB_REPO"
gh secret set "$GITHUB_SECRET_TENANT_ID" --body "$TENANT_ID" --repo "$GITHUB_REPO"
gh secret set "$GITHUB_SECRET_SUBSCRIPTION_ID" --body "$SUBSCRIPTION_ID" --repo "$GITHUB_REPO"

echo "Done."
