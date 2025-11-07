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
  Text,
  Checkbox,
  Toast,
  Banner,
  Spinner,
  EmptyState,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Modal,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params; // videoPage ID

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");

  const { getVideoPageById } = await import("../models/videoPage.server");
  const { getVideos, searchVideos } = await import("../models/video.server");
  const { getProducts } = await import("../models/product.server");

  const videoPage = await getVideoPageById(id);
  const allVideos = searchQuery ? await searchVideos(searchQuery) : await getVideos();
  const products = await getProducts(session.shop);

  if (!videoPage) {
    throw new Response("Video Page not found", { status: 404 });
  }

  // Filter out videos that are already in the carousel
  const existingVideoIds = videoPage.videoIds || [];
  const availableVideos = allVideos.filter(
    (video) => !existingVideoIds.includes(video.id)
  );

  return json({
    videoPage,
    availableVideos,
    products,
    shop: session.shop,
  });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "addVideosToPlaylist") {
    const { addVideosToPage } = await import("../models/videoPage.server");
    const videoIds = JSON.parse(formData.get("videoIds") || "[]");

    try {
      await addVideosToPage(id, videoIds);
      return json({ success: true, action: "addVideosToPlaylist" });
    } catch (error) {
      console.error("Error adding videos to playlist:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (actionType === "attachProducts") {
    const { attachProductsToVideo } = await import("../models/product.server");
    const videoId = formData.get("videoId");
    const productIds = JSON.parse(formData.get("productIds") || "[]");

    try {
      await attachProductsToVideo(videoId, productIds);
      return json({ success: true, action: "attachProducts" });
    } catch (error) {
      console.error("Error attaching products:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return json({ success: false });
};

export default function AddVideosToPlaylist() {
  const { videoPage, availableVideos, products } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const productFetcher = useFetcher();

  const [searchValue, setSearchValue] = useState("");
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [videoTypeFilter, setVideoTypeFilter] = useState("all");

  // Product attachment modal states (reusing index.jsx logic)
  const [addProductModalActive, setAddProductModalActive] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSearchValue, setProductSearchValue] = useState("");

  const isSaving = fetcher.state !== "idle";
  const isSavingProducts = productFetcher.state !== "idle";

  // Handle save videos to playlist
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success && fetcher.data?.action === "addVideosToPlaylist") {
      setToastMessage("Videos added to playlist successfully!");
      setToastActive(true);
      setTimeout(() => {
        navigate(`/app/page-editor/${videoPage.id}`);
      }, 1000);
    }

    if (fetcher.state === "idle" && fetcher.data?.success === false) {
      setToastMessage("Failed to add videos. Please try again.");
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data, navigate, videoPage.id]);

  // Handle product attachment
  useEffect(() => {
    if (productFetcher.state === "idle" && productFetcher.data?.success && productFetcher.data?.action === "attachProducts") {
      setToastMessage("Products attached successfully!");
      setToastActive(true);
      setAddProductModalActive(false);
      setSelectedVideo(null);
      setSelectedProducts([]);
      setProductSearchValue("");
      // Refresh the page to show updated product tags
      window.location.reload();
    }

    if (productFetcher.state === "idle" && productFetcher.data?.success === false) {
      setToastMessage("Failed to attach products. Please try again.");
      setToastActive(true);
    }
  }, [productFetcher.state, productFetcher.data]);

  const handleToggleVideo = useCallback((videoId) => {
    if (isSaving) return;
    setSelectedVideos((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId]
    );
  }, [isSaving]);

  const handleSaveVideos = useCallback(() => {
    if (selectedVideos.length === 0 || isSaving) return;

    const formData = new FormData();
    formData.append("actionType", "addVideosToPlaylist");
    formData.append("videoIds", JSON.stringify(selectedVideos));

    fetcher.submit(formData, { method: "post" });
  }, [selectedVideos, fetcher, isSaving]);

  const handleOpenAddProductModal = useCallback((video) => {
    setSelectedVideo(video);
    setSelectedProducts(video.videoProducts?.map((vp) => vp.productId) || []);
    setAddProductModalActive(true);
  }, []);

  const handleCloseAddProductModal = useCallback(() => {
    if (isSavingProducts) return;
    setAddProductModalActive(false);
    setSelectedVideo(null);
    setSelectedProducts([]);
    setProductSearchValue("");
  }, [isSavingProducts]);

  const handleToggleProduct = useCallback((productId) => {
    if (isSavingProducts) return;
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, [isSavingProducts]);

  const handleSaveProducts = useCallback(() => {
    if (!selectedVideo || isSavingProducts) return;

    const formData = new FormData();
    formData.append("actionType", "attachProducts");
    formData.append("videoId", selectedVideo.id);
    formData.append("productIds", JSON.stringify(selectedProducts));

    productFetcher.submit(formData, { method: "post" });
  }, [selectedVideo, selectedProducts, productFetcher, isSavingProducts]);

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(productSearchValue.toLowerCase())
  );

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
        title="Add more videos to playlist"
        backAction={{
          content: "Back",
          onAction: () => navigate(`/app/page-editor/${videoPage.id}`),
        }}
        primaryAction={
          selectedVideos.length > 0
            ? {
                content: isSaving ? "Saving..." : "Save",
                onAction: handleSaveVideos,
                disabled: isSaving,
                loading: isSaving,
              }
            : undefined
        }
      >
        <Layout>
          {/* Search and Filter */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <TextField
                  label=""
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="Search videos"
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearchValue("")}
                />
                <InlineStack gap="200">
                  <Button
                    pressed={videoTypeFilter === "all"}
                    onClick={() => setVideoTypeFilter("all")}
                  >
                    Video Type
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Videos List */}
          <Layout.Section>
            <Layout>
              <Layout.Section variant="oneHalf">
                <Card padding="0">
                  {availableVideos.length === 0 ? (
                    <EmptyState
                      heading="No videos available"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>
                        All videos are already added to the carousel or no videos
                        exist in your library.
                      </p>
                    </EmptyState>
                  ) : (
                    <BlockStack gap="0">
                      {availableVideos
                        .filter((video) =>
                          searchValue
                            ? video.videoProducts?.some((vp) =>
                                vp.product?.title
                                  .toLowerCase()
                                  .includes(searchValue.toLowerCase())
                              )
                            : true
                        )
                        .map((video) => (
                          <div
                            key={video.id}
                            style={{
                              borderBottom: "1px solid #e1e3e5",
                              padding: "16px",
                            }}
                          >
                            <InlineStack
                              align="space-between"
                              blockAlign="center"
                              gap="400"
                            >
                              {/* Checkbox */}
                              <Checkbox
                                checked={selectedVideos.includes(video.id)}
                                onChange={() => handleToggleVideo(video.id)}
                                disabled={isSaving}
                              />

                              {/* Video Thumbnail */}
                              <div
                                style={{
                                  width: "60px",
                                  height: "80px",
                                  backgroundColor: "#000",
                                  borderRadius: "8px",
                                  position: "relative",
                                  overflow: "hidden",
                                }}
                              >
                                <video
                                  src={video.videoUrl}
                                  poster={video.thumbnailUrl}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              </div>

                              {/* Attach Product Button */}
                              <div style={{ flex: 1 }}>
                                <Button
                                  size="slim"
                                  onClick={() => handleOpenAddProductModal(video)}
                                  disabled={isSaving}
                                >
                                  + Attach a product
                                </Button>
                              </div>
                            </InlineStack>
                          </div>
                        ))}
                    </BlockStack>
                  )}
                </Card>
              </Layout.Section>

              {/* Preview Section */}
              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3">
                      Select a video to preview
                    </Text>
                    <div
                      style={{
                        border: "1px solid #e1e3e5",
                        borderRadius: "50%",
                        width: "200px",
                        height: "200px",
                        margin: "40px auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#f9f9f9",
                      }}
                    />
                    <Text variant="bodyMd" tone="subdued" alignment="center">
                      Click on an item in the table to preview media
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </Layout.Section>
        </Layout>

        {/* Add Products Modal - Reusing index.jsx logic */}
        <Modal
          open={addProductModalActive}
          onClose={handleCloseAddProductModal}
          title="Add products"
          primaryAction={{
            content: isSavingProducts ? "Saving..." : "Add",
            onAction: handleSaveProducts,
            disabled: isSavingProducts,
            loading: isSavingProducts,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleCloseAddProductModal,
              disabled: isSavingProducts,
            },
          ]}
        >
          <Modal.Section>
            {isSavingProducts && (
              <Banner tone="info">
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Spinner size="small" />
                    <Text variant="bodyMd" fontWeight="semibold">
                      Saving products...
                    </Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    Please wait while we update the product associations
                  </Text>
                </BlockStack>
              </Banner>
            )}

            <BlockStack gap="400">
              <TextField
                label=""
                value={productSearchValue}
                onChange={setProductSearchValue}
                placeholder="Search products"
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setProductSearchValue("")}
                disabled={isSavingProducts}
              />

              <Text as="p" variant="bodySm" tone="subdued">
                {selectedProducts.length} product
                {selectedProducts.length !== 1 ? "s" : ""} selected
              </Text>

              <div
                style={{
                  maxHeight: "400px",
                  overflowY: "auto",
                  opacity: isSavingProducts ? 0.5 : 1,
                  pointerEvents: isSavingProducts ? "none" : "auto",
                }}
              >
                {filteredProducts.length > 0 ? (
                  <ResourceList
                    resourceName={{ singular: "product", plural: "products" }}
                    items={filteredProducts}
                    renderItem={(product) => {
                      const { id, title, image } = product;
                      const media = (
                        <Thumbnail source={image || ""} alt={title} size="small" />
                      );

                      const isSelected = selectedProducts.includes(id);

                      return (
                        <ResourceItem
                          id={id}
                          media={media}
                          onClick={() => !isSavingProducts && handleToggleProduct(id)}
                        >
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="300" blockAlign="center">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handleToggleProduct(id)}
                                disabled={isSavingProducts}
                              />
                              <div>
                                <Text variant="bodyMd" fontWeight="medium">
                                  {title}
                                </Text>
                              </div>
                            </InlineStack>
                          </InlineStack>
                        </ResourceItem>
                      );
                    }}
                  />
                ) : (
                  <EmptyState
                    heading="No products found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Try changing the search term</p>
                  </EmptyState>
                )}
              </div>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Page>
      {toastMarkup}
    </Frame>
  );
}