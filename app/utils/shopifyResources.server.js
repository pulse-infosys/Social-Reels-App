// app/utils/shopifyResources.server.js
import { json } from "@remix-run/node";

/**
 * Generic paginator – works with any list query that has:
 *   - $first, $after variables
 *   - edges { node { id title handle } }
 *   - pageInfo { hasNextPage endCursor }
 */
async function fetchAllWithPagination(admin, query, rootField) {
  const items = [];
  let after = null;

  do {
    const variables = { first: 100, ...(after && { after }) };
    const response = await admin.graphql(query, { variables });
    const data = await response.json();

    const edges = data?.data?.[rootField]?.edges ?? [];
    const pageInfo = data?.data?.[rootField]?.pageInfo ?? {};

    items.push(...edges.map(e => e.node));
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);

  return items;
}

/* ------------------------------------------------------------------ */
/*  Individual resource fetchers (you can import just what you need)  */
/* ------------------------------------------------------------------ */

export async function getShopifyProducts(admin) {
  const QUERY = `
    query getProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges { node { id title handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  try {
    const raw = await fetchAllWithPagination(admin, QUERY, "products");
    return raw.map(p => ({
      id: p.id,
      title: p.title,
      handle: `/products/${p.handle}`,
      type: "product",
    }));
  } catch (err) {
    console.error("[shopifyResources] Failed to fetch products:", err);
    return [];
  }
}

export async function getShopifyCollections(admin) {
  const QUERY = `
    query getCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after) {
        edges { node { id title handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  try {
    const raw = await fetchAllWithPagination(admin, QUERY, "collections");
    return raw.map(c => ({
      id: c.id,
      title: c.title,
      handle: `/collections/${c.handle}`,
      type: "collection",
    }));
  } catch (err) {
    console.error("[shopifyResources] Failed to fetch collections:", err);
    return [];
  }
}

export async function getShopifyPages(admin) {
  const QUERY = `
    query getPages($first: Int!, $after: String) {
      pages(first: $first, after: $after) {
        edges { node { id title handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  try {
    const raw = await fetchAllWithPagination(admin, QUERY, "pages");
    return raw.map(p => ({
      id: p.id,
      title: p.title,
      handle: `/pages/${p.handle}`,
      type: "page",
    }));
  } catch (err) {
    console.error("[shopifyResources] Failed to fetch pages (check read_content scope):", err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  All-in-one helper – same shape as your original loader           */
/* ------------------------------------------------------------------ */

export async function getAllShopifyResources(admin) {
  const [products, collections, pages] = await Promise.all([
    getShopifyProducts(admin),
    getShopifyCollections(admin),
    getShopifyPages(admin),
  ]);

  const allPages = [
    { id: "homepage", title: "Homepage", handle: "/", type: "homepage" },
    ...pages,
    ...products,
    ...collections,
  ];

  return {
    shopifyPages: allPages,      // <-- exactly what your UI expects
    shopifyProducts: products,
    shopifyCollections: collections,
  };
}