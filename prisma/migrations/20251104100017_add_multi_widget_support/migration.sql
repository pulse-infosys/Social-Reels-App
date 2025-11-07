/*
  Warnings:

  - You are about to drop the `PageVideo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `status` on the `VideoPage` table. All the data in the column will be lost.
  - You are about to drop the column `widgetType` on the `VideoPage` table. All the data in the column will be lost.
  - Added the required column `shop` to the `Video` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pageHandle` to the `VideoPage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop` to the `VideoPage` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PageVideo_videoId_idx";

-- DropIndex
DROP INDEX "PageVideo_pageId_idx";

-- DropIndex
DROP INDEX "PageVideo_pageId_videoId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PageVideo";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Widget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Widget_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "VideoPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WidgetVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "widgetId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WidgetVideo_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "Widget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WidgetVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
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
INSERT INTO "new_Video" ("createdAt", "duration", "firebasePath", "id", "processingProgress", "processingStatus", "source", "thumbnailUrl", "title", "updatedAt", "videoUrl") SELECT "createdAt", "duration", "firebasePath", "id", "processingProgress", "processingStatus", "source", "thumbnailUrl", "title", "updatedAt", "videoUrl" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE INDEX "Video_shop_idx" ON "Video"("shop");
CREATE TABLE "new_VideoPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "pageHandle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VideoPage" ("createdAt", "id", "name", "pagePath", "updatedAt") SELECT "createdAt", "id", "name", "pagePath", "updatedAt" FROM "VideoPage";
DROP TABLE "VideoPage";
ALTER TABLE "new_VideoPage" RENAME TO "VideoPage";
CREATE INDEX "VideoPage_shop_idx" ON "VideoPage"("shop");
CREATE UNIQUE INDEX "VideoPage_shop_pagePath_key" ON "VideoPage"("shop", "pagePath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Widget_pageId_idx" ON "Widget"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "Widget_pageId_widgetType_key" ON "Widget"("pageId", "widgetType");

-- CreateIndex
CREATE INDEX "WidgetVideo_widgetId_idx" ON "WidgetVideo"("widgetId");

-- CreateIndex
CREATE INDEX "WidgetVideo_videoId_idx" ON "WidgetVideo"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetVideo_widgetId_videoId_key" ON "WidgetVideo"("widgetId", "videoId");
