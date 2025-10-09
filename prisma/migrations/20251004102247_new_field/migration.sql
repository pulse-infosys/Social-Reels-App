/*
  Warnings:

  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT,
    "image" TEXT,
    "price" TEXT,
    "vendor" TEXT,
    "productType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("createdAt", "id", "image", "price", "shopifyId", "title") SELECT "createdAt", "id", "image", "price", "shopifyId", "title" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_shopifyId_key" ON "Product"("shopifyId");
CREATE TABLE "new_VideoPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VideoPage" ("createdAt", "id", "name", "pagePath", "status", "updatedAt", "widgetType") SELECT "createdAt", "id", "name", "pagePath", "status", "updatedAt", "widgetType" FROM "VideoPage";
DROP TABLE "VideoPage";
ALTER TABLE "new_VideoPage" RENAME TO "VideoPage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PageVideo_pageId_idx" ON "PageVideo"("pageId");

-- CreateIndex
CREATE INDEX "PageVideo_videoId_idx" ON "PageVideo"("videoId");

-- CreateIndex
CREATE INDEX "VideoProduct_videoId_idx" ON "VideoProduct"("videoId");

-- CreateIndex
CREATE INDEX "VideoProduct_productId_idx" ON "VideoProduct"("productId");
