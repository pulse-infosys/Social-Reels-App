import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  
  try {
    const response = await admin.graphql(
      `#graphql
      query searchProducts($query: String!) {
        products(first: 20, query: $query) {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              vendor
              productType
            }
          }
        }
      }`,
      {
        variables: {
          query: searchQuery
        }
      }
    );

    const responseJson = await response.json();
    
    const products = responseJson.data.products.edges.map(({ node }) => {
      const numericId = node.id.split('/').pop();
      
      return {
        id: numericId,
        shopifyId: node.id,
        title: node.title,
        handle: node.handle,
        image: node.featuredImage?.url || null,
        price: node.priceRangeV2.minVariantPrice.amount,
        vendor: node.vendor,
        productType: node.productType
      };
    });

    // Save products to database for future reference
    const { prisma } = await import("../db.server");
    
    for (const product of products) {
      await prisma.product.upsert({
        where: { shopifyId: product.shopifyId },
        update: {
          title: product.title,
          handle: product.handle,
          image: product.image,
          price: product.price,
          vendor: product.vendor,
          productType: product.productType,
        },
        create: {
          shopifyId: product.shopifyId,
          title: product.title,
          handle: product.handle,
          image: product.image,
          price: product.price,
          vendor: product.vendor,
          productType: product.productType,
        },
      });
    }

    return json({ products });
    
  } catch (error) {
    console.error("Product search error:", error);
    return json({ 
      error: "Failed to search products",
      products: [] 
    }, { status: 500 });
  }
};