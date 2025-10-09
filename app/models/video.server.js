import  prisma  from "../db.server";
import { deleteVideoFromFirebase } from "../utils/firebase.server";

export async function createVideo(data) {
  console.log('createVideo called with data:', data);
  console.log('Prisma client exists:', !!prisma);
  console.log('Prisma.video exists:', !!prisma?.video);
  

  if (!prisma) {
    console.error('CRITICAL: Prisma client is undefined! Check your import path in video.server.js');
    throw new Error('Prisma client not initialized');
  }
  
  try {
    const videoUrl = typeof data.videoUrl === 'object' ? data.videoUrl.videoUrl : data.videoUrl;
    const thumbnailUrl = typeof data.thumbnailUrl === 'object' ? data.thumbnailUrl.videoUrl : data.thumbnailUrl;
    
    console.log('Clean URLs - videoUrl:', videoUrl, 'thumbnailUrl:', thumbnailUrl);
    
    const video = await prisma.video.create({
      data: {
        title: data.title,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        firebasePath: data.firebasePath,
        source: data.source || 'upload',
        duration: data.duration || null,
      },
    });
    console.log('Video created successfully:', video);
    return video;
  } catch (error) {
    console.error('Error creating video:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    throw error;
  }
}

export async function getVideos() {
  console.log('getVideos called');
  console.log('Prisma client exists:', !!prisma);
  console.log('Prisma.video exists:', !!prisma?.video);
  
  if (!prisma) {
    console.error('CRITICAL: Prisma client is undefined in getVideos!');
    return [];
  }
  
  try {
    const videos = await prisma.video.findMany({
      include: {
        videoProducts: {
          include: {
            product: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    console.log('getVideos result:', videos);
    return videos;
  } catch (error) {
    console.error('Error in getVideos:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return [];
  }
}

export async function getVideoById(id) {
  if (!prisma) return null;
  
  try {
    return await prisma.video.findUnique({
      where: { id },
      include: {
        videoProducts: {
          include: {
            product: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
  } catch (error) {
    console.error('Error in getVideoById:', error);
    return null;
  }
}

export async function searchVideos(query) {
  if (!prisma) return [];
  
  try {
    return await prisma.video.findMany({
      where: {
        videoProducts: {
          some: {
            product: {
              title: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
        },
      },
      include: {
        videoProducts: {
          include: {
            product: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    console.error('Error in searchVideos:', error);
    return [];
  }
}

export async function updateVideo(id, data) {
  return await prisma.video.update({
    where: { id },
    data: {
      title: data.title,
      thumbnailUrl: data.thumbnailUrl,
      duration: data.duration,
    },
  });
}

export async function deleteVideo(id) {
  const video = await prisma.video.findUnique({
    where: { id },
    select: { firebasePath: true },
  });
  
  if (video?.firebasePath) {
    try {
      await deleteVideoFromFirebase(video.firebasePath);
    } catch (error) {
      console.error('Failed to delete video from Firebase:', error);
    }
  }
  
  return await prisma.video.delete({
    where: { id },
  });
}

export async function attachProductToVideo(videoId, productId, position = 0) {
  return await prisma.videoProduct.create({
    data: {
      videoId,
      productId,
      position,
    },
  });
}

export async function detachProductFromVideo(videoId, productId) {
  return await prisma.videoProduct.delete({
    where: {
      videoId_productId: {
        videoId,
        productId,
      },
    },
  });
}

export async function getVideosByProduct(productId) {
  return await prisma.video.findMany({
    where: {
      videoProducts: {
        some: {
          productId,
        },
      },
    },
    include: {
      videoProducts: {
        include: {
          product: true,
        },
      },
    },
  });
}