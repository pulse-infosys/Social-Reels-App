import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Select,
  ChoiceList,
  Grid,
  Text,
  BlockStack,
  InlineStack,
  Checkbox,
  Banner,
  ProgressBar
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  // Import only in loader
  const { getVideos } = await import("../models/video.server");
  const videos = await getVideos();
  
  return json({ videos });
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const widgetType = formData.get("widgetType");
  const pagePath = formData.get("pagePath");
  const videoIds = JSON.parse(formData.get("videoIds") || "[]");
  
  // Import only in action
  const { createVideoPage, addVideosToPage } = await import("../models/videoPage.server");
  
  const page = await createVideoPage({
    name: pagePath,
    pagePath: pagePath,
    widgetType: widgetType
  });
  
  if (videoIds.length > 0) {
    await addVideosToPage(page.id, videoIds);
  }
  
  return redirect("/app/video-pages");
};

export default function NewVideoPage() {
  const { videos } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  
  const [step, setStep] = useState(1);
  const [widgetType, setWidgetType] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [selectedVideos, setSelectedVideos] = useState([]);

  const widgetOptions = [
    { label: 'Carousel', value: 'carousel' },
    { label: 'Stories', value: 'stories' },
    { label: 'Floating', value: 'floating' }
  ];

  const pageOptions = [
    { label: 'Select a page', value: '' },
    { label: 'Homepage', value: 'Homepage' },
    { label: 'Products', value: 'Products' },
    { label: 'Collections', value: 'Collections' },
    { label: 'About', value: 'About' },
    { label: 'Contact', value: 'Contact' }
  ];

  const handleWidgetChange = useCallback((value) => {
    setWidgetType(value[0]);
  }, []);

  const handlePageChange = useCallback((value) => {
    setPagePath(value);
  }, []);

  const handleVideoToggle = useCallback((videoId) => {
    setSelectedVideos(prev =>
      prev.includes(videoId)
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  }, []);

  const handleNext = useCallback(() => {
    if (widgetType && pagePath) {
      setStep(2);
    }
  }, [widgetType, pagePath]);

  const handleBack = useCallback(() => {
    setStep(1);
  }, []);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("widgetType", widgetType);
    formData.append("pagePath", pagePath);
    formData.append("videoIds", JSON.stringify(selectedVideos));
    submit(formData, { method: "post" });
  }, [widgetType, pagePath, selectedVideos, submit]);

  return (
    <Page
      title="Add videos to a new page"
      backAction={{
        onAction: () => step === 1 ? navigate("/app/video-pages") : handleBack()
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <ProgressBar progress={(step / 2) * 100} size="small" />
              <Text as="p" alignment="center" tone="subdued">
                Step {step} of 2
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {step === 1 && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Select widget
                  </Text>
                  <Text as="p" tone="subdued">
                    Choose a widget variant to add to your store.
                  </Text>

                  <ChoiceList
                    title=""
                    choices={widgetOptions}
                    selected={widgetType ? [widgetType] : []}
                    onChange={handleWidgetChange}
                  />

                  {!widgetType && (
                    <Banner tone="warning">
                      Please select a widget type
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Select Page
                  </Text>
                  <Text as="p" tone="subdued">
                    Choose a page for your widget.
                  </Text>

                  <Select
                    label="Page"
                    options={pageOptions}
                    value={pagePath}
                    onChange={handlePageChange}
                  />

                  {!pagePath && (
                    <Banner tone="warning">
                      Please select a page
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleNext}
                  disabled={!widgetType || !pagePath}
                >
                  Next
                </Button>
              </InlineStack>
            </Layout.Section>
          </>
        )}

        {step === 2 && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Select Videos
                  </Text>
                  <Text as="p" tone="subdued">
                    Choose videos to add to your widget. These will appear on your selected store page.
                  </Text>
                  
                  <Banner>
                    <p>
                      Widget: <strong>{widgetType}</strong> | Page: <strong>{pagePath}</strong>
                    </p>
                  </Banner>

                  <Text as="p" tone="subdued">
                    {selectedVideos.length} video(s) selected
                  </Text>

                  {videos.length === 0 ? (
                    <Banner tone="info">
                      No videos available. Please upload videos first.
                    </Banner>
                  ) : (
                    <Grid>
                      {videos.map((video) => {
                        const isSelected = selectedVideos.includes(video.id);
                        
                        return (
                          <Grid.Cell key={video.id} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 2 }}>
                            <Card>
                              <div
                                onClick={() => handleVideoToggle(video.id)}
                                style={{ cursor: 'pointer' }}
                              >
                                <BlockStack gap="300">
                                  <div style={{
                                    position: 'relative',
                                    paddingTop: '150%',
                                    backgroundColor: '#f6f6f7',
                                    borderRadius: '8px',
                                    border: isSelected ? '3px solid #008060' : 'none'
                                  }}>
                                    {video.thumbnailUrl ? (
                                      <img
                                        src={video.thumbnailUrl}
                                        alt={video.title}
                                        style={{
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                          borderRadius: '8px'
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.parentElement.innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 48px;">🎬</div>';
                                        }}
                                      />
                                    ) : (
                                      <div style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        fontSize: '48px'
                                      }}>
                                        🎬
                                      </div>
                                    )}
                                    <div style={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      width: '48px',
                                      height: '48px',
                                      backgroundColor: 'rgba(0,0,0,0.6)',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontSize: '20px'
                                    }}>
                                      ▶
                                    </div>
                                    {isSelected && (
                                      <div style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        width: '24px',
                                        height: '24px',
                                        backgroundColor: '#008060',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                      }}>
                                        ✓
                                      </div>
                                    )}
                                  </div>
                                  
                                  <BlockStack gap="100">
                                    <InlineStack gap="200" blockAlign="center">
                                      <Checkbox
                                        checked={isSelected}
                                        onChange={() => handleVideoToggle(video.id)}
                                      />
                                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                                        {video.title}
                                      </Text>
                                    </InlineStack>
                                    
                                    {video.videoProducts.length > 0 && (
                                      <Text as="p" tone="subdued" variant="bodySm">
                                        {video.videoProducts.length} product(s) attached
                                      </Text>
                                    )}
                                  </BlockStack>
                                </BlockStack>
                              </div>
                            </Card>
                          </Grid.Cell>
                        );
                      })}
                    </Grid>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <InlineStack align="end" gap="200">
                <Button onClick={() => navigate("/app/video-pages")}>
                  Discard
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={selectedVideos.length === 0}
                >
                  Save
                </Button>
              </InlineStack>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}