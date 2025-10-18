import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Frame,
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Text,
  TextField,
  Spinner,
  Toast,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  const { getVideoPageById } = await import("../models/videoPage.server");
  const { getVideos } = await import("../models/video.server");

  const videoPage = await getVideoPageById(id);
  const allVideos = await getVideos();

  if (!videoPage) {
    throw new Response("Video Page not found", { status: 404 });
  }

  return json({
    videoPage,
    allVideos,
  });
};

export const action = async ({ request, params }) => {
  const { id } = params;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "updateStatus") {
    const { updateVideoPageStatus } = await import("../models/videoPage.server");
    const isLive = formData.get("isLive") === "true";

    try {
      await updateVideoPageStatus(id, isLive);
      return json({ success: true });
    } catch (error) {
      console.error("Error updating status:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (actionType === "addVideos") {
    const { addVideosToPage } = await import("../models/videoPage.server");
    const videoIds = JSON.parse(formData.get("videoIds") || "[]");

    try {
      await addVideosToPage(id, videoIds);
      return json({ success: true });
    } catch (error) {
      console.error("Error adding videos:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return json({ success: false });
};

export default function VideoPageEdit() {
  const { videoPage, allVideos } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [isLive, setIsLive] = useState(true);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const isUpdating = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setToastMessage("Changes saved successfully!");
      setToastActive(true);
    }

    if (fetcher.state === "idle" && fetcher.data?.success === false) {
      setToastMessage("Failed to save changes. Please try again.");
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data]);

  const handleToggleStatus = () => {
    const newStatus = !isLive;
    setIsLive(newStatus);

    const formData = new FormData();
    formData.append("actionType", "updateStatus");
    formData.append("isLive", newStatus.toString());

    fetcher.submit(formData, { method: "post" });
  };

  const handleAddMoreVideos = () => {
    // Navigate to add videos flow or open modal
    navigate(`/app/video-pages/${videoPage.id}/add-videos`);
  };

  const getWidgetBadge = (widgetType) => {
    const badges = {
      carousel: "Carousel",
      stories: "Stories",
      floating: "Floating",
    };
    return badges[widgetType] || widgetType;
  };

  const videosList = videoPage.videoIds?.map(videoId => 
    allVideos.find(v => v.id === videoId)
  ).filter(Boolean) || [];

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
        title={videoPage.pagePath || "Video Page"}
        backAction={{
          content: "Video Pages",
          url: "/app/video-pages",
        }}
        primaryAction={{
          content: "Preview in theme",
          onAction: () => {
            // Open preview in new tab
            window.open(videoPage.pagePath, "_blank");
          },
        }}
      >
        <Layout>
          {/* Status Banner */}
          <Layout.Section>
            <Banner
              tone={isLive ? "success" : "warning"}
              onDismiss={() => {}}
            >
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">
                  {isLive ? "Widget is Live" : "Section not added"}
                </Text>
                <Text as="p">
                  {isLive
                    ? "Your widget is currently visible on your store."
                    : "This Playlist is set to visible, but no section is added in your shopify page using the shopify theme editor."}
                </Text>
                <InlineStack gap="200">
                  {isLive ? (
                    <Button onClick={handleToggleStatus} disabled={isUpdating}>
                      {isUpdating ? "Updating..." : "Turn Off"}
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => {}}>Recheck</Button>
                      <Button onClick={() => {}}>Add section</Button>
                    </>
                  )}
                </InlineStack>
              </BlockStack>
            </Banner>
          </Layout.Section>

          {/* Widget Tabs */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="400">
                    <Button pressed={videoPage.widgetType === "carousel"}>
                      Carousel {videosList.length}
                    </Button>
                    <Button pressed={videoPage.widgetType === "stories"}>
                      Story 0
                    </Button>
                    <Button pressed={videoPage.widgetType === "floating"}>
                      Floating {videoPage.widgetType === "floating" ? videosList.length : 0}
                    </Button>
                  </InlineStack>
                </InlineStack>

                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">Live</Badge>
                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={isLive}
                        onChange={handleToggleStatus}
                        disabled={isUpdating}
                        style={{ marginRight: "8px" }}
                      />
                      <Text variant="bodyMd">
                        {isUpdating && <Spinner size="small" />}
                      </Text>
                    </label>
                  </InlineStack>

                  <Button onClick={handleAddMoreVideos}>+ Add more videos</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Videos Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                {videosList.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center" }}>
                    <Text variant="headingMd" as="h3">
                      You have not added any videos to this widget
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      Click on "Add more videos" button to add videos
                    </Text>
                  </div>
                ) : (
                  <>
                    <InlineStack align="space-between">
                      <TextField
                        placeholder="Search videos"
                        autoComplete="off"
                      />
                      <Button>Filters</Button>
                    </InlineStack>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: "16px",
                      }}
                    >
                      {videosList.map((video) => (
                        <div
                          key={video.id}
                          style={{
                            border: "1px solid #e1e3e5",
                            borderRadius: "12px",
                            overflow: "hidden",
                            cursor: "pointer",
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
                          <div style={{ padding: "12px" }}>
                            <Text variant="bodySm" alignment="center">
                              {video.videoProducts?.length > 0
                                ? `${video.videoProducts.length} product${video.videoProducts.length !== 1 ? "s" : ""} tagged`
                                : "No products tagged"}
                            </Text>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Preview Section */}
          <Layout.Section secondary>
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
      </Page>
      {toastMarkup}
    </Frame>
  );
}