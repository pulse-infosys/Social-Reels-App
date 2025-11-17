/*
  Warnings:

  - You are about to drop the column `widgetType` on the `VideoPage` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
