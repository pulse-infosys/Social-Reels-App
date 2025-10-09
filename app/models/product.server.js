import prisma from "../db.server";


export async function getProducts() {
  return await prisma.product.findMany({
    orderBy: {
      title: 'asc'
    }
  });
}

export async function getProductById(id) {
  return await prisma.product.findUnique({
    where: { id }
  });
}

export async function syncProductsFromShopify(shopifyProducts) {
  const products = [];
  
  for (const shopifyProduct of shopifyProducts) {
    const product = await prisma.product.upsert({
      where: { shopifyId: shopifyProduct.id.toString() },
      update: {
        title: shopifyProduct.title,
        handle: shopifyProduct.handle,
        image: shopifyProduct.images?.[0]?.src || null,
        price: shopifyProduct.variants?.[0]?.price || null,
        vendor: shopifyProduct.vendor,
        productType: shopifyProduct.product_type
      },
      create: {
        shopifyId: shopifyProduct.id.toString(),
        title: shopifyProduct.title,
        handle: shopifyProduct.handle,
        image: shopifyProduct.images?.[0]?.src || null,
        price: shopifyProduct.variants?.[0]?.price || null,
        vendor: shopifyProduct.vendor,
        productType: shopifyProduct.product_type
      }
    });
    products.push(product);
  }
  
  return products;
}

export async function attachProductsToVideo(videoId, productIds) {
  // Delete existing associations
  await prisma.videoProduct.deleteMany({
    where: { videoId }
  });
  
  // Create new associations
  const videoProducts = await Promise.all(
    productIds.map((productId, index) =>
      prisma.videoProduct.create({
        data: {
          videoId,
          productId,
          position: index
        }
      })
    )
  );
  
  return videoProducts;
}

export async function searchProducts(query) {
  return await prisma.product.findMany({
    where: {
      title: {
        contains: query,
        mode: 'insensitive'
      }
    },
    orderBy: {
      title: 'asc'
    }
  });
}