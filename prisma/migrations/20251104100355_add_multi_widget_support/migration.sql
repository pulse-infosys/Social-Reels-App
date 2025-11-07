-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT,
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
INSERT INTO "new_Video" ("createdAt", "duration", "firebasePath", "id", "processingProgress", "processingStatus", "shop", "source", "thumbnailUrl", "title", "updatedAt", "videoUrl") SELECT "createdAt", "duration", "firebasePath", "id", "processingProgress", "processingStatus", "shop", "source", "thumbnailUrl", "title", "updatedAt", "videoUrl" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE INDEX "Video_shop_idx" ON "Video"("shop");
CREATE TABLE "new_VideoPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT,
    "name" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "pageHandle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VideoPage" ("createdAt", "id", "name", "pageHandle", "pagePath", "shop", "updatedAt") SELECT "createdAt", "id", "name", "pageHandle", "pagePath", "shop", "updatedAt" FROM "VideoPage";
DROP TABLE "VideoPage";
ALTER TABLE "new_VideoPage" RENAME TO "VideoPage";
CREATE INDEX "VideoPage_shop_idx" ON "VideoPage"("shop");
CREATE UNIQUE INDEX "VideoPage_shop_pagePath_key" ON "VideoPage"("shop", "pagePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
