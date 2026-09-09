CREATE TABLE "DemoLocation" (
  "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "country" TEXT NOT NULL,
  "category" TEXT NOT NULL, "difficulty" TEXT NOT NULL, "image" TEXT NOT NULL,
  "lat" REAL NOT NULL, "lng" REAL NOT NULL, "description" TEXT NOT NULL,
  "source" TEXT NOT NULL, "credit" TEXT NOT NULL
);
CREATE TABLE "Match" (
  "id" TEXT NOT NULL PRIMARY KEY, "roomCode" TEXT NOT NULL,
  "finishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settings" TEXT NOT NULL, "players" TEXT NOT NULL, "results" TEXT NOT NULL
);
