import db from "../db.server";

/**
 * Get all products for a specific shop
 */
export async function getProducts(shop) {
  return await db.product.findMany({
    where: {
      shop: shop
    },
    orderBy: {
      title: 'asc'
    }
  });
}

/**
 * Get a single product by ID
 */
export async function getProductById(id) {
  return await db.product.findUnique({
    where: { id }
  });
}

/**
 * Sync products from Shopify to database
 * Updates existing products and creates new ones
 */
export async function syncProductsFromShopify(shopifyProducts, shop) {
  try {
    for (const product of shopifyProducts) {
      await db.product.upsert({
        where: {
          shop_shopifyId: {
            shop: shop,
            shopifyId: product.shopifyId
          }
        },
        update: {
          title: product.title,
          image: product.image,
          price: product.price,
          updatedAt: new Date()
        },
        create: {
          shop: shop,
          shopifyId: product.shopifyId,
          title: product.title,
          image: product.image,
          price: product.price
        }
      });
    }
    
    console.log(`Synced ${shopifyProducts.length} products for shop: ${shop}`);
    return { success: true, count: shopifyProducts.length };
  } catch (error) {
    console.error('Error syncing products:', error);
    throw error;
  }
}

/**
 * Attach products to a video
 * Replaces existing product associations
 */
export async function attachProductsToVideo(videoId, productIds) {
  try {
    // First, delete all existing associations for this video
    await db.videoProduct.deleteMany({
      where: {
        videoId: videoId
      }
    });

    // Then create new associations
    if (productIds && productIds.length > 0) {
      const videoProducts = productIds.map((productId, index) => ({
        videoId: videoId,
        productId: productId,
        position: index
      }));

      await db.videoProduct.createMany({
        data: videoProducts
      });
    }

    console.log(`Attached ${productIds.length} products to video ${videoId}`);
    return { success: true };
  } catch (error) {
    console.error('Error attaching products to video:', error);
    throw error;
  }
}

/**
 * Get products attached to a specific video
 */
export async function getVideoProducts(videoId) {
  return await db.videoProduct.findMany({
    where: {
      videoId: videoId
    },
    include: {
      product: true
    },
    orderBy: {
      position: 'asc'
    }
  });
}

/**
 * Remove a product from a video
 */
export async function removeProductFromVideo(videoId, productId) {
  try {
    await db.videoProduct.delete({
      where: {
        videoId_productId: {
          videoId: videoId,
          productId: productId
        }
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error removing product from video:', error);
    throw error;
  }
}