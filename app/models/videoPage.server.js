import prisma from "../db.server";


export async function getVideoPages() {
  return await prisma.videoPage.findMany({
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
}

export async function getVideoPageById(id) {
  return await prisma.videoPage.findUnique({
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
        }
      }
    }
  });
}

export async function createVideoPage(data) {
  return await prisma.videoPage.create({
    data: {
      name: data.name,
      pagePath: data.pagePath,
      widgetType: data.widgetType,
      status: 'draft'
    }
  });
}

export async function addVideosToPage(pageId, videoIds) {
  const pageVideos = await Promise.all(
    videoIds.map((videoId, index) =>
      prisma.pageVideo.upsert({
        where: {
          pageId_videoId: {
            pageId,
            videoId
          }
        },
        update: {
          position: index
        },
        create: {
          pageId,
          videoId,
          position: index
        }
      })
    )
  );
  
  return pageVideos;
}

export async function updatePageStatus(id, status) {
  return await prisma.videoPage.update({
    where: { id },
    data: { status }
  });
}

export async function deleteVideoPage(id) {
  return await prisma.videoPage.delete({
    where: { id }
  });
}