import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Text,
  BlockStack,
  InlineStack,
  Checkbox,
  EmptyState,
  Banner,
  Spinner,
  Toast,
  Frame,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");

  const { getVideoPageById } = await import("../models/videoPage.server");
  const { getVideos, searchVideos } = await import("../models/video.server");

  const videoPage = await getVideoPageById(id);
  
  if (!videoPage) {
    throw new Response("Video Page not found", { status: 404 });
  }

  let allVideos;
  if (searchQuery) {
    allVideos = await searchVideos(searchQuery);
  } else {
    allVideos = await getVideos();
  }

  // Filter out videos already in this page
  const existingVideoIds = videoPage.videoIds || [];
  const availableVideos = allVideos.filter(
    video => !existingVideoIds.includes(video.id)
  );

  return json({
    videoPage,
    availableVideos,
    existingVideoIds,
  });
};

export const action = async ({ request, params }) => {
  const { id } = params;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "addVideos") {
    const { addVideosToPage } = await import("../models/videoPage.server");
    const videoIds = JSON.parse(formData.get("videoIds") || "[]");

    try {
      await addVideosToPage(id, videoIds);
      return redirect(`/app/video-pages/${id}`);
    } catch (error) {
      console.error("Error adding videos:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return json({ success: false });
};

export default function AddVideosToPage() {
  const { videoPage, availableVideos } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const videoRefs = useRef({});

  const [searchValue, setSearchValue] = useState("");
  const [selectedVideoIds, setSelectedVideoIds] = useState([]);
  const [previewVideoId, setPreviewVideoId] = useState(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success === false) {
      setToastMessage("Failed to add videos. Please try again.");
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data]);

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    if (searchValue.trim()) {
      navigate(`/app/video-pages/add-videos/${videoPage.id}?search=${encodeURIComponent(searchValue)}`);
    } else {
      navigate(`/app/video-pages/add-videos/${videoPage.id}`);
    }
  }, [searchValue, navigate, videoPage.id]);

  const handleToggleVideo = useCallback((videoId) => {
    if (isSaving) return;
    setSelectedVideoIds(prev =>
      prev.includes(videoId)
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  }, [isSaving]);

  const handleVideoClick = useCallback((videoId) => {
    if (previewVideoId === videoId) {
      const videoElement = videoRefs.current[videoId];
      if (videoElement) {
        videoElement.pause();
      }
      setPreviewVideoId(null);
    } else {
      // Pause previous video
      if (previewVideoId) {
        const prevVideoElement = videoRefs.current[previewVideoId];
        if (prevVideoElement) {
          prevVideoElement.pause();
        }
      }
      
      setPreviewVideoId(videoId);
      
      // Play new video
      setTimeout(() => {
        const videoElement = videoRefs.current[videoId];
        if (videoElement) {
          videoElement.play();
        }
      }, 100);
    }
  }, [previewVideoId]);

  const handleSave = useCallback(() => {
    if (selectedVideoIds.length === 0 || isSaving) return;

    const formData = new FormData();
    formData.append("actionType", "addVideos");
    formData.append("videoIds", JSON.stringify(selectedVideoIds));

    fetcher.submit(formData, { method: "post" });
  }, [selectedVideoIds, fetcher, isSaving]);

  const filteredVideos = availableVideos.filter(video => {
    if (!searchValue.trim()) return true;
    
    const searchLower = searchValue.toLowerCase();
    const titleMatch = video.title?.toLowerCase().includes(searchLower);
    const productMatch = video.videoProducts?.some(vp =>
      vp.product?.title?.toLowerCase().includes(searchLower)
    );
    
    return titleMatch || productMatch;
  });

  const previewVideo = previewVideoId
    ? availableVideos.find(v => v.id === previewVideoId)
    : null;

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
          onAction: () => navigate(`/app/video-pages/${videoPage.id}`),
        }}
        primaryAction={{
          content: isSaving ? "Saving..." : "Save",
          onAction: handleSave,
          disabled: selectedVideoIds.length === 0 || isSaving,
          loading: isSaving,
        }}
      >
        <Layout>
          <Layout.Section>
            {isSaving && (
              <Banner tone="info">
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Spinner size="small" />
                    <Text variant="bodyMd" fontWeight="semibold">
                      Adding videos to playlist...
                    </Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    Please wait while we update the playlist
                  </Text>
                </BlockStack>
              </Banner>
            )}
          </Layout.Section>

          <Layout.Section secondary>
            <Card>
              <BlockStack gap="400">
                <TextField
                  label=""
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder="Search videos"
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => {
                    setSearchValue("");
                    navigate(`/app/video-pages/${videoPage.id}/add-videos`);
                  }}
                  disabled={isSaving}
                  connectedRight={
                    <Button onClick={handleSearchSubmit} disabled={isSaving}>
                      Search
                    </Button>
                  }
                />

                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodyMd" tone="subdued">
                    Video Type
                  </Text>
                </InlineStack>

                <div
                  style={{
                    maxHeight: "600px",
                    overflowY: "auto",
                    opacity: isSaving ? 0.5 : 1,
                    pointerEvents: isSaving ? "none" : "auto",
                  }}
                >
                  {filteredVideos.length === 0 ? (
                    <EmptyState
                      heading={availableVideos.length === 0 ? "No videos available" : "No videos found"}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>
                        {availableVideos.length === 0
                          ? "All videos from your library are already added to this playlist"
                          : "Try changing the search term"}
                      </p>
                    </EmptyState>
                  ) : (
                    <BlockStack gap="300">
                      {filteredVideos.map((video) => {
                        const isSelected = selectedVideoIds.includes(video.id);
                        const attachedProducts = video.videoProducts || [];

                        return (
                          <Card key={video.id}>
                            <InlineStack
                              align="space-between"
                              blockAlign="start"
                              gap="400"
                            >
                              <InlineStack gap="300" blockAlign="start">
                                <div style={{ paddingTop: "4px" }}>
                                  <Checkbox
                                    checked={isSelected}
                                    onChange={() => handleToggleVideo(video.id)}
                                    disabled={isSaving}
                                  />
                                </div>
                                
                                <div
                                  style={{
                                    width: "80px",
                                    height: "120px",
                                    position: "relative",
                                    backgroundColor: "#000",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    flexShrink: 0,
                                  }}
                                  onClick={() => handleVideoClick(video.id)}
                                >
                                  <img
                                    src={video.thumbnailUrl}
                                    alt={video.title}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "50%",
                                      left: "50%",
                                      transform: "translate(-50%, -50%)",
                                      width: "32px",
                                      height: "32px",
                                      backgroundColor: "rgba(0,0,0,0.6)",
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "white",
                                      fontSize: "12px",
                                    }}
                                  >
                                    ▶
                                  </div>
                                </div>

                                <BlockStack gap="100">
                                  <Text variant="bodyMd" fontWeight="medium">
                                    {video.title || "Untitled Video"}
                                  </Text>
                                  {attachedProducts.length > 0 && (
                                    <Text variant="bodySm" tone="subdued">
                                      {attachedProducts.length} product
                                      {attachedProducts.length !== 1 ? "s" : ""} tagged
                                    </Text>
                                  )}
                                </BlockStack>
                              </InlineStack>

                              <Button
                                onClick={() => handleVideoClick(video.id)}
                                disabled={isSaving}
                              >
                                {previewVideoId === video.id ? "Hide" : "Attach a product"}
                              </Button>
                            </InlineStack>
                          </Card>
                        );
                      })}
                    </BlockStack>
                  )}
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <div
                  style={{
                    border: "1px solid #e1e3e5",
                    borderRadius: "12px",
                    overflow: "hidden",
                    backgroundColor: "#000",
                    minHeight: "500px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {previewVideo ? (
                    <video
                      ref={(el) => (videoRefs.current[previewVideo.id] = el)}
                      src={previewVideo.videoUrl}
                      poster={previewVideo.thumbnailUrl}
                      controls
                      style={{
                        width: "100%",
                        height: "100%",
                        maxHeight: "500px",
                        objectFit: "contain",
                      }}
                      onEnded={() => setPreviewVideoId(null)}
                    />
                  ) : (
                    <Text variant="bodyMd" tone="subdued">
                      Click on a video to preview it
                    </Text>
                  )}
                </div>

                {previewVideo && (
                  <BlockStack gap="200">
                    <Button
                      fullWidth
                      onClick={() => {
                        // Navigate to product attachment or open modal
                        setToastMessage("Product attachment feature coming soon");
                        setToastActive(true);
                      }}
                    >
                      + Attach a product
                    </Button>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
      {toastMarkup}
    </Frame>
  );
}