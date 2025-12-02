-- AlterTable
ALTER TABLE "Product" ADD COLUMN "productUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "variantId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WidgetVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "widgetId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WidgetVideo_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "Widget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WidgetVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WidgetVideo" ("createdAt", "id", "position", "videoId", "widgetId") SELECT "createdAt", "id", "position", "videoId", "widgetId" FROM "WidgetVideo";
DROP TABLE "WidgetVideo";
ALTER TABLE "new_WidgetVideo" RENAME TO "WidgetVideo";
CREATE INDEX "WidgetVideo_widgetId_idx" ON "WidgetVideo"("widgetId");
CREATE INDEX "WidgetVideo_videoId_idx" ON "WidgetVideo"("videoId");
CREATE UNIQUE INDEX "WidgetVideo_widgetId_videoId_key" ON "WidgetVideo"("widgetId", "videoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
