// app/routes/app.page-editor.add-videos.$id.jsx

import { json } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useFetcher,
  useRevalidator,
} from "@remix-run/react";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
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
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

/* ===================== LOADER ===================== */

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params; // videoPage ID

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");
  const widgetType = url.searchParams.get("widgetType"); // Get widget type from URL

  const { getVideoPageById } = await import("../models/videoPage.server");
  const { getVideos, searchVideos } = await import("../models/video.server");
  const { getProducts } = await import("../models/product.server");

  const videoPage = await getVideoPageById(id, session.shop);
  const allVideos = searchQuery
    ? await searchVideos(searchQuery, session.shop)
    : await getVideos(session.shop);
  const products = await getProducts(session.shop);

  if (!videoPage) {
    throw new Response("Video Page not found", { status: 404 });
  }

  // Find the specific widget based on widgetType
  const widget = videoPage.widgets?.find(
    (w) => w.widgetType === widgetType
  );

  // Get video IDs already in this specific widget
  const existingVideoIds =
    widget?.widgetVideos?.map((wv) => wv.videoId) || [];

  // Filter out videos that are already in this specific widget
  const availableVideos = allVideos.filter(
    (video) => !existingVideoIds.includes(video.id)
  );

  return json({
    videoPage,
    availableVideos,
    products,
    shop: session.shop,
    widgetType,
    widgetId: widget?.id || null,
  });
};

/* ===================== ACTION ===================== */

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "addVideosToWidget") {
    const { addVideosToWidget } = await import(
      "../models/videoPage.server"
    );
    const widgetId = formData.get("widgetId");
    const videoIds = JSON.parse(formData.get("videoIds") || "[]");

    try {
      await addVideosToWidget(widgetId, videoIds);
      return json({
        success: true,
        action: "addVideosToWidget",
      });
    } catch (error) {
      console.error("Error adding videos to widget:", error);
      return json(
        {
          success: false,
          error: error.message,
          action: "addVideosToWidget",
        },
        { status: 500 }
      );
    }
  }

  if (actionType === "attachProducts") {
    const { attachProductsToVideo } = await import(
      "../models/product.server"
    );
    const videoId = formData.get("videoId");
    const productIds = JSON.parse(
      formData.get("productIds") || "[]"
    );

    try {
      await attachProductsToVideo(videoId, productIds);
      return json({
        success: true,
        action: "attachProducts",
      });
    } catch (error) {
      console.error("Error attaching products:", error);
      return json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  return json({ success: false });
};

/* ===================== COMPONENT ===================== */

export default function AddVideosToWidget() {
  const {
    videoPage,
    availableVideos,
    products,
    widgetType,
    widgetId,
  } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const productFetcher = useFetcher();
  const revalidator = useRevalidator();

  // Track last handled results (to avoid duplicate toasts)
  const lastFetcherResultRef = useRef(null);
  const lastProductFetcherResultRef = useRef(null);

  const [searchValue, setSearchValue] = useState("");
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [videoTypeFilter, setVideoTypeFilter] = useState("all");
  const [previewVideo, setPreviewVideo] = useState(null);

  // Product attachment modal states
  const [addProductModalActive, setAddProductModalActive] =
    useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSearchValue, setProductSearchValue] =
    useState("");

  const isSaving = fetcher.state !== "idle";
  const isSavingProducts = productFetcher.state !== "idle";

  /* ---------- Handle save videos to widget ---------- */

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (lastFetcherResultRef.current === fetcher.data) return;
    lastFetcherResultRef.current = fetcher.data;

    if (
      fetcher.data.success &&
      fetcher.data.action === "addVideosToWidget"
    ) {
      setToastMessage(
        `Videos added to ${widgetType} widget successfully!`
      );
      setToastActive(true);

      // after short delay, go back to main page
      setTimeout(() => {
        navigate(`/app/page-editor/${videoPage.id}`);
      }, 1000);
    } else if (
      fetcher.data.success === false &&
      fetcher.data.action === "addVideosToWidget"
    ) {
      setToastMessage(
        `Failed to add videos: ${
          fetcher.data?.error || "Please try again"
        }`
      );
      setToastActive(true);
      console.error("Error details:", fetcher.data);
    }
  }, [
    fetcher.state,
    fetcher.data,
    navigate,
    videoPage.id,
    widgetType,
  ]);

  /* ---------- Handle product attachment ---------- */

  useEffect(() => {
    if (
      productFetcher.state !== "idle" ||
      !productFetcher.data
    )
      return;

    if (
      lastProductFetcherResultRef.current ===
      productFetcher.data
    )
      return;
    lastProductFetcherResultRef.current = productFetcher.data;

    if (
      productFetcher.data.success &&
      productFetcher.data.action === "attachProducts"
    ) {
      setToastMessage("Products attached successfully!");
      setToastActive(true);
      setAddProductModalActive(false);
      setSelectedVideo(null);
      setSelectedProducts([]);
      setProductSearchValue("");

      // reload loader data instead of window.location.reload()
      revalidator.revalidate();
    } else if (productFetcher.data.success === false) {
      setToastMessage(
        "Failed to attach products. Please try again."
      );
      setToastActive(true);
    }
  }, [productFetcher.state, productFetcher.data, revalidator]);

  /* ---------- Handlers ---------- */

  const handleToggleVideo = useCallback(
    (video) => {
      if (isSaving) return;

      setSelectedVideos((prev) => {
        const isSelected = prev.some((v) => v.id === video.id);
        if (isSelected) {
          const newSelection = prev.filter(
            (v) => v.id !== video.id
          );
          if (previewVideo?.id === video.id) {
            setPreviewVideo(
              newSelection.length > 0 ? newSelection[0] : null
            );
          }
          return newSelection;
        } else {
          setPreviewVideo(video);
          return [...prev, video];
        }
      });
    },
    [isSaving, previewVideo]
  );

  const handleSaveVideos = useCallback(() => {
    if (
      selectedVideos.length === 0 ||
      isSaving ||
      !widgetId
    )
      return;

    const formData = new FormData();
    formData.append("actionType", "addVideosToWidget");
    formData.append("widgetId", widgetId);
    formData.append(
      "videoIds",
      JSON.stringify(selectedVideos.map((v) => v.id))
    );

    fetcher.submit(formData, { method: "post" });
  }, [selectedVideos, fetcher, isSaving, widgetId]);

  const handleOpenAddProductModal = useCallback((video) => {
    setSelectedVideo(video);
    setSelectedProducts(
      video.videoProducts?.map((vp) => vp.productId) || []
    );
    setAddProductModalActive(true);
  }, []);

  const handleCloseAddProductModal = useCallback(() => {
    if (isSavingProducts) return;
    setAddProductModalActive(false);
    setSelectedVideo(null);
    setSelectedProducts([]);
    setProductSearchValue("");
  }, [isSavingProducts]);

  const handleToggleProduct = useCallback(
    (productId) => {
      if (isSavingProducts) return;
      setSelectedProducts((prev) =>
        prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId]
      );
    },
    [isSavingProducts]
  );

  const handleSaveProducts = useCallback(() => {
    if (!selectedVideo || isSavingProducts) return;

    const formData = new FormData();
    formData.append("actionType", "attachProducts");
    formData.append("videoId", selectedVideo.id);
    formData.append(
      "productIds",
      JSON.stringify(selectedProducts)
    );

    productFetcher.submit(formData, { method: "post" });
  }, [
    selectedVideo,
    selectedProducts,
    productFetcher,
    isSavingProducts,
  ]);

  /* ---------- Derived ---------- */

  const filteredProducts = products.filter((product) =>
    product.title
      .toLowerCase()
      .includes(productSearchValue.toLowerCase())
  );

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      duration={3000}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  const widgetDisplayName =
    widgetType === "carousel"
      ? "Carousel"
      : widgetType === "story"
      ? "Story"
      : widgetType === "floating"
      ? "Floating"
      : widgetType;

  /* ===================== JSX ===================== */

  return (
    <Frame>
      <Page
        title={`Add videos to ${widgetDisplayName} widget`}
        backAction={{
          content: "Back",
          onAction: () =>
            navigate(`/app/page-editor/${videoPage.id}`),
        }}
        primaryAction={
          selectedVideos.length > 0
            ? {
                content: isSaving ? "Saving..." : "Save",
                onAction: handleSaveVideos,
                disabled: isSaving || !widgetId,
                loading: isSaving,
              }
            : undefined
        }
      >
        <Layout>
          {/* Alert if widget doesn't exist */}
          {!widgetId && (
            <Layout.Section>
              <Banner tone="warning">
                <p>
                  The {widgetDisplayName} widget has not been
                  created yet. Please create the widget first.
                </p>
              </Banner>
            </Layout.Section>
          )}

          {/* Saving banner */}
          {isSaving && (
            <Layout.Section>
              <Banner tone="info">
                <BlockStack gap="200">
                  <InlineStack
                    gap="200"
                    blockAlign="center"
                  >
                    <Spinner size="small" />
                    <Text
                      variant="bodyMd"
                      fontWeight="semibold"
                    >
                      Saving videos to {widgetDisplayName} widget...
                    </Text>
                  </InlineStack>
                  <Text
                    variant="bodySm"
                    tone="subdued"
                  >
                    Please wait while we add the videos
                  </Text>
                </BlockStack>
              </Banner>
            </Layout.Section>
          )}

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
                  onClearButtonClick={() =>
                    setSearchValue("")
                  }
                  disabled={isSaving}
                />
                <InlineStack gap="200">
                  <Button
                    pressed={videoTypeFilter === "all"}
                    onClick={() => setVideoTypeFilter("all")}
                    disabled={isSaving}
                  >
                    Video Type
                  </Button>
                </InlineStack>
                {selectedVideos.length > 0 && (
                  <Text
                    variant="bodySm"
                    tone="subdued"
                  >
                    {selectedVideos.length} video
                    {selectedVideos.length !== 1
                      ? "s"
                      : ""}{" "}
                    selected
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Videos List + Preview */}
          <Layout.Section>
            <Layout>
              {/* Left: Videos list */}
              <Layout.Section variant="oneHalf">
                <Card padding="0">
                  {availableVideos.length === 0 ? (
                    <EmptyState
                      heading="Upload a video to get started"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "18px",
                        }}
                      >
                        <Text
                          variant="bodySm"
                          tone="subdued"
                        >
                          You can use the video library
                          section to upload videos
                        </Text>

                        <Button
                          size="slim"
                          onClick={() => navigate("/app")}
                          variant="primary"
                        >
                          Upload Videos
                        </Button>
                      </div>
                    </EmptyState>
                  ) : (
                    <BlockStack gap="0">
                      {availableVideos
                        .filter((video) =>
                          searchValue
                            ? video.videoProducts?.some(
                                (vp) =>
                                  vp.product?.title
                                    .toLowerCase()
                                    .includes(
                                      searchValue.toLowerCase()
                                    )
                              )
                            : true
                        )
                        .map((video) => {
                          const isSelected =
                            selectedVideos.some(
                              (v) => v.id === video.id
                            );

                          return (
                            <div
                              key={video.id}
                              style={{
                                borderBottom:
                                  "1px solid #e1e3e5",
                                padding: "16px",
                                backgroundColor: isSelected
                                  ? "#f6f6f7"
                                  : "transparent",
                                cursor: "pointer",
                                opacity: isSaving ? 0.6 : 1,
                              }}
                              onClick={() =>
                                !isSaving &&
                                handleToggleVideo(video)
                              }
                            >
                              <InlineStack
                                align="space-between"
                                blockAlign="center"
                                gap="400"
                              >
                                {/* Checkbox (readonly visual) */}
                                <Checkbox
                                  checked={isSelected}
                                  disabled={
                                    isSaving || !widgetId
                                  }
                                />

                                {/* Thumbnail */}
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
                                    poster={
                                      video.thumbnailUrl
                                    }
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                </div>

                                {/* Product pill / attach button */}
                                <div
                                  style={{ flex: 1 }}
                                  onClick={(e) => {
                                    // if there are attached products, clicking the pill opens the modal
                                    if (
                                      !video.videoProducts
                                        ?.length
                                    )
                                      return;
                                    e.stopPropagation();
                                    handleOpenAddProductModal(
                                      video
                                    );
                                  }}
                                >
                                  {video.videoProducts
                                    ?.length > 0 ? (
                                    <InlineStack
                                      gap="100"
                                      wrap
                                    >
                                      {/* First product pill */}
                                      <Badge>
                                        <InlineStack
                                          gap="100"
                                          blockAlign="center"
                                        >
                                          <Thumbnail
                                            source={
                                              video
                                                .videoProducts[0]
                                                ?.product
                                                ?.image ||
                                              ""
                                            }
                                            alt={
                                              video
                                                .videoProducts[0]
                                                ?.product
                                                ?.title ||
                                              ""
                                            }
                                            size="extraSmall"
                                          />
                                          <span
                                            style={{
                                              maxWidth:
                                                "120px",
                                              overflow:
                                                "hidden",
                                              textOverflow:
                                                "ellipsis",
                                              whiteSpace:
                                                "nowrap",
                                            }}
                                          >
                                            {video
                                              .videoProducts[0]
                                              ?.product
                                              ?.title ||
                                              "Product"}
                                          </span>
                                        </InlineStack>
                                      </Badge>

                                      {/* +N badge */}
                                      {video
                                        .videoProducts
                                        .length > 1 && (
                                        <Badge>
                                          +
                                          {" " +
                                            (video
                                              .videoProducts
                                              .length -
                                              1)}
                                        </Badge>
                                      )}
                                    </InlineStack>
                                  ) : (
                                    <Button
                                      size="slim"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAddProductModal(
                                          video
                                        );
                                      }}
                                      disabled={isSaving}
                                    >
                                      + Attach a product
                                    </Button>
                                  )}
                                </div>
                              </InlineStack>
                            </div>
                          );
                        })}
                    </BlockStack>
                  )}
                </Card>
              </Layout.Section>

              {/* Right: Preview */}
              <Layout.Section variant="oneHalf">
                <Card>
                  <BlockStack gap="300">
                    <Text
                      variant="headingMd"
                      as="h3"
                    >
                      Preview
                    </Text>
                    <div
                      style={{
                        border: "1px solid #e1e3e5",
                        borderRadius: "8px",
                        padding: "20px",
                        minHeight: "400px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#f9f9f9",
                      }}
                    >
                      {previewVideo ? (
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "300px",
                          }}
                        >
                          <video
                            src={previewVideo.videoUrl}
                            poster={
                              previewVideo.thumbnailUrl
                            }
                            controls
                            autoPlay
                            style={{
                              width: "100%",
                              borderRadius: "8px",
                              backgroundColor: "#000",
                            }}
                          />
                          {previewVideo.videoProducts
                            ?.length > 0 && (
                            <div
                              style={{
                                marginTop: "12px",
                              }}
                            >
                              <Text
                                variant="bodyMd"
                                fontWeight="semibold"
                              >
                                Attached Products:
                              </Text>
                              <BlockStack
                                gap="200"
                                inlineAlign="start"
                              >
                                {previewVideo.videoProducts.map(
                                  (vp) => (
                                    <InlineStack
                                      key={vp.productId}
                                      gap="200"
                                      blockAlign="center"
                                    >
                                      <Thumbnail
                                        source={
                                          vp.product
                                            ?.image || ""
                                        }
                                        alt={
                                          vp.product
                                            ?.title || ""
                                        }
                                        size="small"
                                      />
                                      <Text variant="bodySm">
                                        {vp.product?.title}
                                      </Text>
                                    </InlineStack>
                                  )
                                )}
                              </BlockStack>
                            </div>
                          )}
                        </div>
                      ) : (
                        <BlockStack
                          gap="200"
                          align="center"
                        >
                          <div
                            style={{
                              border:
                                "1px solid #e1e3e5",
                              borderRadius: "50%",
                              width: "200px",
                              height: "200px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#fff",
                            }}
                          />
                          <Text
                            variant="bodyMd"
                            tone="subdued"
                            alignment="center"
                          >
                            Select a video to preview it
                          </Text>
                        </BlockStack>
                      )}
                    </div>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </Layout.Section>
        </Layout>

        {/* Add Products Modal */}
        <Modal
          open={addProductModalActive}
          onClose={handleCloseAddProductModal}
          title="Add products"
          primaryAction={{
            content: isSavingProducts
              ? "Saving..."
              : "Add",
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
                  <InlineStack
                    gap="200"
                    blockAlign="center"
                  >
                    <Spinner size="small" />
                    <Text
                      variant="bodyMd"
                      fontWeight="semibold"
                    >
                      Saving products...
                    </Text>
                  </InlineStack>
                  <Text
                    variant="bodySm"
                    tone="subdued"
                  >
                    Please wait while we update the product
                    associations
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
                onClearButtonClick={() =>
                  setProductSearchValue("")
                }
                disabled={isSavingProducts}
              />

              <Text
                as="p"
                variant="bodySm"
                tone="subdued"
              >
                {selectedProducts.length} product
                {selectedProducts.length !== 1
                  ? "s"
                  : ""}{" "}
                selected
              </Text>

              <div
                style={{
                  maxHeight: "400px",
                  overflowY: "auto",
                  opacity: isSavingProducts ? 0.5 : 1,
                  pointerEvents: isSavingProducts
                    ? "none"
                    : "auto",
                }}
              >
                {filteredProducts.length > 0 ? (
                  <ResourceList
                    resourceName={{
                      singular: "product",
                      plural: "products",
                    }}
                    items={filteredProducts}
                    renderItem={(product) => {
                      const { id, title, image } =
                        product;
                      const media = (
                        <Thumbnail
                          source={image || ""}
                          alt={title}
                          size="small"
                        />
                      );

                      const isSelected =
                        selectedProducts.includes(id);

                      return (
                        <ResourceItem
                          id={id}
                          media={media}
                          onClick={() =>
                            !isSavingProducts &&
                            handleToggleProduct(id)
                          }
                        >
                          <InlineStack
                            align="space-between"
                            blockAlign="center"
                          >
                            <InlineStack
                              gap="300"
                              blockAlign="center"
                            >
                              <Checkbox
                                checked={isSelected}
                                onChange={() =>
                                  handleToggleProduct(
                                    id
                                  )
                                }
                                disabled={
                                  isSavingProducts
                                }
                              />
                              <div>
                                <Text
                                  variant="bodyMd"
                                  fontWeight="medium"
                                >
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