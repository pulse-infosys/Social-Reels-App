import db from "../db.server";

export async function getVideoPages() {
  const videoPages = await db.videoPage.findMany({
    include: {
      pageVideos: {
        include: {
          video: {
            include: {
              videoProducts: {
                include: {
                  product: true
                }
              }
            }
          }
        },
        orderBy: {
          position: 'asc'
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  return videoPages;
}

export async function getVideoPageById(id) {
  const videoPage = await db.videoPage.findUnique({
    where: { id },
    include: {
      pageVideos: {
        include: {
          video: {
            include: {
              videoProducts: {
                include: {
                  product: true
                }
              }
            }
          }
        },
        orderBy: {
          position: 'asc'
        }
      }
    }
  });
  
  return videoPage;
}

export async function createVideoPage({ name, widgetType, pagePath, videoIds }) {
  const videoPage = await db.videoPage.create({
    data: {
      name,
      widgetType,
      pagePath,
      status: 'live',
      pageVideos: {
        create: videoIds.map((videoId, index) => ({
          videoId,
          position: index
        }))
      }
    },
    include: {
      pageVideos: {
        include: {
          video: true
        }
      }
    }
  });
  
  return videoPage;
}

export async function updateVideoPage(id, { name, widgetType, pagePath, status }) {
  const videoPage = await db.videoPage.update({
    where: { id },
    data: {
      name,
      widgetType,
      pagePath,
      status,
      updatedAt: new Date()
    }
  });
  
  return videoPage;
}

export async function deleteVideoPage(id) {
  await db.videoPage.delete({
    where: { id }
  });
}

export async function addVideosToPage(pageId, videoIds) {
  // Get the current max position
  const currentVideos = await db.pageVideo.findMany({
    where: { pageId },
    orderBy: { position: 'desc' },
    take: 1
  });
  
  const startPosition = currentVideos.length > 0 ? currentVideos[0].position + 1 : 0;
  
  // Create new page video associations
  await db.pageVideo.createMany({
    data: videoIds.map((videoId, index) => ({
      pageId,
      videoId,
      position: startPosition + index
    })),
    skipDuplicates: true
  });
}

export async function removeVideoFromPage(pageId, videoId) {
  await db.pageVideo.deleteMany({
    where: {
      pageId,
      videoId
    }
  });
}

export async function updateVideoPositions(pageId, videoPositions) {
  // videoPositions is an array of { videoId, position }
  await Promise.all(
    videoPositions.map(({ videoId, position }) =>
      db.pageVideo.updateMany({
        where: {
          pageId,
          videoId
        },
        data: {
          position
        }
      })
    )
  );
}