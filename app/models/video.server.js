// // app/models/video.server.js
// import prisma from "../db.server";
// import { deleteVideoFromFirebase } from "../utils/firebase.server";

// export async function createVideo(data) {
//   console.log('createVideo called with data:', data);
//   console.log('Prisma client exists:', !!prisma);
//   console.log('Prisma.video exists:', !!prisma?.video);
  
//   if (!prisma) {
//     console.error('CRITICAL: Prisma client is undefined! Check your import path in video.server.js');
//     throw new Error('Prisma client not initialized');
//   }
  
//   try {
//     const videoUrl = typeof data.videoUrl === 'object' ? data.videoUrl.videoUrl : data.videoUrl;
//     const thumbnailUrl = typeof data.thumbnailUrl === 'object' ? data.thumbnailUrl.videoUrl : data.thumbnailUrl;
    
//     console.log('Clean URLs - videoUrl:', videoUrl, 'thumbnailUrl:', thumbnailUrl);
    
//     const video = await prisma.video.create({
//       data: {
//         title: data.title,
//         videoUrl: videoUrl,
//         thumbnailUrl: thumbnailUrl,
//         firebasePath: data.firebasePath,
//         source: data.source || 'upload',
//         duration: data.duration || null,
//         processingStatus: 'processing',
//         processingProgress: 0,
//       },
//     });
    
//     console.log('Video created successfully:', video);
    
//     // Start processing in background (simulated here - 5 seconds)
//     setTimeout(async () => {
//       try {
//         await updateVideoProcessingStatus(video.id, 'complete', 100);
//         console.log('Video processing completed:', video.id);
//       } catch (error) {
//         console.error('Error updating processing status:', error);
//       }
//     }, 5000);
    
//     return video;
//   } catch (error) {
//     console.error('Error creating video:', error);
//     console.error('Error details:', {
//       name: error.name,
//       message: error.message,
//       code: error.code,
//       meta: error.meta,
//     });
//     throw error;
//   }
// }

// export async function updateVideoProcessingStatus(videoId, status, progress) {
//   if (!prisma) return null;
  
//   try {
//     return await prisma.video.update({
//       where: { id: videoId },
//       data: {
//         processingStatus: status,
//         processingProgress: progress,
//       },
//     });
//   } catch (error) {
//     console.error('Error updating video processing status:', error);
//     return null;
//   }
// }

// export async function getVideos() {
//   console.log('getVideos called');
//   console.log('Prisma client exists:', !!prisma);
//   console.log('Prisma.video exists:', !!prisma?.video);
  
//   if (!prisma) {
//     console.error('CRITICAL: Prisma client is undefined in getVideos!');
//     return [];
//   }
  
//   try {
//     const videos = await prisma.video.findMany({
//       include: {
//         videoProducts: {
//           include: {
//             product: true,
//           },
//           orderBy: {
//             position: 'asc',
//           },
//         },
//       },
//       orderBy: {
//         createdAt: 'desc',
//       },
//     });
    
//     console.log('getVideos result:', videos.length, 'videos found');
//     return videos;
//   } catch (error) {
//     console.error('Error in getVideos:', error);
//     console.error('Error details:', {
//       name: error.name,
//       message: error.message,
//       code: error.code,
//       meta: error.meta,
//     });
//     return [];
//   }
// }

// export async function getVideoById(id) {
//   if (!prisma) return null;
  
//   try {
//     return await prisma.video.findUnique({
//       where: { id },
//       include: {
//         videoProducts: {
//           include: {
//             product: true,
//           },
//           orderBy: {
//             position: 'asc',
//           },
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Error in getVideoById:', error);
//     return null;
//   }
// }

// export async function searchVideos(query) {
//   if (!prisma) return [];
  
//   try {
//     return await prisma.video.findMany({
//       where: {
//         videoProducts: {
//           some: {
//             product: {
//               title: {
//                 contains: query,
//                 mode: 'insensitive',
//               },
//             },
//           },
//         },
//       },
//       include: {
//         videoProducts: {
//           include: {
//             product: true,
//           },
//           orderBy: {
//             position: 'asc',
//           },
//         },
//       },
//       orderBy: {
//         createdAt: 'desc',
//       },
//     });
//   } catch (error) {
//     console.error('Error in searchVideos:', error);
//     return [];
//   }
// }

// export async function updateVideo(id, data) {
//   if (!prisma) return null;
  
//   try {
//     return await prisma.video.update({
//       where: { id },
//       data: {
//         title: data.title,
//         thumbnailUrl: data.thumbnailUrl,
//         duration: data.duration,
//       },
//     });
//   } catch (error) {
//     console.error('Error in updateVideo:', error);
//     throw error;
//   }
// }

// export async function deleteVideo(id) {
//   if (!prisma) {
//     throw new Error('Prisma client not initialized');
//   }
  
//   try {
//     console.log('Deleting video:', id);
    
//     // First get video details
//     const video = await prisma.video.findUnique({
//       where: { id },
//       select: { 
//         firebasePath: true,
//         videoProducts: true 
//       },
//     });
    
//     if (!video) {
//       throw new Error('Video not found');
//     }
    
//     // Delete video from Firebase storage if path exists
//     if (video.firebasePath) {
//       try {
//         await deleteVideoFromFirebase(video.firebasePath);
//         console.log('Video deleted from Firebase:', video.firebasePath);
//       } catch (error) {
//         console.error('Failed to delete video from Firebase:', error);
//         // Continue with database deletion even if Firebase deletion fails
//       }
//     }
    
//     // Delete associated videoProducts first (if cascade is not set in schema)
//     if (video.videoProducts && video.videoProducts.length > 0) {
//       await prisma.videoProduct.deleteMany({
//         where: { videoId: id },
//       });
//       console.log('Deleted associated video products:', video.videoProducts.length);
//     }
    
//     // Finally delete the video from database
//     const deletedVideo = await prisma.video.delete({
//       where: { id },
//     });
    
//     console.log('Video deleted successfully from database:', id);
//     return deletedVideo;
    
//   } catch (error) {
//     console.error('Error in deleteVideo:', error);
//     console.error('Error details:', {
//       name: error.name,
//       message: error.message,
//       code: error.code,
//       meta: error.meta,
//     });
//     throw error;
//   }
// }

// export async function attachProductToVideo(videoId, productId, position = 0) {
//   if (!prisma) return null;
  
//   try {
//     return await prisma.videoProduct.create({
//       data: {
//         videoId,
//         productId,
//         position,
//       },
//     });
//   } catch (error) {
//     console.error('Error in attachProductToVideo:', error);
//     throw error;
//   }
// }

// export async function detachProductFromVideo(videoId, productId) {
//   if (!prisma) return null;
  
//   try {
//     return await prisma.videoProduct.delete({
//       where: {
//         videoId_productId: {
//           videoId,
//           productId,
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Error in detachProductFromVideo:', error);
//     throw error;
//   }
// }

// export async function getVideosByProduct(productId) {
//   if (!prisma) return [];
  
//   try {
//     return await prisma.video.findMany({
//       where: {
//         videoProducts: {
//           some: {
//             productId,
//           },
//         },
//       },
//       include: {
//         videoProducts: {
//           include: {
//             product: true,
//           },
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Error in getVideosByProduct:', error);
//     return [];
//   }
// }



// app/models/video.server.js
import prisma from "../db.server";

export async function createVideo(data) {
  console.log('createVideo called with data:', data);
  
  if (!prisma) {
    throw new Error('Prisma client not initialized');
  }
  
  try {
    const videoUrl = typeof data.videoUrl === 'object' ? data.videoUrl.videoUrl : data.videoUrl;
    const thumbnailUrl = typeof data.thumbnailUrl === 'object' ? data.thumbnailUrl.videoUrl : data.thumbnailUrl;
    
    const video = await prisma.video.create({
      data: {
        title: data.title,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        firebasePath: data.firebasePath || null, // Optional now
        shopifyFileId: data.shopifyFileId || null, // New field for Shopify File ID
        source: data.source || 'upload',
        duration: data.duration || null,
        processingStatus: data.processingStatus || 'processing',
        processingProgress: data.processingProgress || 0,
      },
    });
    
    console.log('Video created successfully:', video);
    
    return video;
  } catch (error) {
    console.error('Error creating video:', error);
    throw error;
  }
}

export async function updateVideoProcessingStatus(videoId, status, progress) {
  if (!prisma) return null;
  
  try {
    return await prisma.video.update({
      where: { id: videoId },
      data: {
        processingStatus: status,
        processingProgress: progress,
      },
    });
  } catch (error) {
    console.error('Error updating video processing status:', error);
    return null;
  }
}

export async function getVideos() {
  if (!prisma) return [];
  
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
    
    return videos;
  } catch (error) {
    console.error('Error in getVideos:', error);
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
  if (!prisma) return null;
  
  try {
    return await prisma.video.update({
      where: { id },
      data: {
        title: data.title,
        thumbnailUrl: data.thumbnailUrl,
        duration: data.duration,
      },
    });
  } catch (error) {
    console.error('Error in updateVideo:', error);
    throw error;
  }
}

export async function deleteVideo(id) {
  if (!prisma) {
    throw new Error('Prisma client not initialized');
  }
  
  try {
    console.log('Deleting video:', id);
    
    // Get video details including Shopify File ID
    const video = await prisma.video.findUnique({
      where: { id },
      select: { 
        firebasePath: true,
        shopifyFileId: true,
        videoProducts: true 
      },
    });
    
    if (!video) {
      throw new Error('Video not found');
    }
    
    // TODO: Delete from Shopify Files if shopifyFileId exists
    // You can implement Shopify file deletion using fileDelete mutation if needed
    
    // Delete associated videoProducts
    if (video.videoProducts && video.videoProducts.length > 0) {
      await prisma.videoProduct.deleteMany({
        where: { videoId: id },
      });
    }
    
    // Delete the video from database
    const deletedVideo = await prisma.video.delete({
      where: { id },
    });
    
    console.log('Video deleted successfully:', id);
    return deletedVideo;
    
  } catch (error) {
    console.error('Error in deleteVideo:', error);
    throw error;
  }
}

export async function attachProductToVideo(videoId, productId, position = 0) {
  if (!prisma) return null;
  
  try {
    return await prisma.videoProduct.create({
      data: {
        videoId,
        productId,
        position,
      },
    });
  } catch (error) {
    console.error('Error in attachProductToVideo:', error);
    throw error;
  }
}

export async function detachProductFromVideo(videoId, productId) {
  if (!prisma) return null;
  
  try {
    return await prisma.videoProduct.delete({
      where: {
        videoId_productId: {
          videoId,
          productId,
        },
      },
    });
  } catch (error) {
    console.error('Error in detachProductFromVideo:', error);
    throw error;
  }
}

export async function getVideosByProduct(productId) {
  if (!prisma) return [];
  
  try {
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
  } catch (error) {
    console.error('Error in getVideosByProduct:', error);
    return [];
  }
}