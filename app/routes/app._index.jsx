import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Grid,
  Thumbnail,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Modal,
  DropZone,
  Banner,
  Spinner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");


  console.log('searchQuery==',searchQuery);
  
  // Import only in loader
  const { getVideos, searchVideos } = await import("../models/video.server");

 
  
  let videos;
  if (searchQuery) {
    videos = await searchVideos(searchQuery);
  } else {
    videos = await getVideos();
     console.log('getVideos===',videos);
  }
  
  return json({ videos: videos ?? [] });

};

export default function VideoLibrary() {
  const { videos } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();

  console.log("Videos from loader:", videos);

  
  const [searchValue, setSearchValue] = useState("");
  const [uploadModalActive, setUploadModalActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    navigate(`/app?search=${encodeURIComponent(searchValue)}`);
  }, [searchValue, navigate]);

  const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles, _rejectedFiles) => {
    setFiles(acceptedFiles);
  }, []);

  const handleUploadSubmit = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("videos", file);
    });
    
    try {
      const response = await fetch("/api/upload-video", {
        method: "POST",
        body: formData
      });
      
      if (response.ok) {   
        setUploadModalActive(false);
        setFiles([]);
        navigate("/app");
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const fileUpload = !files.length && (
    <DropZone.FileUpload actionHint="Accepts .mp4, .mov, .avi" />
  );

  const uploadedFiles = files.length > 0 && (
    <BlockStack gap="200">
      {files.map((file, index) => (
        <InlineStack key={index} align="space-between">
          <Text as="p">{file.name}</Text>
          <Text as="p" tone="subdued">{(file.size / 1024 / 1024).toFixed(2)} MB</Text>
        </InlineStack>
      ))}
    </BlockStack>
  );

  return (
    <Page
      title="Video Library"
      primaryAction={{
        content: "Upload videos",
        onAction: () => setUploadModalActive(true)
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <TextField
                label="Search videos"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder="Search videos by tagged product name"
                autoComplete="off"
                connectedRight={
                  <Button onClick={handleSearchSubmit}>Search</Button>
                }
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {videos.length === 0 ? (
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">No videos yet</Text>
                <Text as="p" tone="subdued">
                  Upload your first video to get started
                </Text>
              </BlockStack>
            </Card>
          ) : (
            <Grid>
              {videos.map((video) => (
                <Grid.Cell key={video.id} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 2 }}>
                  <Card>
                    <BlockStack gap="300">
                      <div style={{ position: 'relative', paddingTop: '150%', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
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
                      </div>
                      
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm" fontWeight="semibold">
                          {video.title}
                        </Text>
                        
                        {Array.isArray(video.videoProducts) && video.videoProducts.length > 0 && (
                          <InlineStack gap="100" wrap={false}>
                            <Badge>{video.videoProducts[0]?.product?.title?.substring(0, 20) || "Untitled"}</Badge>
                            {video.videoProducts.length > 1 && (
                              <Badge>+ {video.videoProducts.length - 1}</Badge>
                            )}
                          </InlineStack>
                        )}

                        
                        <Button
                          fullWidth
                          onClick={() => navigate(`/app/video-library/${video.id}`)}
                        >
                          + Attach Products
                        </Button>
                      </BlockStack>
                    </BlockStack>
                  </Card>
                </Grid.Cell>
              ))}
            </Grid>
          )}
        </Layout.Section>
      </Layout>

      <Modal
        open={uploadModalActive}
        onClose={() => setUploadModalActive(false)}
        title="Upload videos from computer"
        primaryAction={{
          content: uploading ? "Uploading..." : "Upload",
          onAction: handleUploadSubmit,
          disabled: files.length === 0 || uploading,
          loading: uploading
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setUploadModalActive(false)
          }
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Banner>
              <p>Upload video files (MP4, MOV, AVI). Maximum file size: 100MB per video.</p>
            </Banner>
            
            <DropZone
              accept="video/*"
              type="video"
              onDrop={handleDropZoneDrop}
              allowMultiple
            >
              {uploadedFiles}
              {fileUpload}
            </DropZone>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}






















