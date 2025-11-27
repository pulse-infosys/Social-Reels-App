import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import {
  Frame,
  Page,
  Layout,
  Card,
  Button,
  TextField,
  BlockStack,
  InlineStack,
  Badge,
  EmptyState,
  DataTable,
  Toast,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import CreateVideoPageModal from "../components/CreateVideoPageModal";

async function fetchAllWithPagination(admin, query, resourceType) {
  const allItems = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const res = await admin.graphql(query, {
      variables: { first: 250, after: cursor },
    });
    const { data, errors } = await res.json();

    if (errors) {
      console.error(`Error fetching ${resourceType}:`, errors);
      break;
    }

    const edges = data?.[resourceType]?.edges ?? [];
    allItems.push(...edges.map((e) => e.node));

    hasNextPage = data?.[resourceType]?.pageInfo?.hasNextPage ?? false;
    cursor = data?.[resourceType]?.pageInfo?.endCursor ?? null;
  }
  return allItems;
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const { getVideoPages } = await import("../models/videoPage.server");
  const { getVideos } = await import("../models/video.server");

  const videoPages = await getVideoPages(session.shop);

  console.log('videoPages===',videoPages);
  const videos = await getVideos(session.shop);

  const PRODUCTS_QUERY = `
    query getProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges { node { id title handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
  const COLLECTIONS_QUERY = `
    query getCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after) {
        edges { node { id title handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
  const PAGES_QUERY = `
    query getPages($first: Int!, $after: String) {
      pages(first: $first, after: $after) {
        edges { node { id title handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  const [products, collections, pages] = await Promise.all([
    fetchAllWithPagination(admin, PRODUCTS_QUERY, "products").catch(() => []),
    fetchAllWithPagination(admin, COLLECTIONS_QUERY, "collections").catch(
      () => [],
    ),
    fetchAllWithPagination(admin, PAGES_QUERY, "pages").catch(() => []),
  ]);

  const shopifyProducts = products.map((p) => ({
    id: p.id,
    title: p.title,
    handle: `/products/${p.handle}`,
    type: "product",
  }));
  const shopifyCollections = collections.map((c) => ({
    id: c.id,
    title: c.title,
    handle: `/collections/${c.handle}`,
    type: "collection",
  }));
  const shopifyPages = pages.map((pg) => ({
    id: pg.id,
    title: pg.title,
    handle: `/pages/${pg.handle}`,
    type: "page",
  }));

  const allPages = [
    { id: "homepage", title: "Homepage", handle: "/", type: "homepage" },
    ...shopifyPages,
    ...shopifyProducts,
    ...shopifyCollections,
  ];

  return json({ videoPages, videos, shopifyPages: allPages });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "createVideoPage") {
    const { findOrCreateVideoPage, createWidget } = await import(
      "../models/videoPage.server"
    );
    const pageName = formData.get("pageName");
    const widgetType = formData.get("widgetType");
    const pagePath = formData.get("pagePath");
    const videoIds = JSON.parse(formData.get("videoIds") || "[]");

    try {
      // Step 1: Find or create the video page
      const page = await findOrCreateVideoPage({
        shop: session.shop,
        name: pageName,
        pagePath,
      });

      // Step 2: Create the widget with videos
      if (videoIds.length > 0) {
        await createWidget(page.id, widgetType, videoIds, session.shop);
      }

      return json({ success: true });
    } catch (e) {
      console.error("Create video page error:", e);
      return json({ success: false, error: e.message }, { status: 500 });
    }
  }

  return json({ success: false });
};

export default function VideoPages() {
  const { videoPages, videos, shopifyPages } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [modalOpen, setModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const isCreating = fetcher.state !== "idle";

  /* ---------- Toast handling ---------- */
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setToastMessage("Video page created successfully!");
      setToastActive(true);
      setModalOpen(false);
    } else if (fetcher.state === "idle" && fetcher.data?.success === false) {
      setToastMessage("Failed to create video page. Please try again.");
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data]);

  const handleRowClick = useCallback(
    (videoPageId) => navigate(`/app/page-editor/${videoPageId}`),
    [navigate],
  );

  const filteredVideoPages = videoPages.filter(
    (p) =>
      !searchValue ||
      p.name?.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.pagePath?.toLowerCase().includes(searchValue.toLowerCase()),
  );

  console.log('filteredVideoPages====',filteredVideoPages);

  const rows = filteredVideoPages.map((page) => {
    console.log('page===',page);
    const widgetTypes = page.widgets?.map((w) => w.widgetType) || [];
    // console.log("widgetTypes===", widgetTypes);

    return [
      <div
        key={page.id}
        onClick={() => handleRowClick(page.id)}
        style={{ cursor: "pointer", color: "#008060" }}
      >
        {page.pagePath}
      </div>,
      <InlineStack gap="200">
        {widgetTypes.includes("floating") && <Badge>Floating</Badge>}
        {widgetTypes.includes("carousel") && <Badge>Carousel</Badge>}
        {widgetTypes.includes("stories") && <Badge>Stories</Badge>}
        {widgetTypes.includes("story") && <Badge>Story</Badge>}

      </InlineStack>,
      <Badge tone="success">Live</Badge>,
    ];
  });

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      duration={3000}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  return (
    <Frame>
      <Page
        title="Video Pages"
        backAction={{ content: "Settings", url: "/app" }}
        primaryAction={{
          content: "Add videos to a new page",
          onAction: () => setModalOpen(true),
        }}
        secondaryActions={[
          { content: "Upload videos", onAction: () => navigate("/app") },
        ]}
      >
        <Layout>
          <Layout.Section>
            <Card padding="0">
              <BlockStack gap="0">
                {/* Search */}
                <div style={{ padding: "16px 16px 0 16px" }}>
                  <TextField
                    label=""
                    value={searchValue}
                    onChange={setSearchValue}
                    placeholder="Search by page name"
                    autoComplete="off"
                  />
                </div>

                {/* Table or Empty */}
                {filteredVideoPages.length === 0 ? (
                  <div style={{ padding: "40px 16px" }}>
                    <EmptyState
                      heading="No video pages yet"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Create your first video page to get started</p>
                    </EmptyState>
                  </div>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text", "text"]}
                    headings={["Page path", "Widgets present", "Widget status"]}
                    rows={rows}
                    hoverable
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Create Modal */}
        <CreateVideoPageModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          shopifyPages={shopifyPages}
          videos={videos}
          onSuccess={() => console.log("Page created!")}
          actionUrl="/app/video-pages"
        />

        {toastMarkup}
      </Page>
    </Frame>
  );
}
