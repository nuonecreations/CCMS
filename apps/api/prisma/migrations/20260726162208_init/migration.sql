-- CreateTable
CREATE TABLE "worksites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name_si" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_number" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,
    "worksite_code" TEXT NOT NULL,
    "worksite_id" INTEGER NOT NULL,
    "customer_name" TEXT,
    "address" TEXT,
    "mobile_number" TEXT,
    "category_code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "customers_worksite_id_fkey" FOREIGN KEY ("worksite_id") REFERENCES "worksites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "arrears_imports" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "file_name" TEXT NOT NULL,
    "report_period" TEXT,
    "source_region" TEXT,
    "total_records" INTEGER NOT NULL,
    "valid_records" INTEGER NOT NULL,
    "invalid_records" INTEGER NOT NULL,
    "imported_by" TEXT,
    "imported_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "arrears_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "import_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "total_due" DECIMAL,
    "pending_payment" DECIMAL,
    "arrears_amount" DECIMAL,
    "last_payment_date" DATETIME,
    "payment_date" DATETIME,
    "snapshot_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    CONSTRAINT "arrears_snapshots_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "arrears_imports" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "arrears_snapshots_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calls" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "call_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "call_type" TEXT NOT NULL,
    "callOutcome" TEXT NOT NULL,
    "notes" TEXT,
    "next_followup_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calls_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_commitments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "call_id" INTEGER,
    "promised_amount" DECIMAL NOT NULL,
    "promise_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROMISED',
    "actual_payment_date" DATETIME,
    "notes" TEXT,
    CONSTRAINT "payment_commitments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_commitments_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "complaint_number" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "assigned_to" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    CONSTRAINT "complaints_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" INTEGER NOT NULL,
    "followup_date" DATETIME NOT NULL,
    "assigned_to" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "completed_at" DATETIME,
    CONSTRAINT "follow_ups_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_row_errors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "import_id" INTEGER NOT NULL,
    "row_number" INTEGER NOT NULL,
    "account_no" TEXT,
    "error_code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "raw_data" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "worksites_code_key" ON "worksites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_account_number_key" ON "customers"("account_number");

-- CreateIndex
CREATE INDEX "customers_worksite_id_idx" ON "customers"("worksite_id");

-- CreateIndex
CREATE INDEX "customers_region_code_idx" ON "customers"("region_code");

-- CreateIndex
CREATE INDEX "customers_worksite_code_idx" ON "customers"("worksite_code");

-- CreateIndex
CREATE INDEX "arrears_snapshots_customer_id_snapshot_date_idx" ON "arrears_snapshots"("customer_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "arrears_snapshots_priority_idx" ON "arrears_snapshots"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "arrears_snapshots_import_id_customer_id_key" ON "arrears_snapshots"("import_id", "customer_id");

-- CreateIndex
CREATE INDEX "calls_customer_id_call_date_idx" ON "calls"("customer_id", "call_date");

-- CreateIndex
CREATE INDEX "payment_commitments_customer_id_status_idx" ON "payment_commitments"("customer_id", "status");

-- CreateIndex
CREATE INDEX "payment_commitments_promise_date_status_idx" ON "payment_commitments"("promise_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_complaint_number_key" ON "complaints"("complaint_number");

-- CreateIndex
CREATE INDEX "complaints_customer_id_status_idx" ON "complaints"("customer_id", "status");

-- CreateIndex
CREATE INDEX "complaints_status_priority_idx" ON "complaints"("status", "priority");

-- CreateIndex
CREATE INDEX "follow_ups_followup_date_status_idx" ON "follow_ups"("followup_date", "status");

-- CreateIndex
CREATE INDEX "import_row_errors_import_id_idx" ON "import_row_errors"("import_id");
