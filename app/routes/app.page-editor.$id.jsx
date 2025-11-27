import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Frame,
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Tabs,
  Badge,
  Toast,
  Icon,
  Thumbnail,
  Modal,
  TextField,
  ResourceList,
  ResourceItem,
  Checkbox,
  EmptyState,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { DragHandleIcon, ViewIcon, HideIcon, DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import CreateVideoPageModal from "../components/CreateVideoPageModal";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

/* ======================= LOADER ======================= */

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params;

  const { getVideoPageById } = await import("../models/videoPage.server");
  const { getVideos } = await import("../models/video.server");
  const { getProducts } = await import("../models/product.server");
  const { getAllShopifyResources } = await import(
    "../utils/shopifyResources.server"
  );

  const videoPage = await getVideoPageById(id, session.shop);
  const allVideos = await getVideos(session.shop);
  const products = await getProducts(session.shop);
  const { shopifyPages } = await getAllShopifyResources(admin);

  if (!videoPage) {
    throw new Response("Video Page not found", { status: 404 });
  }

  return json({
    videoPage,
    allVideos,
    products,
    shop: session.shop,
    shopifyPages,
  });
};

/* ======================= ACTION ======================= */

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "createWidget") {
    const { createWidget } = await import("../models/videoPage.server");
    const widgetType = formData.get("widgetType");
    const videoIds = JSON.parse(formData.get("videoIds") || "[]");

    try {
      await createWidget(id, widgetType, videoIds, session.shop);
      return json({ success: true, action: "createWidget" });
    } catch (error) {
      console.error("Error creating widget:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (actionType === "updateWidgetStatus") {
    const { updateWidgetStatus } = await import("../models/videoPage.server");
    const widgetId = formData.get("widgetId");
    const status = formData.get("status");

    try {
      await updateWidgetStatus(widgetId, status);
      return json({ success: true, action: "updateWidgetStatus", widgetId, status });
    } catch (error) {
      console.error("Error updating status:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (actionType === "reorderVideos") {
    const { reorderWidgetVideos } = await import("../models/videoPage.server");
    const widgetId = formData.get("widgetId");
    const videoIds = JSON.parse(formData.get("videoIds") || "[]");

    try {
      await reorderWidgetVideos(widgetId, videoIds);
      return json({ success: true, action: "reorderVideos" });
    } catch (error) {
      console.error("Error reordering videos:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (actionType === "attachProducts") {
    const { attachProductsToVideo } = await import("../models/product.server");
    const videoId = formData.get("videoId");
    const productIds = JSON.parse(formData.get("productIds") || "[]");

    try {
      await attachProductsToVideo(videoId, productIds);
      return json({ success: true, action: "attachProducts", videoId, productIds });
    } catch (error) {
      console.error("Error attaching products:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (actionType === "deleteVideo") {
    const { removeVideoFromWidget } = await import("../models/videoPage.server");
    const widgetId = formData.get("widgetId");
    const videoId = formData.get("videoId");

    try {
      await removeVideoFromWidget(widgetId, videoId);
      return json({ success: true, action: "deleteVideo", widgetId, videoId });
    } catch (error) {
      console.error("Error removing video:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return json({ success: false });
};

/* ======================= COMPONENT ======================= */

export default function VideoPageEdit() {
  const { videoPage, allVideos, products, shopifyPages } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const productFetcher = useFetcher();

  const lastFetcherDataRef = useRef(null);
  const lastProductFetcherDataRef = useRef(null);

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const [selectedTab, setSelectedTab] = useState(0);

  // Create page/widget modal
  const [createWidgetModalOpen, setCreateWidgetModalOpen] = useState(false);
  const [modalWidgetType, setModalWidgetType] = useState("");

  // Preview
  const [previewVideo, setPreviewVideo] = useState(null);

  // Product modal
  const [addProductModalActive, setAddProductModalActive] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [originalProducts, setOriginalProducts] = useState([]);
  const [productSearchValue, setProductSearchValue] = useState("");

  // Local video lists
  const [carouselVideos, setCarouselVideos] = useState([]);
  const [storyVideos, setStoryVideos] = useState([]);
  const [floatingVideos, setFloatingVideos] = useState([]);

  const isSavingProducts =
    productFetcher.state !== "idle" &&
    productFetcher.formData?.get("actionType") === "attachProducts";

  /* ---------- Init local lists from loader (once per loader run) ---------- */

  const carouselWidget = videoPage.widgets?.find(
    (w) => w.widgetType === "carousel",
  );
  const storyWidget = videoPage.widgets?.find(
    (w) => w.widgetType === "stories" || w.widgetType.includes("story"),
  );
  const floatingWidget = videoPage.widgets?.find(
    (w) => w.widgetType === "floating",
  );

  useEffect(() => {
    if (carouselWidget?.widgetVideos) {
      setCarouselVideos(
        carouselWidget.widgetVideos
          .map((wv) => allVideos.find((v) => v.id === wv.videoId))
          .filter(Boolean),
      );
    } else setCarouselVideos([]);

    if (storyWidget?.widgetVideos) {
      setStoryVideos(
        storyWidget.widgetVideos
          .map((wv) => allVideos.find((v) => v.id === wv.videoId))
          .filter(Boolean),
      );
    } else setStoryVideos([]);

    if (floatingWidget?.widgetVideos) {
      setFloatingVideos(
        floatingWidget.widgetVideos
          .map((wv) => allVideos.find((v) => v.id === wv.videoId))
          .filter(Boolean),
      );
    } else setFloatingVideos([]);
  }, [carouselWidget, storyWidget, floatingWidget, allVideos]);

  const tabs = [
    {
      id: "carousel",
      content: `Carousel ${carouselWidget?.widgetVideos?.length || 0}`,
    },
    {
      id: "story",
      content: `Story ${storyWidget?.widgetVideos?.length || 0}`,
    },
    {
      id: "floating",
      content: `Floating ${floatingWidget?.widgetVideos?.length || 0}`,
    },
  ];

  /* ---------- Fetcher responses (create, status, reorder, delete) ---------- */

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (lastFetcherDataRef.current === fetcher.data) return;
    lastFetcherDataRef.current = fetcher.data;

    if (fetcher.data.success) {
      const msgMap = {
        createWidget: "Widget created successfully!",
        updateWidgetStatus: "Widget status updated successfully!",
        reorderVideos: "Video order updated!",
        deleteVideo: "Video removed from widget!",
      };
      setToastMessage(msgMap[fetcher.data.action] || "Changes saved!");
      setToastError(false);
      setToastActive(true);

      // Safe "reload" using navigate, NOT window.location.reload
      if (fetcher.data.action !== "reorderVideos") {
        navigate(".", { replace: true });
      }
    } else if (fetcher.data.error) {
      setToastMessage(fetcher.data.error || "Failed to save changes.");
      setToastError(true);
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data, navigate]);

  /* ---------- Product fetcher responses ---------- */

  useEffect(() => {
    if (productFetcher.state !== "idle" || !productFetcher.data) return;
    if (lastProductFetcherDataRef.current === productFetcher.data) return;
    lastProductFetcherDataRef.current = productFetcher.data;

    if (
      productFetcher.data.success &&
      productFetcher.data.action === "attachProducts"
    ) {
      setToastMessage("Products attached successfully!");
      setToastError(false);
      setToastActive(true);

      setAddProductModalActive(false);
      setSelectedVideo(null);
      setSelectedProducts([]);
      setOriginalProducts([]);
      setProductSearchValue("");

      // Simple navigate reload
      navigate(".", { replace: true });
    } else if (productFetcher.data.error) {
      setToastMessage(productFetcher.data.error || "Failed to attach products.");
      setToastError(true);
      setToastActive(true);
    }
  }, [productFetcher.state, productFetcher.data, navigate]);

  /* ---------- Handlers ---------- */

  const handleOpenCreateWidget = (widgetType) => {
    setModalWidgetType(widgetType);
    setCreateWidgetModalOpen(true);
  };

  const handleToggleWidgetStatus = (widgetId, currentStatus) => {
    const newStatus = currentStatus === "live" ? "draft" : "live";

    const formData = new FormData();
    formData.append("actionType", "updateWidgetStatus");
    formData.append("widgetId", widgetId);
    formData.append("status", newStatus);

    fetcher.submit(formData, { method: "post" });
  };

  const handleDeleteVideo = (widgetId, videoId) => {
    if (
      !confirm("Are you sure you want to remove this video from the widget?")
    )
      return;

    const formData = new FormData();
    formData.append("actionType", "deleteVideo");
    formData.append("widgetId", widgetId);
    formData.append("videoId", videoId);

    fetcher.submit(formData, { method: "post" });
  };

  const handleOpenAddProductModal = useCallback((video) => {
    const ids = video.videoProducts?.map((vp) => vp.productId) || [];
    setSelectedVideo(video);
    setSelectedProducts(ids);
    setOriginalProducts(ids);
    setAddProductModalActive(true);
  }, []);

  const handleToggleProduct = useCallback(
    (productId) => {
      if (isSavingProducts) return;
      setSelectedProducts((prev) =>
        prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId],
      );
    },
    [isSavingProducts],
  );

  const handleSaveProducts = useCallback(() => {
    if (!selectedVideo || isSavingProducts) return;

    const formData = new FormData();
    formData.append("actionType", "attachProducts");
    formData.append("videoId", selectedVideo.id);
    formData.append("productIds", JSON.stringify(selectedProducts));

    productFetcher.submit(formData, { method: "post" });
  }, [selectedVideo, selectedProducts, productFetcher, isSavingProducts]);

  // DnD
  const handleDragEnd = (result, widgetId, widgetType) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    let videosList;
    let setVideosList;

    if (widgetType === "carousel") {
      videosList = [...carouselVideos];
      setVideosList = setCarouselVideos;
    } else if (widgetType === "story") {
      videosList = [...storyVideos];
      setVideosList = setStoryVideos;
    } else {
      videosList = [...floatingVideos];
      setVideosList = setFloatingVideos;
    }

    const [removed] = videosList.splice(sourceIndex, 1);
    videosList.splice(destIndex, 0, removed);

    setVideosList(videosList);

    const formData = new FormData();
    formData.append("actionType", "reorderVideos");
    formData.append("widgetId", widgetId);
    formData.append("videoIds", JSON.stringify(videosList.map((v) => v.id)));

    fetcher.submit(formData, { method: "post" });
  };

  // ✅ Preview toggle (View / Hide)
  const handleTogglePreviewVideo = (video) => {
    setPreviewVideo((prev) => (prev?.id === video.id ? null : video));
  };

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(productSearchValue.toLowerCase()),
  );

  // ✅ Save only when products changed
  const hasProductChanges = useMemo(() => {
    if (!selectedVideo) return false;
    if (selectedProducts.length !== originalProducts.length) return true;
    const a = [...selectedProducts].sort();
    const b = [...originalProducts].sort();
    return !a.every((id, i) => id === b[i]);
  }, [selectedVideo, selectedProducts, originalProducts]);

  /* ---------- Render Widget Content ---------- */

  const renderWidgetContent = (widget, widgetType) => {
    if (!widget || !widget.isCreated) {
      return (
        <div style={{ padding: "40px 16px" }}>
          <BlockStack gap="400" align="center">
            <Text variant="bodyMd" tone="subdued" alignment="center">
              You have not created <strong>{widgetType}</strong> widget for
              this page. Click on the button below to create it
            </Text>
            <Button onClick={() => handleOpenCreateWidget(widgetType)}>
              + Create {widgetType} widget
            </Button>
          </BlockStack>
        </div>
      );
    }

    let videosList;
    if (widgetType === "carousel") videosList = carouselVideos;
    else if (widgetType === "story") videosList = storyVideos;
    else videosList = floatingVideos;

    return (
      <div style={{ padding: "16px" }}>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200">
              <Badge tone={widget.status === "live" ? "success" : "attention"}>
                {widget.status === "live" ? "Live" : "Draft"}
              </Badge>
              <div
                onClick={() => handleToggleWidgetStatus(widget.id, widget.status)}
                style={{
                  width: "40px",
                  height: "24px",
                  backgroundColor:
                    widget.status === "live" ? "#008060" : "#e3e3e3",
                  borderRadius: "12px",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    backgroundColor: "white",
                    borderRadius: "50%",
                    position: "absolute",
                    top: "2px",
                    left: widget.status === "live" ? "18px" : "2px",
                    transition: "left 0.2s",
                  }}
                />
              </div>
            </InlineStack>
            <Button
              onClick={() =>
                navigate(
                  `/app/page-editor/add-videos/${videoPage.id}?widgetType=${widgetType}`,
                )
              }
            >
              + Add more videos
            </Button>
          </InlineStack>

          {videosList.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  You have not added any videos to this widget
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  Click on "Add more videos" button to add videos
                </Text>
              </BlockStack>
            </div>
          ) : (
            <DragDropContext
              onDragEnd={(result) =>
                handleDragEnd(result, widget.id, widgetType)
              }
            >
              <Droppable droppableId={`widget-${widgetType}`}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    <BlockStack gap="300">
                      {videosList.map((video, index) => {
                        const isPreviewed = previewVideo?.id === video.id;

                        return (
                          <Draggable
                            key={video.id}
                            draggableId={video.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.8 : 1,
                                }}
                              >
                                <Card>
                                  <InlineStack
                                    align="space-between"
                                    blockAlign="center"
                                    gap="400"
                                  >
                                    <div
                                      {...provided.dragHandleProps}
                                      style={{ cursor: "grab" }}
                                    >
                                      <Icon
                                        source={DragHandleIcon}
                                        tone="base"
                                      />
                                    </div>

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

                                    {/* Product pill area - clickable */}
                                    <div
                                      style={{ flex: 1, cursor: "pointer" }}
                                      onClick={() =>
                                        handleOpenAddProductModal(video)
                                      }
                                    >
                                      {video.videoProducts?.length > 0 ? (
                                        <InlineStack gap="100" wrap>
                                          <Badge>
                                            <InlineStack
                                              gap="100"
                                              blockAlign="center"
                                            >
                                              <Thumbnail
                                                source={
                                                  video.videoProducts[0]
                                                    ?.product?.image || ""
                                                }
                                                alt={
                                                  video.videoProducts[0]
                                                    ?.product?.title || ""
                                                }
                                                size="extraSmall"
                                              />
                                              <span
                                                style={{
                                                  maxWidth: "120px",
                                                  overflow: "hidden",
                                                  textOverflow: "ellipsis",
                                                  whiteSpace: "nowrap",
                                                }}
                                              >
                                                {video.videoProducts[0]
                                                  ?.product?.title || "Product"}
                                              </span>
                                            </InlineStack>
                                          </Badge>
                                          {video.videoProducts.length > 1 && (
                                            <Badge>
                                              +
                                              {" " +
                                                (video.videoProducts.length -
                                                  1)}
                                            </Badge>
                                          )}
                                        </InlineStack>
                                      ) : (
                                        <Button
                                          size="slim"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenAddProductModal(video);
                                          }}
                                        >
                                          + Attach products
                                        </Button>
                                      )}
                                    </div>

                                    <InlineStack gap="200">
                                      <Button
                                        icon={
                                          isPreviewed ? HideIcon : ViewIcon
                                        }
                                        variant="plain"
                                        onClick={() =>
                                          handleTogglePreviewVideo(video)
                                        }
                                      />
                                      <Button
                                        icon={DeleteIcon}
                                        variant="plain"
                                        tone="critical"
                                        onClick={() =>
                                          handleDeleteVideo(widget.id, video.id)
                                        }
                                      />
                                    </InlineStack>
                                  </InlineStack>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </BlockStack>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </BlockStack>
      </div>
    );
  };

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      error={toastError}
      duration={3000}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  return (
    <Frame>
      <Page
        title={videoPage.name || "Video Page"}
        subtitle={videoPage.pagePath}
        backAction={{
          content: "Video Pages",
          onAction: () => navigate("/app/video-pages"),
        }}
        primaryAction={{
          content: "Preview in theme",
          onAction: () => window.open(videoPage.pagePath, "_blank"),
        }}
      >
        <Layout>
          <Layout.Section>
            <Card padding="0">
              <Tabs
                tabs={tabs}
                selected={selectedTab}
                onSelect={(index) => setSelectedTab(index)}
              >
                {selectedTab === 0 &&
                  renderWidgetContent(carouselWidget, "carousel")}
                {selectedTab === 1 &&
                  renderWidgetContent(storyWidget, "story")}
                {selectedTab === 2 &&
                  renderWidgetContent(floatingWidget, "floating")}
              </Tabs>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
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
                    <div style={{ width: "100%", maxWidth: "300px" }}>
                      <video
                        src={previewVideo.videoUrl}
                        poster={previewVideo.thumbnailUrl}
                        controls
                        autoPlay
                        style={{
                          width: "100%",
                          borderRadius: "8px",
                          backgroundColor: "#000",
                        }}
                      />
                      {previewVideo.videoProducts?.length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <Text variant="bodyMd" fontWeight="semibold">
                            Attached Products:
                          </Text>
                          <BlockStack gap="200" inlineAlign="start">
                            {previewVideo.videoProducts.map((vp) => (
                              <InlineStack
                                key={vp.productId}
                                gap="200"
                                blockAlign="center"
                              >
                                <Thumbnail
                                  source={vp.product?.image || ""}
                                  alt={vp.product?.title || ""}
                                  size="small"
                                />
                                <Text variant="bodySm">
                                  {vp.product?.title}
                                </Text>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Text variant="bodyMd" tone="subdued">
                      Click on the eye icon to preview a video
                    </Text>
                  )}
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Page Create Modal (old behavior) */}
        <CreateVideoPageModal
          isOpen={createWidgetModalOpen}
          onClose={() => setCreateWidgetModalOpen(false)}
          shopifyPages={shopifyPages}
          videos={allVideos}
          onSuccess={() => {
            console.log("Page created!");
          }}
          actionUrl="/app/video-pages"
        />

        {/* Products Modal */}
        <Modal
          open={addProductModalActive}
          onClose={() => {
            if (isSavingProducts) return;
            setAddProductModalActive(false);
            setSelectedVideo(null);
            setSelectedProducts([]);
            setOriginalProducts([]);
            setProductSearchValue("");
          }}
          title="Add products"
          primaryAction={{
            content: isSavingProducts ? "Saving..." : "Save",
            onAction: handleSaveProducts,
            disabled: isSavingProducts || !hasProductChanges,
            loading: isSavingProducts,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => {
                if (isSavingProducts) return;
                setAddProductModalActive(false);
                setSelectedVideo(null);
                setSelectedProducts([]);
                setOriginalProducts([]);
                setProductSearchValue("");
              },
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
                </BlockStack>
              </Banner>
            )}

            <BlockStack gap="400">
              <TextField
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
                {hasProductChanges && selectedVideo && (
                  <span style={{ color: "#2C6ECB", marginLeft: "6px" }}>
                    • Unsaved changes
                  </span>
                )}
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
                        <Thumbnail
                          source={image || ""}
                          alt={title}
                          size="small"
                        />
                      );
                      const isSelected = selectedProducts.includes(id);

                      return (
                        <ResourceItem
                          id={id}
                          media={media}
                          onClick={() => handleToggleProduct(id)}
                        >
                          <InlineStack
                            align="space-between"
                            blockAlign="center"
                          >
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