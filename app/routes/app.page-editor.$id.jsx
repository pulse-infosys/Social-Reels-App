import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
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
import { DragHandleIcon, ViewIcon, DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import CreateVideoPageModal from "../components/CreateVideoPageModal";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params;

  const { getVideoPageById } = await import("../models/videoPage.server");
  const { getVideos } = await import("../models/video.server");
  const { getProducts } = await import("../models/product.server");
  const { getAllShopifyResources } = await import("../utils/shopifyResources.server");

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
      return json({ success: true, action: "updateWidgetStatus" });
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
      return json({ success: true, action: "attachProducts" });
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
      return json({ success: true, action: "deleteVideo" });
    } catch (error) {
      console.error("Error removing video:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return json({ success: false });
};

export default function VideoPageEdit() {
  const { videoPage, allVideos, products, shop, shopifyPages } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const productFetcher = useFetcher();

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);
  const [createWidgetModalActive, setCreateWidgetModalActive] = useState(false);
  const [selectedWidgetType, setSelectedWidgetType] = useState("");
  const [selectedVideosForWidget, setSelectedVideosForWidget] = useState([]);
  const [videoSearchValue, setVideoSearchValue] = useState("");

  // Preview state
  const [previewVideo, setPreviewVideo] = useState(null);

  // Product attachment modal states
  const [addProductModalActive, setAddProductModalActive] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSearchValue, setProductSearchValue] = useState("");
  const [createWidgetModalOpen, setCreateWidgetModalOpen] = useState(false);
  const [modalWidgetType, setModalWidgetType] = useState("");

  // Local state for video order
  const [carouselVideos, setCarouselVideos] = useState([]);
  const [storyVideos, setStoryVideos] = useState([]);
  const [floatingVideos, setFloatingVideos] = useState([]);

  const isUpdating = fetcher.state !== "idle";
  const isSavingProducts = productFetcher.state !== "idle";

  // Get widgets for each type
  const carouselWidget = videoPage.widgets?.find((w) => w.widgetType === "carousel");
  const storyWidget = videoPage.widgets?.find(
    (w) => w.widgetType === "stories" || w.widgetType.includes("story")
  );
  const floatingWidget = videoPage.widgets?.find((w) => w.widgetType === "floating");

  // Initialize video lists
  useEffect(() => {
    if (carouselWidget?.widgetVideos) {
      const videos = carouselWidget.widgetVideos
        .map((wv) => allVideos.find((v) => v.id === wv.videoId))
        .filter(Boolean);
      setCarouselVideos(videos);
    }

    if (storyWidget?.widgetVideos) {
      const videos = storyWidget.widgetVideos
        .map((wv) => allVideos.find((v) => v.id === wv.videoId))
        .filter(Boolean);
      setStoryVideos(videos);
    }

    if (floatingWidget?.widgetVideos) {
      const videos = floatingWidget.widgetVideos
        .map((wv) => allVideos.find((v) => v.id === wv.videoId))
        .filter(Boolean);
      setFloatingVideos(videos);
    }
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

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      if (fetcher.data.action === "createWidget") {
        setToastMessage("Widget created successfully!");
        setCreateWidgetModalActive(false);
        setSelectedVideosForWidget([]);
      } else {
        setToastMessage("Changes saved successfully!");
      }
      setToastActive(true);
      if (fetcher.data.action !== "reorderVideos") {
        window.location.reload();
      }
    }

    if (fetcher.state === "idle" && fetcher.data?.success === false) {
      setToastMessage("Failed to save changes. Please try again.");
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (productFetcher.state === "idle" && productFetcher.data?.success && productFetcher.data?.action === "attachProducts") {
      setToastMessage("Products attached successfully!");
      setToastActive(true);
      setAddProductModalActive(false);
      setSelectedVideo(null);
      setSelectedProducts([]);
      setProductSearchValue("");
      window.location.reload();
    }
  }, [productFetcher.state, productFetcher.data]);

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
    if (!confirm("Are you sure you want to remove this video from the widget?")) return;

    const formData = new FormData();
    formData.append("actionType", "deleteVideo");
    formData.append("widgetId", widgetId);
    formData.append("videoId", videoId);

    fetcher.submit(formData, { method: "post" });
  };

  const handleOpenAddProductModal = useCallback((video) => {
    setSelectedVideo(video);
    setSelectedProducts(video.videoProducts?.map((vp) => vp.productId) || []);
    setAddProductModalActive(true);
  }, []);

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

  // Handle drag end
  const handleDragEnd = (result, widgetId, widgetType) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    // Get the appropriate video list
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

    // Reorder the list
    const [removed] = videosList.splice(sourceIndex, 1);
    videosList.splice(destIndex, 0, removed);

    // Update local state immediately
    setVideosList(videosList);

    // Save to server
    const formData = new FormData();
    formData.append("actionType", "reorderVideos");
    formData.append("widgetId", widgetId);
    formData.append("videoIds", JSON.stringify(videosList.map(v => v.id)));

    fetcher.submit(formData, { method: "post" });
  };

  // Handle preview video
  const handlePreviewVideo = (video) => {
    setPreviewVideo(video);
  };

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(productSearchValue.toLowerCase())
  );

  const renderWidgetContent = (widget, widgetType) => {
    if (!widget || !widget.isCreated) {
      return (
        <div style={{ padding: "40px 16px" }}>
          <BlockStack gap="400" align="center">
            <Text variant="bodyMd" tone="subdued" alignment="center">
              You have not created <strong>{widgetType}</strong> widget for this page. Click on the button below to create it
            </Text>
            <Button onClick={() => handleOpenCreateWidget(widgetType)}>
              + Create {widgetType} widget
            </Button>
          </BlockStack>
        </div>
      );
    }

    // Get the appropriate video list
    let videosList;
    if (widgetType === "carousel") {
      videosList = carouselVideos;
    } else if (widgetType === "story") {
      videosList = storyVideos;
    } else {
      videosList = floatingVideos;
    }

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
                  backgroundColor: widget.status === "live" ? "#008060" : "#e3e3e3",
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
            <Button onClick={() => navigate(`/app/page-editor/add-videos/${videoPage.id}?widgetType=${widgetType}`)}>
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
            <DragDropContext onDragEnd={(result) => handleDragEnd(result, widget.id, widgetType)}>
              <Droppable droppableId={`widget-${widgetType}`}>
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    <BlockStack gap="300">
                      {videosList.map((video, index) => (
                        <Draggable key={video.id} draggableId={video.id} index={index}>
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
                                <InlineStack align="space-between" blockAlign="center" gap="400">
                                  <div 
                                    {...provided.dragHandleProps}
                                    style={{ cursor: "grab" }}
                                  >
                                    <Icon source={DragHandleIcon} tone="base" />
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

                                  <div style={{ flex: 1 }}>
                                    {video.videoProducts?.length > 0 ? (
                                      <InlineStack gap="100" wrap>
                                        <Badge>
                                          <InlineStack gap="100" blockAlign="center">
                                            <Thumbnail
                                              source={video.videoProducts[0]?.product?.image || ""}
                                              alt={video.videoProducts[0]?.product?.title || ""}
                                              size="extraSmall"
                                            />
                                            <span style={{ 
                                              maxWidth: "120px", 
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap" 
                                            }}>
                                              {video.videoProducts[0]?.product?.title || "Product"}
                                            </span>
                                          </InlineStack>
                                        </Badge>
                                        {video.videoProducts.length > 1 && (
                                          <Badge>+ {video.videoProducts.length - 1}</Badge>
                                        )}
                                      </InlineStack>
                                    ) : (
                                      <Button size="slim" onClick={() => handleOpenAddProductModal(video)}>
                                        + Attach products
                                      </Button>
                                    )}
                                  </div>

                                  <InlineStack gap="200">
                                    <Button 
                                      icon={ViewIcon} 
                                      variant="plain" 
                                      onClick={() => handlePreviewVideo(video)}
                                    />
                                    <Button
                                      icon={DeleteIcon}
                                      variant="plain"
                                      tone="critical"
                                      onClick={() => handleDeleteVideo(widget.id, video.id)}
                                    />
                                  </InlineStack>
                                </InlineStack>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
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
          onAction: () => {
            window.open(videoPage.pagePath, "_blank");
          },
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
                {selectedTab === 0 && renderWidgetContent(carouselWidget, "carousel")}
                {selectedTab === 1 && renderWidgetContent(storyWidget, "story")}
                {selectedTab === 2 && renderWidgetContent(floatingWidget, "floating")}
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
                              <InlineStack key={vp.productId} gap="200" blockAlign="center">
                                <Thumbnail
                                  source={vp.product?.image || ""}
                                  alt={vp.product?.title || ""}
                                  size="small"
                                />
                                <Text variant="bodySm">{vp.product?.title}</Text>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Text variant="bodyMd" tone="subdued">
                      Click on a video to preview it
                    </Text>
                  )}
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

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

        <Modal
          open={addProductModalActive}
          onClose={() => setAddProductModalActive(false)}
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
              onAction: () => setAddProductModalActive(false),
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
                {selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""} selected
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
                      const media = <Thumbnail source={image || ""} alt={title} size="small" />;
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