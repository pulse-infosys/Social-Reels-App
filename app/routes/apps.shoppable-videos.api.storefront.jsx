// // app/routes/apps.shoppable-videos.api.storefront.jsx

// import { json } from "@remix-run/node";
// import prisma from "../db.server";

// export const loader = async ({ request }) => {
//   const url = new URL(request.url);
//   const shop =
//     request.headers.get("X-Shopify-Shop-Domain") ||
//     url.searchParams.get("shop");
//   const pagePath = url.searchParams.get("path") || "/";
//   const widgetType = url.searchParams.get("widgetType"); // NEW

//   if (!shop) {
//     return json({ success: false, error: "Unauthorized" }, { status: 401 });
//   }

//   try {
//     const normalizedPath = normalizePath(pagePath);

//     const videoPage = await prisma.videoPage.findUnique({
//       where: {
//         shop_pagePath: {
//           shop,
//           pagePath: normalizedPath,
//         },
//       },
//       include: {
//         widgets: {
//           where: {
//             status: "live",
//             isCreated: true,
//             ...(widgetType ? { widgetType } : {}),
//           },
//           include: {
//             widgetVideos: {
//               orderBy: { position: "asc" },
//               include: {
//                 video: {
//                   include: {
//                     videoProducts: {
//                       orderBy: { position: "asc" },
//                       include: { product: true },
//                     },
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!videoPage || !videoPage.widgets.length) {
//       return json({
//         success: true,
//         data: { page: null, widgets: [] },
//       });
//     }

//     const transformedWidgets = videoPage.widgets.map((widget) => ({
//       id: widget.id,
//       type: widget.widgetType,
//       videos: widget.widgetVideos.map((wv) => ({
//         id: wv.video.id,
//         title: wv.video.title,
//         videoUrl: wv.video.videoUrl,
//         thumbnailUrl: wv.video.thumbnailUrl,
//         position: wv.position,
//         products: wv.video.videoProducts.map((vp) => ({
//           id: vp.product.id,
//           shopifyId: vp.product.shopifyId,
//           title: vp.product.title,
//           handle: vp.product.handle,
//           image: vp.product.image,
//           price: vp.product.price,
//         })),
//       })),
//     }));

//     return json({
//       success: true,
//       data: {
//         page: {
//           id: videoPage.id,
//           name: videoPage.name,
//           path: videoPage.pagePath,
//         },
//         widgets: transformedWidgets,
//       },
//     });
//   } catch (error) {
//     console.error("Storefront API Error:", error);
//     return json({ success: false, error: "Server error" }, { status: 500 });
//   }
// };

// function normalizePath(path) {
//   if (path !== "/" && path.endsWith("/")) {
//     path = path.slice(0, -1);
//   }
//   if (!path.startsWith("/")) {
//     path = "/" + path;
//   }
//   return path;
// }

import db from "../db.server";
import { json } from "@remix-run/node";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const path = url.searchParams.get("path") || "/";

  const videoPage = await db.videoPage.findFirst({
    where: { shop, pagePath: path },
    include: {
      widgets: {
        where: { status: "live" },
        include: {
          widgetVideos: {
            where: { visible: true },       
            orderBy: { position: "asc" },
            include: {
              video: {
                include: {
                  videoProducts: {
                    orderBy: { position: "asc" },
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

  if (!videoPage) {
    return json({ success: true, data: { widgets: [] } });
  }

  const widgets = videoPage.widgets.map((w) => ({
    id: w.id,
    type: w.widgetType,
    videos: w.widgetVideos.map((wv) => {
      const v = wv.video;
      return {
        id: v.id,
        title: v.title,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        products: v.videoProducts.map((vp) => {
          const p = vp.product;
          return {
            id: p.id,
            title: p.title,
            handle: p.handle,
            image: p.image,
            price: p.price,
            variantId: p.variantId,                       
            productUrl: p.productUrl || (p.handle ? `/products/${p.handle}` : null),
          };
        }),
      };
    }),
  }));

  return json({ success: true, data: { widgets } });
}