CREATE TABLE "RecentLocation" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RecentLocation_usedAt_idx" ON "RecentLocation"("usedAt");
