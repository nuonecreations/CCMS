# CCMS Starter v0.4 — Milestone 3

## Added
- React + Vite + TypeScript web dashboard
- CCMS navigation shell
- Dashboard with worksite distribution
- Arrears Excel upload UI
- Preview workflow
- Region 31 validation summary
- Worksite breakdown
- Confirm Import action connected to NestJS API

## Run

### Backend
```bash
docker compose up -d
cd apps/api
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

### Frontend
```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:5173`.

Optional API URL:
```bash
VITE_API_BASE_URL=http://localhost:3000
```

## Azure deployment

This repo is configured to deploy to Azure App Service via GitHub Actions.

1. Push to `main`.
2. The workflow `.github/workflows/main_nwsdbcallcenter.yml` will:
   - checkout the repo
   - run `npm ci`
   - run `npm run build`
   - log in to Azure using configured secrets
   - deploy the app to `nwsdbcallcenter`

The app is served from the Nest API at `/`, and the frontend calls the API under `/api` in production.

If you need to run locally with Azure-style startup:
```bash
npm start
```
