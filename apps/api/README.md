# CCMS API – Milestone 1

## Implemented
- Account number parser for `XX/XX/XXX/XXX/XX`
- Active region filtering (`31`)
- 17-worksite master data
- Excel arrears report header detection
- Excel import preview endpoint: `POST /imports/arrears/preview`
- Worksite classification from account number segment 2
- Import summary: total records, active-region records, invalid records, total arrears, worksite breakdown

## Run
```bash
npm install
npm run prisma:generate
npm run start:dev
```

Upload field name: `file`
