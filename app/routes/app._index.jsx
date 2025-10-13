import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher, useRevalidator } from "@remix-run/react";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Grid,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Modal,
  DropZone,
  Banner,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Checkbox,
  EmptyState,
  ProgressBar,
  Spinner,
  Box,
  Toast,
  Frame
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { attachProductsToVideo } from "../models/product.server";

// GraphQL query to fetch products with pagination
const PRODUCTS_QUERY = `
  query getProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          featuredImage {
            url
            altText
          }
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Function to fetch all products with pagination
async function fetchAllProducts(admin) {
  let allProducts = [];
  let hasNextPage = true;
  let cursor = null;
  const limit = 250;

  while (hasNextPage) {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: {
        first: limit,
        after: cursor
      }
    });

    const data = await response.json();
    
    if (data.data && data.data.products) {
      const products = data.data.products.edges.map(edge => ({
        id: edge.node.id.replace('gid://shopify/Product/', ''),
        shopifyId: edge.node.id.replace('gid://shopify/Product/', ''),
        title: edge.node.title,
        image: edge.node.featuredImage?.url || null,
        price: edge.node.variants.edges[0]?.node.price || "0.00"
      }));

      allProducts = [...allProducts, ...products];
      
      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
    } else {
      hasNextPage = false;
    }
  }

  return allProducts;
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");
  
  const { getVideos, searchVideos } = await import("../models/video.server");
  const { getProducts, syncProductsFromShopify } = await import("../models/product.server");
  
  const shopifyProducts = await fetchAllProducts(admin);
  await syncProductsFromShopify(shopifyProducts, session.shop);
  const products = await getProducts(session.shop);
  
  let videos;
  if (searchQuery) {
    videos = await searchVideos(searchQuery);
  } else {
    videos = await getVideos();
  }
  
  return json({ 
    videos: videos ?? [], 
    products,
    shop: session.shop 
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  
  if (actionType === "attachProducts") {
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
    const videoId = formData.get("videoId");
    const { deleteVideo } = await import("../models/video.server");
    
    try {
      await deleteVideo(videoId);
      return json({ success: true, action: "deleteVideo", videoId });
    } catch (error) {
      console.error("Error deleting video:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }
  
  return json({ success: false });
};

// Upload Progress Component
function UploadProgressCard({ uploadId, fileName, onRemove }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('uploading');
  const revalidator = useRevalidator();

  useEffect(() => {
    const uploadInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          setStatus('processing');
          
          setTimeout(() => {
            setStatus('complete');
            setTimeout(() => {
              onRemove(uploadId);
              revalidator.revalidate();
            }, 2000);
          }, 3000);
          
          return 100;
        }
        return prev + 10;
      });
    }, 300);

    return () => clearInterval(uploadInterval);
  }, [uploadId, onRemove, revalidator]);

  if (status === 'complete') {
    return null;
  }

  const getStatusText = () => {
    if (status === 'uploading') return `Uploading ${progress}%`;
    if (status === 'processing') return 'Processing video...';
    return 'Complete';
  };

  return (
    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <div style={{ flex: 1 }}>
            <Text variant="bodyMd" fontWeight="semibold">
              {status === 'uploading' ? 'Uploading Media' : 'Processing Video'}
            </Text>
            <Text variant="bodySm" tone="subdued">
              {fileName.length > 30 ? fileName.substring(0, 30) + '...' : fileName}
            </Text>
          </div>
          <Text variant="bodySm" tone="subdued">
            {getStatusText()}
          </Text>
        </InlineStack>
        <ProgressBar 
          progress={status === 'processing' ? 100 : progress} 
          size="small" 
          tone={status === 'processing' ? 'primary' : 'success'}
          animated={status === 'processing'}
        />
      </BlockStack>
    </Box>
  );
}

// Video Card Component with Delete
function VideoCard({ video, onOpenAddProduct, onOpenModifyProduct, onPlayVideo, playingVideo, videoRefs }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteFetcher = useFetcher();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (deleteFetcher.state === "submitting" || deleteFetcher.state === "loading") {
      setIsDeleting(true);
    }
    
    if (deleteFetcher.data?.success && deleteFetcher.data?.action === "deleteVideo") {
      setTimeout(() => {
        setIsDeleting(false);
        revalidator.revalidate();
      }, 500);
    }
    
    if (deleteFetcher.data?.success === false) {
      setIsDeleting(false);
    }
  }, [deleteFetcher.state, deleteFetcher.data, revalidator]);

  const handleDelete = (e) => {
    e.stopPropagation();
    
    if (confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      const formData = new FormData();
      formData.append("actionType", "deleteVideo");
      formData.append("videoId", video.id);
      deleteFetcher.submit(formData, { method: "post" });
    }
  };

  const attachedProducts = video.videoProducts || [];

  return (
    <div style={{ 
      position: 'relative',
      opacity: isDeleting ? 0.4 : 1,
      transition: 'opacity 0.3s ease',
      pointerEvents: isDeleting ? 'none' : 'auto'
    }}>
      {isDeleting && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <BlockStack gap="200" align="center">
            <Spinner size="large" />
            <Text variant="bodyMd" fontWeight="semibold">Deleting video...</Text>
            <Text variant="bodySm" tone="subdued">Please wait</Text>
          </BlockStack>
        </div>
      )}
      
      <Card>
        <BlockStack gap="300">
          <div 
            style={{ 
              position: 'relative', 
              paddingTop: '150%', 
              backgroundColor: '#000', 
              borderRadius: '8px',
              cursor: 'pointer',
              overflow: 'hidden'
            }}
            onClick={() => onPlayVideo(video.id)}
          >
            <video
              ref={(el) => videoRefs.current[video.id] = el}
              src={video.videoUrl}
              poster={video.thumbnailUrl}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
              onEnded={() => onPlayVideo(null)}
            />
            
            {playingVideo !== video.id && (
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
            )}
            
            <div 
              onClick={handleDelete}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                zIndex: 2
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M8 4V3h4v1h4v1h-1v11a1 1 0 01-1 1H6a1 1 0 01-1-1V5H4V4h4zm6 1H6v11h8V5zm-6 2h1v7H8V7zm3 0h1v7h-1V7z" fill="#D72C0D"/>
              </svg>
            </div>
          </div>
          
          <BlockStack gap="200">
            {attachedProducts.length > 0 && (
              <div 
                onClick={() => onOpenModifyProduct(video)}
                style={{ cursor: 'pointer' }}
              >
                <InlineStack gap="100" wrap={false}>
                  <div style={{ display:'flex', width: '100%', gap: '9px' }}>
                    <Badge>
                      <div style={{ display:'flex', alignItems: 'center', gap: '4px' }}>
                        <Thumbnail
                          source={attachedProducts[0]?.product?.image || ""}
                          alt={attachedProducts[0]?.product?.title || "Product"}
                          size="extraSmall"
                        />
                        <span
                          style={{
                            maxWidth: '120px', 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={attachedProducts[0]?.product?.title}
                        >
                          {attachedProducts[0]?.product?.title || "Untitled"}
                        </span>
                      </div>
                    </Badge>
                    {attachedProducts.length > 1 && (
                      <Badge>+ {attachedProducts.length - 1}</Badge>
                    )}
                  </div>
                </InlineStack>
              </div>
            )}
            
            <Button
              fullWidth
              onClick={() => onOpenAddProduct(video)}
              disabled={isDeleting}
            >
              + Attach Products
            </Button>
          </BlockStack>
        </BlockStack>
      </Card>
    </div>
  );
}

export default function VideoLibrary() {
  const { videos, products } = useLoaderData();
  const navigate = useNavigate();
  const productFetcher = useFetcher();
  const revalidator = useRevalidator();
  
  const [searchValue, setSearchValue] = useState("");
  const [uploadModalActive, setUploadModalActive] = useState(false);
  const [addProductModalActive, setAddProductModalActive] = useState(false);
  const [modifyProductModalActive, setModifyProductModalActive] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSearchValue, setProductSearchValue] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const videoRefs = useRef({});

  // Track if we're currently saving (submitting OR loading)
  const isSavingProducts = productFetcher.state !== "idle";

  // Monitor product fetcher state
  useEffect(() => {
    // When the fetcher completes successfully
    if (productFetcher.state === "idle" && productFetcher.data?.success && productFetcher.data?.action === "attachProducts") {
      setToastMessage("Products updated successfully!");
      setToastActive(true);
      
      // Close modals
      setAddProductModalActive(false);
      setModifyProductModalActive(false);
      setSelectedVideo(null);
      setSelectedProducts([]);
      setProductSearchValue("");
      
      // Revalidate to get fresh data
      revalidator.revalidate();
    }
    
    // Handle errors
    if (productFetcher.state === "idle" && productFetcher.data?.success === false) {
      setToastMessage("Failed to update products. Please try again.");
      setToastActive(true);
    }
  }, [productFetcher.state, productFetcher.data, revalidator]);

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
    
    const newUploads = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      progress: 0
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploads]);
    setUploadModalActive(false);
    setFiles([]);
    
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
        setToastMessage("Videos uploaded successfully!");
        setToastActive(true);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadingFiles(prev => 
        prev.filter(u => !newUploads.find(nu => nu.id === u.id))
      );
      setToastMessage("Upload failed. Please try again.");
      setToastActive(true);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveUpload = useCallback((uploadId) => {
    setUploadingFiles(prev => prev.filter(u => u.id !== uploadId));
  }, []);

  const handlePlayVideo = useCallback((videoId) => {
    if (!videoId) {
      setPlayingVideo(null);
      return;
    }
    
    const videoElement = videoRefs.current[videoId];
    if (videoElement) {
      if (playingVideo === videoId) {
        videoElement.pause();
        setPlayingVideo(null);
      } else {
        Object.keys(videoRefs.current).forEach(key => {
          if (videoRefs.current[key] && key !== videoId) {
            videoRefs.current[key].pause();
          }
        });
        videoElement.play();
        setPlayingVideo(videoId);
      }
    }
  }, [playingVideo]);

  const handleOpenAddProductModal = useCallback((video) => {
    setSelectedVideo(video);
    setSelectedProducts(
      video.videoProducts?.map(vp => vp.productId) || []
    );
    setAddProductModalActive(true);
  }, []);

  const handleCloseAddProductModal = useCallback(() => {
    if (isSavingProducts) return; 
    setAddProductModalActive(false);
    setSelectedVideo(null);
    setSelectedProducts([]);
    setProductSearchValue("");
  }, [isSavingProducts]);

  const handleOpenModifyProductModal = useCallback((video) => {
    setSelectedVideo(video);
    setSelectedProducts(
      video.videoProducts?.map(vp => vp.productId) || []
    );
    setModifyProductModalActive(true);
  }, []);

  const handleCloseModifyProductModal = useCallback(() => {
    if (isSavingProducts) return; 
    setModifyProductModalActive(false);
    setSelectedVideo(null);
    setSelectedProducts([]);
    setProductSearchValue("");
  }, [isSavingProducts]);

  const handleToggleProduct = useCallback((productId) => {
    if (isSavingProducts) return; 
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, [isSavingProducts]);

  const handleRemoveProduct = useCallback((productId) => {
    if (isSavingProducts) return; 
    setSelectedProducts(prev => prev.filter(id => id !== productId));
  }, [isSavingProducts]);

  const handleSaveProducts = useCallback(() => {
    if (!selectedVideo || isSavingProducts) return;
    
    const formData = new FormData();
    formData.append("actionType", "attachProducts");
    formData.append("videoId", selectedVideo.id);
    formData.append("productIds", JSON.stringify(selectedProducts));
    
    productFetcher.submit(formData, { method: "post" });
  }, [selectedVideo, selectedProducts, productFetcher, isSavingProducts]);

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(productSearchValue.toLowerCase())
  );

  const getSelectedProductDetails = useCallback(() => {
    return selectedProducts.map(id => products.find(p => p.id === id)).filter(Boolean);
  }, [selectedProducts, products]);

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

  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} duration={3000} onDismiss={() => setToastActive(false)} />
  ) : null;

  return (
    <Frame>
      <Page
        title="Video Library"
        primaryAction={{
          content: "Upload videos",
          onAction: () => setUploadModalActive(true)
        }}
      >
        <Layout>
          {uploadingFiles.length > 0 && (
            <Layout.Section>
              <BlockStack gap="300">
                {uploadingFiles.map(upload => (
                  <UploadProgressCard
                    key={upload.id}
                    uploadId={upload.id}
                    fileName={upload.fileName}
                    onRemove={handleRemoveUpload}
                  />
                ))}
              </BlockStack>
            </Layout.Section>
          )}

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
                  <Grid.Cell key={video.id} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                    <VideoCard
                      video={video}
                      onOpenAddProduct={handleOpenAddProductModal}
                      onOpenModifyProduct={handleOpenModifyProductModal}
                      onPlayVideo={handlePlayVideo}
                      playingVideo={playingVideo}
                      videoRefs={videoRefs}
                    />
                  </Grid.Cell>
                ))}
              </Grid>
            )}
          </Layout.Section>
        </Layout>

        {/* Upload Video Modal */}
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

        {/* Add Products Modal */}
        <Modal
          open={addProductModalActive}
          onClose={handleCloseAddProductModal}
          title="Add products"
          primaryAction={{
            content: isSavingProducts ? "Saving..." : "Add",
            onAction: handleSaveProducts,
            disabled: isSavingProducts,
            loading: isSavingProducts
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleCloseAddProductModal,
              disabled: isSavingProducts
            }
          ]}
        >
          <Modal.Section>
            {isSavingProducts && (
              <Box paddingBlockEnd="400">
                <Banner tone="info">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Spinner size="small" />
                      <Text variant="bodyMd" fontWeight="semibold">
                        Saving products...
                      </Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      Please wait while we update the product associations
                    </Text>
                  </BlockStack>
                </Banner>
              </Box>
            )}
            
            <BlockStack gap="400">
              <TextField
                label=""
                value={productSearchValue}
                onChange={setProductSearchValue}
                placeholder="Search products"
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setProductSearchValue("")}
                disabled={isSavingProducts}
              />
              
              <Text as="p" variant="bodySm" tone="subdued">
                {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
              </Text>

              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto', 
                opacity: isSavingProducts ? 0.5 : 1,
                pointerEvents: isSavingProducts ? 'none' : 'auto'
              }}>
                {filteredProducts.length > 0 ? (
                  <ResourceList
                    resourceName={{ singular: 'product', plural: 'products' }}
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

        {/* Modify Tagged Products Modal */}
        <Modal
          open={modifyProductModalActive}
          onClose={handleCloseModifyProductModal}
          title="Modify tagged products"
        >
          <Modal.Section>
            {isSavingProducts && (
              <Box paddingBlockEnd="400">
                <Banner tone="info">
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Spinner size="small" />
                      <Text variant="bodyMd" fontWeight="semibold">
                        Product Deleting...
                      </Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      Please do not close this window
                    </Text>
                  </BlockStack>
                </Banner>
              </Box>
            )}
            
            <BlockStack gap="400">
              <Button
                fullWidth
                onClick={() => {
                  setModifyProductModalActive(false);
                  setAddProductModalActive(true);
                }}
                disabled={isSavingProducts}
              >
                + Attach products
              </Button>

              <div style={{ 
                opacity: isSavingProducts ? 0.5 : 1,
                pointerEvents: isSavingProducts ? 'none' : 'auto'
              }}>
                {getSelectedProductDetails().length > 0 ? (
                  <BlockStack gap="200">
                    {getSelectedProductDetails().map((product) => (
                      <Card key={product.id}>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            <Thumbnail
                              source={product.image || ""}
                              alt={product.title}
                              size="small"
                            />
                            <Text variant="bodyMd" fontWeight="medium">
                              {product.title}
                            </Text>
                          </InlineStack>
                          <Button
                            icon={DeleteIcon}
                            variant="plain"
                            tone="critical"
                            onClick={() => handleRemoveProduct(product.id)}
                            disabled={isSavingProducts}
                          />
                        </InlineStack>
                      </Card>
                    ))}
                  </BlockStack>
                ) : (
                  <EmptyState
                    heading="No products attached"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Click "Attach products" to add products to this video</p>
                  </EmptyState>
                )}
              </div>

              <InlineStack align="end">
                <Button 
                  onClick={handleSaveProducts}
                  loading={isSavingProducts}
                  disabled={isSavingProducts}
                >
                  {isSavingProducts ? "Saving..." : "Save Changes"}
                </Button>
              </InlineStack>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Page>
      {toastMarkup}
    </Frame>
  );
}