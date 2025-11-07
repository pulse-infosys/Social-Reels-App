import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
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
  Banner,
  DataTable,
  EmptyState,
  Modal,
  Text,
  Checkbox,
  ResourceList,
  ResourceItem,
  Spinner,
  Toast,
  Autocomplete,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// Fetch all items with pagination
async function fetchAllWithPagination(admin, query, resourceType) {
  let allItems = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await admin.graphql(query, {
      variables: {
        first: 250,
        after: cursor,
      },
    });

    const data = await response.json();

    if (data.errors) {
      console.error(`Error fetching ${resourceType}:`, data.errors);
      break;
    }

    if (data.data && data.data[resourceType]) {
      const items = data.data[resourceType].edges.map((edge) => edge.node);
      allItems = [...allItems, ...items];

      hasNextPage = data.data[resourceType].pageInfo.hasNextPage;
      cursor = data.data[resourceType].pageInfo.endCursor;
    } else {
      hasNextPage = false;
    }
  }

  return allItems;
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const { getVideoPages } = await import("../models/videoPage.server");
  const { getVideos } = await import("../models/video.server");

  const videoPages = await getVideoPages();
  const videos = await getVideos();

  let shopifyPages = [];
  let shopifyProducts = [];
  let shopifyCollections = [];

  // Fetch Products
  const PRODUCTS_QUERY = `
    query getProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          node {
            id
            title
            handle
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  try {
    const products = await fetchAllWithPagination(
      admin,
      PRODUCTS_QUERY,
      "products",
    );
    shopifyProducts = products.map((product) => ({
      id: product.id,
      title: product.title,
      handle: `/products/${product.handle}`,
      type: "product",
    }));
  } catch (error) {
    console.error("Error fetching products:", error);
  }

  // Fetch Collections
  const COLLECTIONS_QUERY = `
    query getCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after) {
        edges {
          node {
            id
            title
            handle
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  try {
    const collections = await fetchAllWithPagination(
      admin,
      COLLECTIONS_QUERY,
      "collections",
    );
    shopifyCollections = collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      handle: `/collections/${collection.handle}`,
      type: "collection",
    }));
  } catch (error) {
    console.error("Error fetching collections:", error);
  }

  // Try to fetch Pages (requires read_content scope)
  const PAGES_QUERY = `
    query getPages($first: Int!, $after: String) {
      pages(first: $first, after: $after) {
        edges {
          node {
            id
            title
            handle
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  try {
    const pages = await fetchAllWithPagination(admin, PAGES_QUERY, "pages");
    shopifyPages = pages.map((page) => ({
      id: page.id,
      title: page.title,
      handle: `/pages/${page.handle}`,
      type: "page",
    }));
  } catch (error) {
    console.error("Error fetching pages (may need read_content scope):", error);
    // Continue without pages if permission denied
  }

  const allPages = [
    { id: "homepage", title: "Homepage", handle: "/", type: "homepage" },
    ...shopifyPages,
    ...shopifyProducts,
    ...shopifyCollections,
  ];

  // console.log("Total pages/products/collections loaded:", allPages.length);

  return json({
    videoPages,
    videos,
    shopifyPages: allPages,
  });
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const { session } = await authenticate.admin(request);

  if (actionType === "createVideoPage") {
    const { createVideoPage } = await import("../models/videoPage.server");

    const pageName = formData.get("pageName");
    const widgetType = formData.get("widgetType");
    const pagePath = formData.get("pagePath");
    const videoIds = JSON.parse(formData.get("videoIds") || "[]");

    try {
      await createVideoPage({
        name: pageName,
        shop: session.shop,
        pagePath,
        videoIds,
        widgetType
      });
      return json({ success: true });
    } catch (error) {
      console.error("Error creating video page:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return json({ success: false });
};

const WIDGET_TYPES = [
  {
    id: "carousel",
    name: "Carousel",
    image:
      'https://cdn.shopify.com/s/files/1/0580/9258/5030/files/quinn_m28baghh95hofagj8nlpeppc.png?v=1760445583',
  },
  {
    id: "stories",
    name: "Stories",
    image:
      'https://cdn.shopify.com/s/files/1/0580/9258/5030/files/quinn_b5w8kph5ndijcw77zufk31be.png?v=1760445582',
  },
  {
    id: "floating",
    name: "Floating",
    image:
      'https://cdn.shopify.com/s/files/1/0580/9258/5030/files/quinn_ng19ck1x9ipqa5v01ei6zeb2.png?v=1760445582',
  },
];

export default function VideoPages() {
  const { videoPages, videos, shopifyPages } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [createModalActive, setCreateModalActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedWidget, setSelectedWidget] = useState("");
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [pageSearchValue, setPageSearchValue] = useState("");
  const [videoSearchValue, setVideoSearchValue] = useState("");
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const isCreating = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setToastMessage("Video page created successfully!");
      setToastActive(true);
      setCreateModalActive(false);
      setCurrentStep(1);
      setSelectedWidget("");
      setSelectedPage("");
      setSelectedVideos([]);
    }

    if (fetcher.state === "idle" && fetcher.data?.success === false) {
      setToastMessage("Failed to create video page. Please try again.");
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data]);

  const handleOpenCreateModal = useCallback(() => {
    setCreateModalActive(true);
    setCurrentStep(1);
    setSelectedWidget("");
    setSelectedPage("");
    setSelectedVideos([]);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    if (isCreating) return;
    setCreateModalActive(false);
    setCurrentStep(1);
    setSelectedWidget("");
    setSelectedPage("");
    setSelectedVideos([]);
  }, [isCreating]);

  const handleWidgetSelect = (widgetId) => {
    if (isCreating) return;
    setSelectedWidget(widgetId);
  };

  const handlePageSelect = (pageId) => {
    if (isCreating) return;
    setSelectedPage(pageId);
  };

  const handleVideoToggle = (videoId) => {
    if (isCreating) return;
    setSelectedVideos((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId],
    );
  };

  const handleNextStep = () => {
    if (currentStep === 1 && selectedWidget && selectedPage) {
      setCurrentStep(2);
    }
  };

  const handleBackStep = () => {
    if (currentStep === 2 && !isCreating) {
      setCurrentStep(1);
    }
  };

  const handleCreatePage = () => {
    if (
      !selectedWidget ||
      !selectedPage ||
      selectedVideos.length === 0 ||
      isCreating
    )
      return;

    const selectedPageData = shopifyPages.find((p) => p.id === selectedPage);
    const formData = new FormData();
    formData.append("actionType", "createVideoPage");
    formData.append("pageName", selectedPageData?.title || "New Page");
    formData.append("widgetType", selectedWidget);
    formData.append("pagePath", selectedPageData?.handle || "/");
    formData.append("videoIds", JSON.stringify(selectedVideos));

    fetcher.submit(formData, { method: "post" });
  };

  // Handle row click - navigate to edit page
  const handleRowClick = (videoPageId) => {
    console.log("Clicked video page ID:", videoPageId);
    navigate(`/app/page-editor/${videoPageId}`);
  };


  const filteredPages = shopifyPages.filter((page) =>
    page.title.toLowerCase().includes(pageSearchValue.toLowerCase()),
  );

  const filteredVideos = videos.filter(
    (video) =>
      !videoSearchValue ||
      video.title?.toLowerCase().includes(videoSearchValue.toLowerCase()),
  );

  const filteredVideoPages = videoPages.filter(
    (page) =>
      !searchValue ||
      page.name?.toLowerCase().includes(searchValue.toLowerCase()) ||
      page.pagePath?.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const rows = filteredVideoPages.map((page) => [
    <div
      key={page.id}
      onClick={() => handleRowClick(page.id)}
      style={{ cursor: "pointer", color: "#008060" }}
    >
      {page.pagePath}
    </div>,
    <InlineStack gap="200">
      {page.widgetType === "floating" && <Badge>Floating</Badge>}
      {page.widgetType === "carousel" && <Badge>Carousel</Badge>}
      {page.widgetType === "stories" && <Badge>Stories</Badge>}
    </InlineStack>,
    <Badge tone="success">Live</Badge>,
  ]);


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
          onAction: handleOpenCreateModal,
        }}
        secondaryActions={[
          {
            content: "Upload videos",
            onAction: () => navigate("/app"),
          },
        ]}
      >
        <Layout>
          <Layout.Section>
            <Card padding="0">
              <BlockStack gap="0">
                <div style={{ padding: "16px 16px 0 16px" }}>
                  <TextField
                    label=""
                    value={searchValue}
                    onChange={setSearchValue}
                    placeholder="Search by page name"
                    autoComplete="off"
                  />
                </div>

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
                  <div style={{ cursor: "pointer" }}>
                    <DataTable
                      columnContentTypes={["text", "text", "text"]}
                      headings={["Page path", "Widgets present", "Widget status"]}
                      rows={rows}
                      onRowClick={(index) => {
                        console.log('videoPage.id====',videoPage.id);
                        const videoPage = filteredVideoPages[index];
                        handleRowClick(videoPage.id);
                      }}
                      hoverable
                    />
                  </div>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Modal
          large
          open={createModalActive}
          onClose={handleCloseCreateModal}
          size="large"
          title="Add videos to a new page"
        >
          <Modal.Section>
            <div
              style={{
                marginBottom: "24px",
                opacity: isCreating ? 0.5 : 1,
                pointerEvents: isCreating ? "none" : "auto",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "#e1e3e5",
                  borderRadius: "4px",
                  overflow: "hidden",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    width: currentStep === 1 ? "50%" : "100%",
                    height: "100%",
                    backgroundColor: "#000",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <InlineStack align="center">
                <Text variant="bodyMd">Step {currentStep} of 2</Text>
              </InlineStack>
            </div>

            {isCreating && (
              <div style={{ marginBottom: "16px" }}>
                <Banner tone="info">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Spinner size="small" />
                      <Text variant="bodyMd" fontWeight="semibold">
                        Creating video page...
                      </Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      Please wait while we set up your video page
                    </Text>
                  </BlockStack>
                </Banner>
              </div>
            )}

            {currentStep === 1 && (
              <div
                style={{
                  opacity: isCreating ? 0.5 : 1,
                  pointerEvents: isCreating ? "none" : "auto",
                }}
              >
                <BlockStack gap="600">
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3">
                      Select widget
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      Choose a widget variant to add to your store.
                    </Text>

                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >
                      {WIDGET_TYPES.map((widget) => (
                        <div
                          key={widget.id}
                          onClick={() => handleWidgetSelect(widget.id)}
                          style={{
                            cursor: "pointer",
                            border:
                              selectedWidget === widget.id
                                ? "3px solid #008060"
                                : "2px solid #e1e3e5",
                            borderRadius: "12px",
                            padding: "16px",
                            flex: "1",
                            minWidth: "150px",
                            maxWidth: "200px",
                            transition: "all 0.2s ease",
                            backgroundColor:
                              selectedWidget === widget.id
                                ? "#f6f6f7"
                                : "transparent",
                          }}
                        >
                          <BlockStack gap="300" align="center">
                            <div
                              style={{
                                width: "100px",
                                height: "150px",
                                backgroundColor: "#000",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                              }}
                            >
                              <img
                                src={widget.image}
                                alt={widget.name}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            </div>
                            <Text
                              variant="bodyMd"
                              fontWeight="semibold"
                              alignment="center"
                            >
                              {widget.name}
                            </Text>
                          </BlockStack>
                        </div>
                      ))}
                    </div>
                  </BlockStack>

                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3">
                      Select Page
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      Choose a page, product, or collection where your widget
                      will appear.
                    </Text>

                    <Autocomplete
                      options={shopifyPages
                        .reduce((acc, page) => {
                          const groupTitle =
                            {
                              homepage: "Pages",
                              page: "Pages",
                              product: "Products",
                              collection: "Collections",
                            }[page.type] || "Other";

                          const existingGroup = acc.find(
                            (g) => g.title === groupTitle,
                          );

                          const option = {
                            value: page.id,
                            label: page.title,
                          };

                          if (existingGroup) {
                            existingGroup.options.push(option);
                          } else {
                            acc.push({ title: groupTitle, options: [option] });
                          }

                          return acc;
                        }, [])
                        .map((group) => ({
                          ...group,
                          options: group.options.filter((option) =>
                            option.label
                              .toLowerCase()
                              .includes(pageSearchValue.toLowerCase()),
                          ),
                        }))
                        .filter((group) => group.options.length > 0)}
                      selected={selectedPage ? [selectedPage] : []}
                      onSelect={(selected) => {
                        const selectedId = selected[0];
                        const selectedOption = shopifyPages.find(
                          (p) => p.id === selectedId,
                        );

                        setSelectedPage(selectedId);
                        setPageSearchValue(selectedOption?.title || "");
                      }}
                      listTitle="Search results"
                      allowMultiple={false}
                      textField={
                        <Autocomplete.TextField
                          onChange={setPageSearchValue}
                          label="Page, product or collection"
                          value={pageSearchValue}
                          placeholder="Search and select..."
                          autoComplete="off"
                          error={
                            !selectedPage && currentStep === 1
                              ? "Please select a page"
                              : undefined
                          }
                        />
                      }
                    />
                  </BlockStack>

                  <InlineStack align="end">
                    <Button
                      onClick={handleNextStep}
                      disabled={!selectedWidget || !selectedPage}
                    >
                      Next
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            )}

            {currentStep === 2 && (
              <div
                style={{
                  opacity: isCreating ? 0.5 : 1,
                  pointerEvents: isCreating ? "none" : "auto",
                }}
              >
                <BlockStack gap="400">
                  <InlineStack align="start">
                    <Button onClick={handleBackStep}>Back</Button>
                  </InlineStack>

                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3">
                      Select Videos
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      Choose videos to add to your widget. These will appear on
                      your selected store page.
                    </Text>

                    <InlineStack align="space-between" gap="200">
                      <div style={{ flex: 1 }}>
                        <TextField
                          value={videoSearchValue}
                          onChange={setVideoSearchValue}
                          placeholder="Search videos"
                          autoComplete="off"
                        />
                      </div>
                      <Button>Filters</Button>
                    </InlineStack>

                    <Text variant="bodySm" tone="subdued">
                      {selectedVideos.length} video
                      {selectedVideos.length !== 1 ? "s" : ""} selected
                    </Text>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: "16px",
                        maxHeight: "500px",
                        overflowY: "auto",
                        padding: "4px",
                      }}
                    >
                      {filteredVideos.map((video) => (
                        <div
                          key={video.id}
                          onClick={() => handleVideoToggle(video.id)}
                          style={{
                            cursor: "pointer",
                            border: selectedVideos.includes(video.id)
                              ? "3px solid #008060"
                              : "2px solid #e1e3e5",
                            borderRadius: "12px",
                            overflow: "hidden",
                            position: "relative",
                            transition: "all 0.2s ease",
                            backgroundColor: selectedVideos.includes(video.id)
                              ? "#f6f6f7"
                              : "transparent",
                          }}
                        >
                          <div
                            style={{
                              paddingTop: "150%",
                              position: "relative",
                              backgroundColor: "#000",
                            }}
                          >
                            <video
                              src={video.videoUrl}
                              poster={video.thumbnailUrl}
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                backgroundColor: "white",
                                borderRadius: "50%",
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                              }}
                            >
                              <Checkbox
                                checked={selectedVideos.includes(video.id)}
                                onChange={() => handleVideoToggle(video.id)}
                              />
                            </div>
                            <div
                              style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                width: "40px",
                                height: "40px",
                                backgroundColor: "rgba(0,0,0,0.5)",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                              }}
                            >
                              ▶
                            </div>
                          </div>
                          <div
                            style={{
                              padding: "12px",
                              textAlign: "center",
                              minHeight: "60px",
                            }}
                          >
                            <Text variant="bodySm" alignment="center">
                              {video.videoProducts?.length > 0
                                ? `${video.videoProducts.length} product${video.videoProducts.length !== 1 ? "s" : ""} tagged`
                                : "Attach products to make it shoppable video"}
                            </Text>
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredVideos.length === 0 && (
                      <EmptyState
                        heading="No videos found"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>Upload videos first to add them to your page</p>
                        <Button onClick={() => navigate("/app")}>
                          Upload Videos
                        </Button>
                      </EmptyState>
                    )}
                  </BlockStack>

                  <InlineStack align="space-between">
                    <Button onClick={handleBackStep}>Back</Button>
                    <Button
                      variant="primary"
                      onClick={handleCreatePage}
                      disabled={selectedVideos.length === 0 || isCreating}
                      loading={isCreating}
                    >
                      {isCreating ? "Creating..." : "Create Page"}
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            )}
          </Modal.Section>
        </Modal>
      </Page>
      {toastMarkup}
    </Frame>
  );
}