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
  actionUrl = "/app/video-pages", // Default action URL
}) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedWidget, setSelectedWidget] = useState("");
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [pageSearchValue, setPageSearchValue] = useState("");
  const [videoSearchValue, setVideoSearchValue] = useState("");

  const isCreating = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      // Reset state
      setCurrentStep(1);
      setSelectedWidget("");
      setSelectedPage("");
      setSelectedVideos([]);
      setPageSearchValue("");
      setVideoSearchValue("");
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Close modal
      onClose();
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

  const filteredVideos = videos.filter(
    (video) =>
      !videoSearchValue ||
      video.title?.toLowerCase().includes(videoSearchValue.toLowerCase())
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
                  Choose videos to add to your widget. These will appear on your
                  selected store page.
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
  );
}