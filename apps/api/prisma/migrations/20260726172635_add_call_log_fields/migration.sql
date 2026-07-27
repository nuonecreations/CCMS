-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_calls" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "call_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "call_type" TEXT NOT NULL,
    "callOutcome" TEXT NOT NULL,
    "notes" TEXT,
    "customer_response" TEXT,
    "assigned_section" TEXT,
    "final_status" TEXT NOT NULL DEFAULT 'OPEN',
    "next_followup_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calls_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_calls" ("callOutcome", "call_date", "call_type", "created_at", "customer_id", "id", "next_followup_date", "notes") SELECT "callOutcome", "call_date", "call_type", "created_at", "customer_id", "id", "next_followup_date", "notes" FROM "calls";
DROP TABLE "calls";
ALTER TABLE "new_calls" RENAME TO "calls";
CREATE INDEX "calls_customer_id_call_date_idx" ON "calls"("customer_id", "call_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
