-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "firebasePath" TEXT,
    "source" TEXT NOT NULL,
    "duration" INTEGER,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "processingProgress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Video" ("createdAt", "duration", "firebasePath", "id", "source", "thumbnailUrl", "title", "updatedAt", "videoUrl") SELECT "createdAt", "duration", "firebasePath", "id", "source", "thumbnailUrl", "title", "updatedAt", "videoUrl" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
