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
import CreateWidgetOrPageModal from "../components/CreateWidgetOrPageModal";

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params; // VideoPage ID

  const { getVideoPageById } = await import("../models/videoPage.server");
  const { getVideos } = await import("../models/video.server");
  const { getProducts } = await import("../models/product.server");

  const videoPage = await getVideoPageById(id, session.shop);
  const allVideos = await getVideos(session.shop);
  const products = await getProducts(session.shop);

  if (!videoPage) {
    throw new Response("Video Page not found", { status: 404 });
  }

  return json({
    videoPage,
    allVideos,
    products,
    shop: session.shop,
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
  const { videoPage, allVideos, products, shop } = useLoaderData();
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

  // Product attachment modal states
  const [addProductModalActive, setAddProductModalActive] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSearchValue, setProductSearchValue] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalWidgetType, setModalWidgetType] = useState("");

  const isUpdating = fetcher.state !== "idle";
  const isSavingProducts = productFetcher.state !== "idle";

  // Get widgets for each type
  const carouselWidget = videoPage.widgets?.find((w) => w.widgetType === "carousel");
  const storyWidget = videoPage.widgets?.find((w) => w.widgetType === "story");
  const floatingWidget = videoPage.widgets?.find((w) => w.widgetType === "floating");

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

  // Handle fetcher responses
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
      window.location.reload(); // Reload to get fresh data
    }

    if (fetcher.state === "idle" && fetcher.data?.success === false) {
      setToastMessage("Failed to save changes. Please try again.");
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data]);

  // Handle product attachment
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
    setCreateModalOpen(true);
  };

  const handleCreateWidget = () => {
    if (selectedVideosForWidget.length === 0) return;

    const formData = new FormData();
    formData.append("actionType", "createWidget");
    formData.append("widgetType", selectedWidgetType);
    formData.append("videoIds", JSON.stringify(selectedVideosForWidget));

    fetcher.submit(formData, { method: "post" });
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

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(productSearchValue.toLowerCase())
  );

  const filteredVideosForModal = allVideos.filter(
    (video) =>
      !videoSearchValue ||
      video.videoProducts?.some((vp) =>
        vp.product?.title.toLowerCase().includes(videoSearchValue.toLowerCase())
      )
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

    const videosList = widget.widgetVideos?.map((wv) =>
      allVideos.find((v) => v.id === wv.videoId)
    ).filter(Boolean) || [];

    return (
      <div style={{ padding: "16px" }}>
        <BlockStack gap="400">
          {/* Status Badge and Add Videos Button */}
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

          {/* Videos List */}
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
            <BlockStack gap="300">
              {videosList.map((video) => (
                <Card key={video.id}>
                  <InlineStack align="space-between" blockAlign="center" gap="400">
                    <div style={{ cursor: "grab" }}>
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
                      <Button icon={ViewIcon} variant="plain" onClick={() => {}} />
                      <Button
                        icon={DeleteIcon}
                        variant="plain"
                        tone="critical"
                        onClick={() => handleDeleteVideo(widget.id, video.id)}
                      />
                    </InlineStack>
                  </InlineStack>
                </Card>
              ))}
            </BlockStack>
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
                  <Text variant="bodyMd" tone="subdued">
                    Click on a video to preview it
                  </Text>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Create Widget Modal */}
        <Modal
          open={createWidgetModalActive}
          onClose={() => setCreateWidgetModalActive(false)}
          title={`Create ${selectedWidgetType} widget`}
          primaryAction={{
            content: isUpdating ? "Creating..." : "Create Widget",
            onAction: handleCreateWidget,
            disabled: selectedVideosForWidget.length === 0 || isUpdating,
            loading: isUpdating,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setCreateWidgetModalActive(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                value={videoSearchValue}
                onChange={setVideoSearchValue}
                placeholder="Search videos by product name"
                autoComplete="off"
              />

              <Text variant="bodySm" tone="subdued">
                {selectedVideosForWidget.length} video{selectedVideosForWidget.length !== 1 ? "s" : ""} selected
              </Text>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "16px",
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                {filteredVideosForModal.map((video) => (
                  <div
                    key={video.id}
                    onClick={() =>
                      setSelectedVideosForWidget((prev) =>
                        prev.includes(video.id)
                          ? prev.filter((id) => id !== video.id)
                          : [...prev, video.id]
                      )
                    }
                    style={{
                      cursor: "pointer",
                      border: selectedVideosForWidget.includes(video.id)
                        ? "3px solid #008060"
                        : "2px solid #e1e3e5",
                      borderRadius: "8px",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div style={{ paddingTop: "150%", position: "relative", backgroundColor: "#000" }}>
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
                        }}
                      >
                        <Checkbox
                          checked={selectedVideosForWidget.includes(video.id)}
                          onChange={() => {}}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Add Products Modal */}
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
        {createModalOpen && (
          <CreateWidgetOrPageModal
            open={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            videos={allVideos}
            shopifyPages={[]} 
            mode="createWidget"
            preselectedWidgetType={modalWidgetType}
            videoPageId={videoPage.id}
            onSuccess={() => {
              setToastMessage("Widget created!");
              setToastActive(true);
              window.location.reload();
            }}
          />
        )}
      </Page>
      {toastMarkup}
    </Frame>
  );
}