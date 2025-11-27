// app/components/CreateWidgetModal.jsx

import { useState, useCallback, useEffect, useMemo } from "react";
import { useFetcher, useNavigate } from "@remix-run/react";
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Checkbox,
  Banner,
  Spinner,
  EmptyState,
  TextField,
  Button,
} from "@shopify/polaris";

export default function CreateWidgetModal({
  isOpen,
  onClose,
  videos = [],
  onSuccess,
  widgetType, // "carousel", "story", or "floating"
  pageId,
  pageName,
  actionUrl,
}) {
  const fetcher = useFetcher();

  const [selectedVideos, setSelectedVideos] = useState([]);
  const [videoSearchValue, setVideoSearchValue] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const navigate = useNavigate();

  const isCreating = fetcher.state !== "idle";

  // Filter videos based on search
  const filteredVideos = useMemo(() => {
    return videos.filter(
      (video) =>
        !videoSearchValue ||
        video.title?.toLowerCase().includes(videoSearchValue.toLowerCase()) ||
        video.id?.toLowerCase().includes(videoSearchValue.toLowerCase())
    );
  }, [videos, videoSearchValue]);

  // Update "Select All" state automatically
  useEffect(() => {
    if (
      filteredVideos.length > 0 &&
      selectedVideos.length === filteredVideos.length
    ) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedVideos, filteredVideos]);

  // Reset on close or success
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setSelectedVideos([]);
      setVideoSearchValue("");
      setSelectAll(false);
      onSuccess?.();
      onClose();
    }
  }, [fetcher.state, fetcher.data]);

  const handleClose = useCallback(() => {
    if (isCreating) return;
    setSelectedVideos([]);
    setVideoSearchValue("");
    setSelectAll(false);
    onClose();
  }, [isCreating, onClose]);

  const handleSelectAll = () => {
    if (selectAll || selectedVideos.length === filteredVideos.length) {
      setSelectedVideos([]);
    } else {
      setSelectedVideos(filteredVideos.map((v) => v.id));
    }
  };

  const handleVideoToggle = (videoId) => {
    if (isCreating) return;

    setSelectedVideos((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId]
    );
  };

  const handleCreateWidget = () => {
    if (selectedVideos.length === 0 || isCreating) return;

    const formData = new FormData();
    formData.append("actionType", "createWidget");
    formData.append("widgetType", widgetType);
    formData.append("pageId", pageId);
    formData.append("videoIds", JSON.stringify(selectedVideos));

    fetcher.submit(formData, {
      method: "post",
      action: actionUrl,
    });
  };

  const widgetTypeDisplay =
    widgetType.charAt(0).toUpperCase() + widgetType.slice(1);

  return (
    <Modal
      large
      open={isOpen}
      onClose={handleClose}
      title={`Create ${widgetTypeDisplay} Widget`}
      primaryAction={{
        content: isCreating ? "Creating..." : "Create Widget",
        onAction: handleCreateWidget,
        disabled: selectedVideos.length === 0 || isCreating,
        loading: isCreating,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: handleClose,
          disabled: isCreating,
        },
      ]}
    >
      <Modal.Section>
        {/* Loading Banner */}
        {isCreating && (
          <Banner tone="info" style={{ marginBottom: "16px" }}>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Spinner size="small" />
                <Text variant="bodyMd" fontWeight="semibold">
                  Creating {widgetTypeDisplay.toLowerCase()} widget...
                </Text>
              </InlineStack>
              <Text variant="bodySm" tone="subdued">
                Please wait while we set up your widget
              </Text>
            </BlockStack>
          </Banner>
        )}

        {/* Error Banner */}
        {fetcher.data?.error && !isCreating && (
          <Banner tone="critical" style={{ marginBottom: "16px" }}>
            <Text variant="bodyMd">{fetcher.data.error}</Text>
          </Banner>
        )}

        <div
          style={{
            opacity: isCreating ? 0.5 : 1,
            pointerEvents: isCreating ? "none" : "auto",
          }}
        >
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">
                Page: {pageName || "Untitled Page"}
              </Text>
              <Text variant="bodySm" tone="subdued">
                Select videos to add to your{" "}
                {widgetTypeDisplay.toLowerCase()} widget
              </Text>
            </BlockStack>

            {/* Search Field */}
            <TextField
              value={videoSearchValue}
              onChange={setVideoSearchValue}
              placeholder="Search videos by title or ID"
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setVideoSearchValue("")}
            />

            {/* Select All + Count */}
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="300" blockAlign="center">
                <Checkbox
                  label="Select All"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  disabled={filteredVideos.length === 0 || isCreating}
                />
                <Text variant="bodySm" tone="subdued">
                  {selectedVideos.length} of {filteredVideos.length} video
                  {filteredVideos.length !== 1 ? "s" : ""} selected
                </Text>
              </InlineStack> 
              <Button onClick={navigate('/app')} variant="primary">Upload Video</Button>
            </InlineStack>



            {/* Video list – horizontal rows like your screenshot */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "520px",
                overflowY: "auto",
                padding: "8px 4px",
                borderRadius: "12px",
                backgroundColor: "#fafbfc",
              }}
            >
              {filteredVideos.length === 0 ? (
                <EmptyState
                  heading="No videos found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <Text variant="bodyMd" tone="subdued">
                    {videoSearchValue
                      ? "Try adjusting your search or clear it"
                      : "Upload some videos first to create a widget"}
                  </Text>
                </EmptyState>
              ) : (
                filteredVideos.map((video) => {
                  const isSelected = selectedVideos.includes(video.id);
                  const productCount = video.videoProducts?.length || 0;

                  return (
                    <div
                      key={video.id}
                      onClick={() => handleVideoToggle(video.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        backgroundColor: isSelected ? "#f0f8f5" : "#ffffff",
                        border: isSelected
                          ? "2px solid #008060"
                          : "1px solid #e1e3e5",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        cursor: "pointer",
                      }}
                    >
                      {/* Checkbox on the left */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ flexShrink: 0 }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleVideoToggle(video.id)}
                          label=""
                        />
                      </div>

                      {/* Thumbnail */}
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: "10px",
                          overflow: "hidden",
                          backgroundColor: "#000",
                          flexShrink: 0,
                        }}
                      >
                        <video
                          src={video.videoUrl}
                          poster={video.thumbnailUrl || undefined}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          preload="metadata"
                          muted
                        />
                      </div>

                      {/* Title / info in the middle */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                        }}
                      >
                        {/* pill style similar to screenshot */}
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            maxWidth: "100%",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            backgroundColor: "#f3f4f6",
                            gap: "6px",
                          }}
                        >
                          {/* small icon placeholder (optional) */}
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              backgroundColor: "#e5e7eb",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: "13px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {video.title || "Untitled Video"}
                          </span>
                        </div>
                      </div>

                      {/* Product count on the right */}
                      <div style={{ flexShrink: 0 }}>
                        <div
                          style={{
                            padding: "4px 12px",
                            borderRadius: "999px",
                            backgroundColor: "#f3f4f6",
                            fontSize: "13px",
                          }}
                        >
                          {productCount > 0 ? `+${productCount}` : "+0"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </BlockStack>
        </div>
      </Modal.Section>
    </Modal>
  );
}