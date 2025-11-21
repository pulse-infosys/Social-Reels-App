// app/models/videoPage.server.js

import db from "../db.server";

/**
 * Get all video pages for a shop
 */
export async function getVideoPages(shop) {
  return await db.videoPage.findMany({
    where: { shop },
    include: {
      widgets: {
        include: {
          widgetVideos: {
            include: {
              video: {
                include: {
                  videoProducts: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
            orderBy: { position: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a single video page by ID for a shop
 */
export async function getVideoPageById(id, shop) {
  return await db.videoPage.findFirst({
    where: { id, shop },
    include: {
      widgets: {
        include: {
          widgetVideos: {
            include: {
              video: {
                include: {
                  videoProducts: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
}

/**
 * Create a new video page for a shop
 */
// export async function createVideoPage({ shop, name, pagePath, pageHandle, widgetType }) {
//   return await db.videoPage.create({
//     data: {
//       shop,
//       name,
//       pagePath,
//       pageHandle,
//       widgetType
//     },
//   });
// }


export async function createVideoPage({ shop, name, pagePath, pageHandle }) {
  return await db.videoPage.create({
    data: {
      shop,
      name,
      pagePath,
      pageHandle,
    },
  });
}

/**
 * Create a widget for a video page
 */
export async function createWidget(pageId, widgetType, videoIds, shop) {
  // First check if widget already exists
  const existingWidget = await db.widget.findFirst({
    where: {
      pageId,
      widgetType,
    },
  });

  if (existingWidget) {
    throw new Error(`${widgetType} widget already exists for this page`);
  }

  // Verify the page belongs to this shop
  const page = await db.videoPage.findFirst({
    where: { id: pageId, shop },
  });

  if (!page) {
    throw new Error("Video page not found or access denied");
  }

  // Create the widget with videos
  return await db.widget.create({
    data: {
      pageId,
      widgetType,
      isCreated: true,
      status: "draft",
      widgetVideos: {
        create: videoIds.map((videoId, index) => ({
          videoId,
          position: index,
        })),
      },
    },
    include: {
      widgetVideos: {
        include: {
          video: true,
        },
      },
    },
  });
}

/**
 * Update widget status (draft/live)
 */
export async function updateWidgetStatus(widgetId, status) {
  return await db.widget.update({
    where: { id: widgetId },
    data: { status },
  });
}

/**
 * Add videos to an existing widget
 */
// export async function addVideosToWidget(widgetId, videoIds) {
//   // Get the current max position
//   const maxPosition = await db.widgetVideo.findFirst({
//     where: { widgetId },
//     orderBy: { position: "desc" },
//     select: { position: true },
//   });

//   const startPosition = (maxPosition?.position || -1) + 1;

//   // Add new videos
//   const widgetVideos = videoIds.map((videoId, index) => ({
//     widgetId,
//     videoId,
//     position: startPosition + index,
//   }));

//   return await db.widgetVideo.createMany({
//     data: widgetVideos,
//     skipDuplicates: true, // Skip if video already exists in widget
//   });
// }

// app/models/videoPage.server.js

export async function addVideosToWidget(widgetId, videoIds) {
  if (!videoIds || videoIds.length === 0) return;

  // Safely get max position as integer
  const maxPositionResult = await db.widgetVideo.findFirst({
    where: { widgetId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  // Force integer + fallback to 0
  const lastPosition = maxPositionResult?.position ?? 0;
  const startPosition = Number.isInteger(lastPosition) ? lastPosition + 1 : 0;

  const widgetVideos = videoIds.map((videoId, index) => ({
    widgetId,
    videoId,
    position: startPosition + index, // Guaranteed integer
  }));

  return await db.widgetVideo.createMany({
    data: widgetVideos,
    // skipDuplicates: true,
  });
}
/**
 * Remove a video from a widget
 */
export async function removeVideoFromWidget(widgetId, videoId) {
  return await db.widgetVideo.deleteMany({
    where: {
      widgetId,
      videoId,
    },
  });
}

/**
 * Reorder videos in a widget
 */
export async function reorderWidgetVideos(widgetId, videoIds) {
  // Update positions based on new order
  const updates = videoIds.map((videoId, index) =>
    db.widgetVideo.updateMany({
      where: {
        widgetId,
        videoId,
      },
      data: {
        position: index,
      },
    })
  );

  return await db.$transaction(updates);
}

/**
 * Delete a widget
 */
export async function deleteWidget(widgetId) {
  return await db.widget.delete({
    where: { id: widgetId },
  });
}

/**
 * Delete a video page and all its widgets
 */
export async function deleteVideoPage(pageId, shop) {
  // Verify ownership
  const page = await db.videoPage.findFirst({
    where: { id: pageId, shop },
  });

  if (!page) {
    throw new Error("Video page not found or access denied");
  }

  return await db.videoPage.delete({
    where: { id: pageId },
  });
}



/**
 * Find or create a video page
 */
export async function findOrCreateVideoPage({ shop, name, pagePath, pageHandle }) {
  // Try to find existing page
  const existingPage = await db.videoPage.findFirst({
    where: {
      shop,
      pagePath,
    },
  });

  if (existingPage) {
    return existingPage;
  }

  // Create new page if doesn't exist
  return await db.videoPage.create({
    data: {
      shop,
      name,
      pagePath,
      pageHandle,
    },
  });
}