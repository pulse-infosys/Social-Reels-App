// app/routes/api.storefront.jsx

import { json } from "@remix-run/node";
import prisma from "../db.server";

// CORS headers for storefront access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS request for CORS
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const pagePath = url.searchParams.get("path") || "/";

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!shop) {
    return json(
      { success: false, error: "Shop parameter required" },
      { headers: corsHeaders, status: 400 }
    );
  }

  try {
    // Normalize the path
    const normalizedPath = normalizePath(pagePath);

    // Find the page and its widgets
    const videoPage = await prisma.videoPage.findUnique({
      where: {
        shop_pagePath: {
          shop: shop,
          pagePath: normalizedPath,
        },
      },
      include: {
        widgets: {
          where: {
            status: "live", // Only live widgets
            isCreated: true, // Only created widgets
          },
          include: {
            widgetVideos: {
              orderBy: {
                position: "asc",
              },
              include: {
                video: {
                  include: {
                    videoProducts: {
                      orderBy: {
                        position: "asc",
                      },
                      include: {
                        product: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // If no page found, return empty widgets
    if (!videoPage) {
      return json(
        {
          success: true,
          data: {
            page: null,
            widgets: [],
          },
        },
        { headers: corsHeaders }
      );
    }

    // Transform data for frontend
    const transformedWidgets = videoPage.widgets.map((widget) => ({
      id: widget.id,
      type: widget.widgetType, // "story", "floating", "carousel"
      videos: widget.widgetVideos.map((wv) => ({
        id: wv.video.id,
        title: wv.video.title,
        videoUrl: wv.video.videoUrl,
        thumbnailUrl: wv.video.thumbnailUrl,
        position: wv.position,
        products: wv.video.videoProducts.map((vp) => ({
          id: vp.product.id,
          shopifyId: vp.product.shopifyId,
          title: vp.product.title,
          handle: vp.product.handle,
          image: vp.product.image,
          price: vp.product.price,
          position: vp.position,
        })),
      })),
    }));

    return json(
      {
        success: true,
        data: {
          page: {
            id: videoPage.id,
            name: videoPage.name,
            path: videoPage.pagePath,
          },
          widgets: transformedWidgets,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Storefront API Error:", error);
    return json(
      { success: false, error: "Internal server error" },
      { headers: corsHeaders, status: 500 }
    );
  }
};

// Helper function to normalize paths
function normalizePath(path) {
  // Remove trailing slash (except for root)
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  // Ensure starts with /
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  return path;
}