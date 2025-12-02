// app/components/CreateVideoPageModal.jsx

import { useState, useCallback, useEffect } from "react";
import { useFetcher, useNavigate } from "@remix-run/react";
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Button,
  TextField,
  Autocomplete,
  Checkbox,
  Banner,
  Spinner,
  EmptyState,
  Pagination,
  Popover,
} from "@shopify/polaris";

const WIDGET_TYPES = [
  {
    id: "carousel",
    name: "Carousel",
    image:
      "https://cdn.shopify.com/s/files/1/0580/9258/5030/files/quinn_m28baghh95hofagj8nlpeppc.png?v=1760445583",
  },
  {
    id: "story",
    name: "Story",
    image:
      "https://cdn.shopify.com/s/files/1/0580/9258/5030/files/quinn_b5w8kph5ndijcw77zufk31be.png?v=1760445582",
  },
  {
    id: "floating",
    name: "Floating",
    image:
      "https://cdn.shopify.com/s/files/1/0580/9258/5030/files/quinn_ng19ck1x9ipqa5v01ei6zeb2.png?v=1760445582",
  },
];

export default function CreateVideoPageModal({
  isOpen,
  onClose,
  shopifyPages = [],
  videos = [],
  onSuccess,
  actionUrl = "/app/video-pages", 
}) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedWidget, setSelectedWidget] = useState("");
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [pageSearchValue, setPageSearchValue] = useState("");
  const [videoSearchValue, setVideoSearchValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const VIDEOS_PER_PAGE = 4;         
  const [currentVideoPage, setCurrentVideoPage] = useState(1);

  // Filters
  const [filterPopoverActive, setFilterPopoverActive] = useState(false);
  const [filterTagged, setFilterTagged] = useState(false);
  const [filterUntagged, setFilterUntagged] = useState(false);

  const toggleFilterPopover = useCallback(
    () => setFilterPopoverActive((prev) => !prev),
    []
  );

  useEffect(() => {
    setCurrentVideoPage(1);
  }, [videoSearchValue, videos.length, filterTagged, filterUntagged]);

  const isCreating = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (fetcher.data.success) {
      setErrorMessage("");

      setCurrentStep(1);
      setSelectedWidget("");
      setSelectedPage("");
      setSelectedVideos([]);
      setPageSearchValue("");
      setVideoSearchValue("");

      if (onSuccess) onSuccess();
      onClose();
    } else if (fetcher.data.error) {
      setErrorMessage(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    if (isCreating) return;
    
    // Reset state
    setCurrentStep(1);
    setSelectedWidget("");
    setSelectedPage("");
    setSelectedVideos([]);
    setPageSearchValue("");
    setVideoSearchValue("");
    setErrorMessage("");
    
    onClose();
  }, [isCreating, onClose]);

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
        : [...prev, videoId]
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

    fetcher.submit(formData, { method: "post", action: actionUrl });
  };

  const filteredPages = shopifyPages.filter((page) =>
    page.title.toLowerCase().includes(pageSearchValue.toLowerCase())
  );

  const filteredVideos = videos.filter((video) => {
    const title = (video.title || "").toLowerCase();
    const matchesSearch =
      !videoSearchValue ||
      title.includes(videoSearchValue.toLowerCase());

    if (!matchesSearch) return false;

    const hasProducts =
      Array.isArray(video.videoProducts) &&
      video.videoProducts.length > 0;

    if (filterTagged && !filterUntagged) {
      return hasProducts;
    }
    if (!filterTagged && filterUntagged) {
      return !hasProducts;
    }
    return true; 
  });

  const totalVideoPages = Math.max(
    1,
    Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE)
  );

  const startIndex = (currentVideoPage - 1) * VIDEOS_PER_PAGE;
  const paginatedVideos = filteredVideos.slice(
    startIndex,
    startIndex + VIDEOS_PER_PAGE
  );

  return (
    <Modal
      large
      open={isOpen}
      onClose={handleClose}
      size="large"
      title="Add videos to a new page"
    >
      <Modal.Section>
         <div
          style={{
            marginBottom: "20px",
            padding: "0 8px",
            opacity: isCreating ? 0.6 : 1,
            pointerEvents: isCreating ? "none" : "auto",
          }}
        >
          {/* Top step bar + label */}
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingSm" as="h3">
              Add videos to a new page
            </Text>
            <Text variant="bodySm" tone="subdued">
              Step {currentStep} of 2
            </Text>
          </InlineStack>

          <div
            style={{
              marginTop: "10px",
              width: "100%",
              height: "4px",
              backgroundColor: "#e3e5e8",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: currentStep === 1 ? "50%" : "100%",
                height: "100%",
                background:
                  "linear-gradient(90deg, #000000 0%, #303030 50%, #000000 100%)",
                borderRadius: "inherit",
                transition: "width 0.3s ease",
              }}
            />
          </div>
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

        {errorMessage && (
          <div style={{ marginBottom: "16px" }}>
            <Banner
              tone="critical"
              title="Error"
              onDismiss={() => setErrorMessage("")}
            >
              <p>{errorMessage}</p>
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
                    gap: "24px",
                    justifyContent: "center",  
                    alignItems: "flex-start",
                    flexWrap: "nowrap",
                    width: "100%",
                  }}
                >
                  {WIDGET_TYPES.map((widget) => {
                    const isActive = selectedWidget === widget.id;
                    return (
                      <div
                        key={widget.id}
                        onClick={() => handleWidgetSelect(widget.id)}
                        style={{
                          cursor: "pointer",
                          width: "300px",                
                          flex: "0 0 auto",
                          borderRadius: "16px",
                          padding: "20px 20px 16px",
                          backgroundColor: isActive ? "#f3fbf7" : "#fafafa",
                          border: isActive
                            ? "2px solid #008060"
                            : "1px solid #dde0e4",
                          boxShadow: isActive
                            ? "0 2px 10px rgba(0, 128, 96, 0.25)"
                            : "0 1px 3px rgba(0,0,0,0.06)",
                          transform: isActive ? "translateY(-2px)" : "translateY(0)",
                          transition: "all 0.18s ease-out",
                        }}
                      >
                        <BlockStack gap="300" align="center">
                          <img
                              src={widget.image}
                              alt={widget.name}
                              style={{
                                maxWidth: "150px",
                                maxHeight: "100%",
                                objectFit: "contain", 
                                display: "block",
                                margin: "0 auto",
                              }}
                            />
                          <Text
                            variant="bodyMd"
                            fontWeight={isActive ? "bold" : "semibold"}
                            alignment="center"
                          >
                            {widget.name}
                          </Text>
                          <Text
                            variant="bodySm"
                            tone="subdued"
                            alignment="center"
                          >
                            {widget.id === "carousel" &&
                              "Horizontal video strip for any page"}
                            {widget.id === "story" &&
                              "Instagram-style stories at the top"}
                            {widget.id === "floating" &&
                              "Floating bubble that follows the shopper"}
                          </Text>
                        </BlockStack>
                      </div>
                    );
                  })}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  Select Page
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  Choose a page, product, or collection where your widget will
                  appear.
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
                        (g) => g.title === groupTitle
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
                          .includes(pageSearchValue.toLowerCase())
                      ),
                    }))
                    .filter((group) => group.options.length > 0)}
                  selected={selectedPage ? [selectedPage] : []}
                  onSelect={(selected) => {
                    const selectedId = selected[0];
                    const selectedOption = shopifyPages.find(
                      (p) => p.id === selectedId
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
                  variant="primary"
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
              {/* Top back button */}
              <InlineStack align="start">
                <Button onClick={handleBackStep} variant="primary">Back</Button>
              </InlineStack>

              {/* Main content */}
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  Select Videos
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  Choose videos to add to your widget. These will appear on your
                  selected store page.
                </Text>

                {/* Search + Filters row */}
                <InlineStack align="space-between" gap="200">
                  <div style={{ flex: 1 }}>
                    <TextField
                      value={videoSearchValue}
                      onChange={setVideoSearchValue}
                      placeholder="Search videos"
                      autoComplete="off"
                    />
                  </div>

                  <Popover
                    active={filterPopoverActive}
                    activator={
                      <Button disclosure onClick={toggleFilterPopover}>
                        Filters
                      </Button>
                    }
                    onClose={toggleFilterPopover}
                  >
                    <div style={{ padding: "12px 16px", minWidth: "180px" }}>
                      <Text variant="bodySm" fontWeight="semibold">
                        Video Type
                      </Text>
                      <BlockStack gap="100" style={{ marginTop: "8px" }}>
                        <Checkbox
                          label="Tagged"
                          checked={filterTagged}
                          onChange={(value) => setFilterTagged(value)}
                        />
                        <Checkbox
                          label="Un-tagged"
                          checked={filterUntagged}
                          onChange={(value) => setFilterUntagged(value)}
                        />
                      </BlockStack>
                    </div>
                  </Popover>
                </InlineStack>

                {/* Selected count */}
                <Text variant="bodySm" tone="subdued">
                  {selectedVideos.length} video
                  {selectedVideos.length !== 1 ? "s" : ""} selected
                </Text>

                {/* Videos grid – ye wahi design hai jo pehle sahi chal raha tha */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "16px",
                    maxHeight: "460px",
                    overflowY: "auto",
                    padding: "4px",
                  }}
                >
                  {paginatedVideos.map((video) => {
                    const isSelected = selectedVideos.includes(video.id);
                    const attached = video.videoProducts || [];
                    const firstProduct = attached[0]?.product;
                    const extraCount =
                      attached.length > 1 ? attached.length - 1 : 0;

                    return (
                      <div
                        key={video.id}
                        onClick={() => handleVideoToggle(video.id)}
                        style={{
                          cursor: "pointer",
                          border: isSelected
                            ? "2px solid #008060"
                            : "1px solid #d2d5d8",
                          borderRadius: "12px",
                          overflow: "hidden",
                          position: "relative",
                          transition: "all 0.15s ease",
                          boxShadow: isSelected
                            ? "0 0 0 1px #008060, 0 2px 8px rgba(0,0,0,0.08)"
                            : "0 1px 4px rgba(0,0,0,0.04)",
                          backgroundColor: "#fff",
                        }}
                      >
                        {/* Video preview */}
                        <div
                          style={{
                            paddingTop: "130%",
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
                            muted
                          />

                          {/* Checkbox top-right */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              borderRadius: "999px",
                              padding: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              onChange={() => handleVideoToggle(video.id)}
                            />
                          </div>
                        </div>

                        {/* Products pills */}
                        <div
                          style={{
                            padding: "10px 10px 12px",
                            minHeight: "64px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {attached.length === 0 ? (
                            <Text variant="bodySm" tone="subdued">
                              No products tagged
                            </Text>
                          ) : (
                            <>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "4px 8px",
                                  borderRadius: "999px",
                                  backgroundColor: "#f5f5f5",
                                  border: "1px solid #dddfe2",
                                  maxWidth: "100%",
                                }}
                              >
                                {firstProduct?.image && (
                                  <img
                                    src={firstProduct.image}
                                    alt={firstProduct.title || ""}
                                    style={{
                                      width: "20px",
                                      height: "20px",
                                      borderRadius: "4px",
                                      objectFit: "cover",
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    fontSize: "12px",
                                    whiteSpace: "nowrap",
                                    textOverflow: "ellipsis",
                                    overflow: "hidden",
                                    maxWidth: "120px",
                                  }}
                                >
                                  {firstProduct?.title || "Product"}
                                </span>
                              </div>

                              {extraCount > 0 && (
                                <div
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: "999px",
                                    border: "1px solid #dddfe2",
                                    fontSize: "12px",
                                    backgroundColor: "#fff",
                                  }}
                                >
                                  + {extraCount}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {filteredVideos.length > VIDEOS_PER_PAGE && (
                  <InlineStack
                    align="center"
                    blockAlign="center"
                    gap="200"
                    style={{ marginTop: "16px" }}
                  >
                    <Pagination
                      hasPrevious={currentVideoPage > 1}
                      onPrevious={() =>
                        setCurrentVideoPage((prev) => Math.max(1, prev - 1))
                      }
                      hasNext={currentVideoPage < totalVideoPages}
                      onNext={() =>
                        setCurrentVideoPage((prev) =>
                          Math.min(totalVideoPages, prev + 1),
                        )
                      }
                    />
                    <Text tone="subdued" variant="bodySm">
                      Page {currentVideoPage} of {totalVideoPages}
                    </Text>
                  </InlineStack>
                )}

                {/* Empty state */}
                {filteredVideos.length === 0 && (
                  <EmptyState
                    heading="No videos found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Upload videos first to add them to your page</p>
                    <Button onClick={() => navigate("/app")}>Upload Videos</Button>
                  </EmptyState>
                )}
              </BlockStack>

              {/* Bottom actions */}
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
  );
}