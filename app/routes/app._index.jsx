import { json } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useFetcher,
  useRevalidator,
} from "@remix-run/react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  Frame,
  Pagination,
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

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
        after: cursor,
      },
    });

    const data = await response.json();

    if (data.data && data.data.products) {
      const products = data.data.products.edges.map((edge) => ({
        id: edge.node.id.replace("gid://shopify/Product/", ""),
        shopifyId: edge.node.id.replace("gid://shopify/Product/", ""),
        title: edge.node.title,
        image: edge.node.featuredImage?.url || null,
        price: edge.node.variants.edges[0]?.node.price || "0.00",
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

// Loader - Only fetch videos, NOT products
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search");

  const { getVideos, searchVideos } = await import("../models/video.server");

  let videos;
  if (searchQuery) {
    videos = await searchVideos(searchQuery);
  } else {
    videos = await getVideos();
  }

  return json({
    videos: videos ?? [],
    shop: session.shop,
  });
};

// Action - Handle all form submissions
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  // Fetch products when modal opens
  if (actionType === "fetchProducts") {
    const { getProducts, syncProductsFromShopify } = await import(
      "../models/product.server"
    );

    try {
      const shopifyProducts = await fetchAllProducts(admin);
      await syncProductsFromShopify(shopifyProducts, session.shop);
      const products = await getProducts(session.shop);

      return json({
        success: true,
        action: "fetchProducts",
        products: products,
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      return json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 },
      );
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

// Single Upload Progress Component
function UploadProgressCard({ uploads, actualProgress, onComplete }) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [status, setStatus] = useState("uploading");

  useEffect(() => {
    setDisplayProgress(actualProgress);

    if (actualProgress >= 100) {
      setStatus("complete");
      setTimeout(() => {
        onComplete();
      }, 1000);
    } else if (actualProgress >= 90) {
      setStatus("finalizing");
    } else if (actualProgress >= 60) {
      setStatus("processing");
    } else {
      setStatus("uploading");
    }
  }, [actualProgress, onComplete]);

  if (status === "complete") {
    return null;
  }

  const statusMessages = {
    uploading: "Uploading to Shopify...",
    processing: "Processing videos...",
    finalizing: "Saving to database...",
    complete: "Complete!",
  };

  const statusLabels = {
    uploading: "Uploading videos",
    processing: "Processing videos",
    finalizing: "Finalizing",
  };

  return (
    <Box
      padding="400"
      background="bg-surface"
      borderRadius="300"
      borderWidth="025"
      borderColor="border-subdued"
    >
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Spinner size="small" />
            <div>
              <Text variant="bodyMd" fontWeight="semibold">
                {statusLabels[status]}
              </Text>
              <Text variant="bodySm" tone="subdued">
                {uploads.length} file
                {uploads.length > 1 ? "s" : ""} – {statusMessages[status]}
              </Text>
            </div>
          </InlineStack>

          <div style={{ textAlign: "right", minWidth: "60px" }}>
            <Text variant="bodyLg" fontWeight="bold">
              {displayProgress}%
            </Text>
          </div>
        </InlineStack>

        <ProgressBar
          progress={displayProgress}
          size="medium"
          tone={status === "finalizing" ? "success" : "primary"}
          animated
        />
      </BlockStack>
    </Box>
  );
}

// Video Card Component
function VideoCard({
  video,
  onOpenAddProduct,
  onOpenModifyProduct,
  onPlayVideo,
  playingVideo,
  videoRefs,
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteFetcher = useFetcher();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (
      deleteFetcher.state === "submitting" ||
      deleteFetcher.state === "loading"
    ) {
      setIsDeleting(true);
    }

    if (
      deleteFetcher.data?.success &&
      deleteFetcher.data?.action === "deleteVideo"
    ) {
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

    if (
      confirm(
        "Are you sure you want to delete this video? This action cannot be undone.",
      )
    ) {
      const formData = new FormData();
      formData.append("actionType", "deleteVideo");
      formData.append("videoId", video.id);
      deleteFetcher.submit(formData, { method: "post" });
    }
  };

  const attachedProducts = video.videoProducts || [];

  return (
    <div
      style={{
        position: "relative",
        opacity: isDeleting ? 0.4 : 1,
        transition: "opacity 0.3s ease",
        pointerEvents: isDeleting ? "none" : "auto",
      }}
    >
      {isDeleting && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <BlockStack gap="200" align="center">
            <Spinner size="large" />
            <Text variant="bodyMd" fontWeight="semibold">
              Deleting video...
            </Text>
          </BlockStack>
        </div>
      )}

      <BlockStack gap="300">
        <div
          style={{
            position: "relative",
            paddingTop: "150%",
            backgroundColor: "#000",
            borderRadius: "8px",
            cursor: "pointer",
            overflow: "hidden",
          }}
          onClick={() => onPlayVideo(video.id)}
        >
          <video
            ref={(el) => (videoRefs.current[video.id] = el)}
            src={video.videoUrl}
            poster={video.thumbnailUrl}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "8px",
            }}
            onEnded={() => onPlayVideo(null)}
          />

          {playingVideo !== video.id && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "48px",
                height: "48px",
                backgroundColor: "rgba(0,0,0,0.6)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "20px",
              }}
            >
              ▶
            </div>
          )}

          <div
            onClick={handleDelete}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 2,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path
                d="M8 4V3h4v1h4v1h-1v11a1 1 0 01-1 1H6a1 1 0 01-1-1V5H4V4h4zm6 1H6v11h8V5zm-6 2h1v7H8V7zm3 0h1v7h-1V7z"
                fill="#D72C0D"
              />
            </svg>
          </div>
        </div>

        <Card>
          <BlockStack gap="200">
            {attachedProducts.length > 0 ? (
              <div
                onClick={() => onOpenModifyProduct(video)}
                style={{ cursor: "pointer" }}
              >
                <InlineStack gap="100" wrap={false}>
                  <div style={{ display: "flex", width: "100%", gap: "9px" }}>
                    <Badge>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Thumbnail
                          source={attachedProducts[0]?.product?.image || ""}
                          alt={attachedProducts[0]?.product?.title || "Product"}
                          size="extraSmall"
                        />
                        <span
                          style={{
                            maxWidth: "120px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
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
            ) : (
              <Text variant="bodySm" as="p" alignment="center">
                Attach products to make it shoppable video
              </Text>
            )}

            <Button
              fullWidth
              onClick={() => onOpenAddProduct(video)}
              disabled={isDeleting}
              variant="primary"
            >
              + Attach Products
            </Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </div>
  );
}

// Products Loading State Component
function ProductsLoadingState() {
  return (
    <Box padding="800">
      <BlockStack gap="400" align="center">
        <Spinner size="large" />
        <Text variant="bodyMd" fontWeight="semibold">
          Loading products...
        </Text>
        <Text variant="bodySm" tone="subdued">
          Syncing with your Shopify store
        </Text>
      </BlockStack>
    </Box>
  );
}

// Helper function to check if arrays have same elements (order doesn't matter)
function arraysHaveSameElements(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  return sorted1.every((val, index) => val === sorted2[index]);
}

export default function VideoLibrary() {
  const { videos } = useLoaderData();
  const navigate = useNavigate();
  const productFetcher = useFetcher();
  const revalidator = useRevalidator();

  // State
  const [searchValue, setSearchValue] = useState("");
  const [uploadModalActive, setUploadModalActive] = useState(false);
  const [addProductModalActive, setAddProductModalActive] = useState(false);
  const [modifyProductModalActive, setModifyProductModalActive] =
    useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [originalProducts, setOriginalProducts] = useState([]); // Track original state
  const [productSearchValue, setProductSearchValue] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);

  // Pagination
  const videosPerPage = 4;
  const [currentPage, setCurrentPage] = useState(1);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Products state
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // File state
  const [filePreviews, setFilePreviews] = useState([]);
  const [fileError, setFileError] = useState("");

  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const toastTimerRef = useRef(null);

  const videoRefs = useRef({});

  const isSavingProducts =
    productFetcher.state !== "idle" &&
    productFetcher.formData?.get("actionType") === "attachProducts";

  // Check if changes were made - using useMemo for performance
  const hasChanges = useMemo(() => {
    return !arraysHaveSameElements(selectedProducts, originalProducts);
  }, [selectedProducts, originalProducts]);

  // Pagination validation
  useEffect(() => {
    const newTotalPages = Math.max(
      1,
      Math.ceil((videos?.length || 0) / videosPerPage),
    );
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages);
    }
  }, [videos.length, currentPage, videosPerPage]);

  useEffect(() => {
    return () => {
      filePreviews.forEach((preview) => {
        URL.revokeObjectURL(preview.url);
      });
    };
  }, [filePreviews]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    if (toastActive) {
      toastTimerRef.current = setTimeout(() => {
        setToastActive(false);
        setToastMessage("");
      }, 3000);
    }

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [toastActive, toastMessage]);

  const showToast = useCallback((message) => {
    setToastActive(false);
    setToastMessage("");

    setTimeout(() => {
      setToastMessage(message);
      setToastActive(true);
    }, 100);
  }, []);

  // Handle product fetcher response
  const prevFetcherStateRef = useRef(productFetcher.state);

  useEffect(() => {
    const prevState = prevFetcherStateRef.current;
    const currState = productFetcher.state;
    const data = productFetcher.data;

    const justFinishedRequest = prevState !== "idle" && currState === "idle";

    if (justFinishedRequest && data) {
      if (data.action === "fetchProducts" && data.success) {
        setProducts(data.products || []);
        setIsLoadingProducts(false);
        setProductsLoaded(true);
      }

      if (data.action === "attachProducts") {
        if (data.success) {
          showToast("Products updated successfully!");

          setAddProductModalActive(false);
          setModifyProductModalActive(false);
          setSelectedVideo(null);
          setSelectedProducts([]);
          setOriginalProducts([]);
          setProductSearchValue("");

          revalidator.revalidate();
        } else {
          showToast(data.error || "An error occurred");
        }

        setIsLoadingProducts(false);
      }

      if (data.success === false && data.action !== "attachProducts") {
        showToast(data.error || "An error occurred");
        setIsLoadingProducts(false);
      }
    }

    prevFetcherStateRef.current = currState;
  }, [productFetcher.state, productFetcher.data, revalidator, showToast]);

  const fetchProducts = useCallback(() => {
    if (productsLoaded) return;

    setIsLoadingProducts(true);
    const formData = new FormData();
    formData.append("actionType", "fetchProducts");
    productFetcher.submit(formData, { method: "post" });
  }, [productsLoaded, productFetcher]);

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    navigate(`/app?search=${encodeURIComponent(searchValue)}`);
  }, [searchValue, navigate]);

  const handleDropZoneDrop = useCallback(
    (_dropFiles, acceptedFiles, _rejectedFiles) => {
      const MAX_SIZE = 5 * 1024 * 1024;
      const validFiles = [];
      const newPreviews = [];
      const oversizedFileNames = [];

      acceptedFiles.forEach((file) => {
        if (file.size <= MAX_SIZE) {
          validFiles.push(file);
          newPreviews.push({
            name: file.name,
            size: file.size,
            url: URL.createObjectURL(file),
          });
        } else {
          oversizedFileNames.push(file.name);
        }
      });

      setFilePreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return newPreviews;
      });

      setFiles(validFiles);

      if (oversizedFileNames.length > 0) {
        setFileError(
          `Maximum file size 5MB hai. Ye files bahut badi hain: ${oversizedFileNames.join(
            ", ",
          )}`,
        );
      } else {
        setFileError("");
      }
    },
    [],
  );

  const handleUploadSubmit = async () => {
    if (files.length === 0) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    const tooBig = files.find((file) => file.size > MAX_SIZE);
    if (tooBig) {
      showToast(
        `"${tooBig.name} is larger than 5MB. The maximum allowed size per video is 5MB."`,
      );
      return;
    }

    setUploading(true);
    setIsUploading(true);
    setUploadProgress(0);

    const fileNames = files.map((file) => ({
      fileName: file.name,
      size: file.size,
    }));
    setUploadingFiles(fileNames);

    setUploadModalActive(false);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("videos", file);
    });

    setFiles([]);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 40) {
            clearInterval(progressInterval);
            return 40;
          }
          return prev + 2;
        });
      }, 200);

      const response = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      setUploadProgress(50);

      const result = await response.json();

      if (response.ok && result.success) {
        setUploadProgress(70);
        await new Promise((resolve) => setTimeout(resolve, 300));
        setUploadProgress(90);
        await new Promise((resolve) => setTimeout(resolve, 300));
        setUploadProgress(100);

        let message =
          result.message || `${result.videos?.length || 0} video(s) uploaded!`;
        if (result.failedVideos && result.failedVideos.length > 0) {
          message += ` (${result.failedVideos.length} failed)`;
        }

        showToast(message);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setIsUploading(false);
      setUploadingFiles([]);
      setUploadProgress(0);
      showToast(error.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadComplete = useCallback(() => {
    setIsUploading(false);
    setUploadingFiles([]);
    setUploadProgress(0);
    revalidator.revalidate();
  }, [revalidator]);

  const handlePlayVideo = useCallback(
    (videoId) => {
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
          Object.keys(videoRefs.current).forEach((key) => {
            if (videoRefs.current[key] && key !== videoId) {
              videoRefs.current[key].pause();
            }
          });
          videoElement.play();
          setPlayingVideo(videoId);
        }
      }
    },
    [playingVideo],
  );

  // Open Add Product Modal - Store original products
  const handleOpenAddProductModal = useCallback(
    (video) => {
      const initialProducts =
        video.videoProducts?.map((vp) => vp.productId) || [];
      setSelectedVideo(video);
      setSelectedProducts(initialProducts);
      setOriginalProducts(initialProducts); // Store original state
      setAddProductModalActive(true);

      fetchProducts();
    },
    [fetchProducts],
  );

  const handleCloseAddProductModal = useCallback(() => {
    if (isSavingProducts) return;
    setAddProductModalActive(false);
    setSelectedVideo(null);
    setSelectedProducts([]);
    setOriginalProducts([]);
    setProductSearchValue("");
  }, [isSavingProducts]);

  // Open Modify Product Modal - Store original products
  const handleOpenModifyProductModal = useCallback(
    (video) => {
      const initialProducts =
        video.videoProducts?.map((vp) => vp.productId) || [];
      setSelectedVideo(video);
      setSelectedProducts(initialProducts);
      setOriginalProducts(initialProducts); // Store original state
      setModifyProductModalActive(true);

      fetchProducts();
    },
    [fetchProducts],
  );

  const handleCloseModifyProductModal = useCallback(() => {
    if (isSavingProducts) return;
    setModifyProductModalActive(false);
    setSelectedVideo(null);
    setSelectedProducts([]);
    setOriginalProducts([]);
    setProductSearchValue("");
  }, [isSavingProducts]);

  const handleToggleProduct = useCallback(
    (productId) => {
      if (isSavingProducts) return;
      setSelectedProducts((prev) =>
        prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId],
      );
    },
    [isSavingProducts],
  );

  const handleRemoveProduct = useCallback(
    (productId) => {
      if (isSavingProducts) return;
      setSelectedProducts((prev) => prev.filter((id) => id !== productId));
    },
    [isSavingProducts],
  );

  const handleSaveProducts = useCallback(() => {
    if (!selectedVideo || isSavingProducts) return;

    const formData = new FormData();
    formData.append("actionType", "attachProducts");
    formData.append("videoId", selectedVideo.id);
    formData.append("productIds", JSON.stringify(selectedProducts));

    productFetcher.submit(formData, { method: "post" });
  }, [selectedVideo, selectedProducts, productFetcher, isSavingProducts]);

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(productSearchValue.toLowerCase()),
  );

  const totalPages = Math.max(
    1,
    Math.ceil((videos?.length || 0) / videosPerPage),
  );
  const startIndex = (currentPage - 1) * videosPerPage;
  const paginatedVideos = videos.slice(startIndex, startIndex + videosPerPage);

  const getSelectedProductDetails = useCallback(() => {
    return selectedProducts
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean);
  }, [selectedProducts, products]);

  const fileUpload = !filePreviews.length && (
    <DropZone.FileUpload actionHint="Accepts .mp4, .mov, .avi (Max 5MB each)" />
  );

  const uploadedFiles =
    filePreviews.length > 0 && (
      <BlockStack gap="200">
        {filePreviews.map((preview, index) => (
          <InlineStack key={index} gap="200" blockAlign="center">
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "8px",
                overflow: "hidden",
                backgroundColor: "#000",
                flexShrink: 0,
              }}
            >
              <video
                src={preview.url}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                muted
              />
            </div>
            <BlockStack gap="050">
              <Text as="p" variant="bodySm">
                {preview.name}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                {(preview.size / 1024 / 1024).toFixed(2)} MB
              </Text>
            </BlockStack>
          </InlineStack>
        ))}
      </BlockStack>
    );

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      onDismiss={() => {
        setToastActive(false);
        setToastMessage("");
      }}
    />
  ) : null;

  return (
    <Frame>
      <Page
        title="Video Library"
        primaryAction={{
          content: isUploading ? "Uploading..." : "Upload videos",
          onAction: () => setUploadModalActive(true),
          disabled: isUploading,
          loading: isUploading,
        }}
      >
        <Layout>
          {isUploading && uploadingFiles.length > 0 && (
            <Layout.Section>
              <UploadProgressCard
                uploads={uploadingFiles}
                actualProgress={uploadProgress}
                onComplete={handleUploadComplete}
              />
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
            {videos.length === 0 && !isUploading ? (
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    No videos yet
                  </Text>
                  <Text as="p" tone="subdued">
                    Upload your first video to get started
                  </Text>
                </BlockStack>
              </Card>
            ) : (
              <>
                <Grid>
                  {paginatedVideos.map((video) => (
                    <Grid.Cell
                      key={video.id}
                      columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}
                    >
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

                {videos.length > videosPerPage && (
                  <Box paddingBlockStart="400">
                    <InlineStack align="center" blockAlign="center" gap="400">
                      <Pagination
                        hasPrevious={currentPage > 1}
                        onPrevious={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        hasNext={currentPage < totalPages}
                        onNext={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          )
                        }
                      />
                      <Text tone="subdued" variant="bodySm">
                        Page {currentPage} of {totalPages}
                      </Text>
                    </InlineStack>
                  </Box>
                )}
              </>
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
            loading: uploading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setUploadModalActive(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Banner>
                <p>
                  Upload video files (MP4, MOV, AVI). Maximum file size: 5MB per
                  video.
                </p>
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
            disabled: isSavingProducts || isLoadingProducts || !hasChanges, // Disabled when no changes
            loading: isSavingProducts,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: handleCloseAddProductModal,
              disabled: isSavingProducts,
            },
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
                  </BlockStack>
                </Banner>
              </Box>
            )}

            {isLoadingProducts ? (
              <ProductsLoadingState />
            ) : (
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
                  {selectedProducts.length} product
                  {selectedProducts.length !== 1 ? "s" : ""} selected
                  {hasChanges && (
                    <span style={{ color: "#2C6ECB", marginLeft: "8px" }}>
                      • Changes pending
                    </span>
                  )}
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
                            onClick={() =>
                              !isSavingProducts && handleToggleProduct(id)
                            }
                          >
                            <InlineStack
                              align="space-between"
                              blockAlign="center"
                            >
                              <InlineStack gap="300" blockAlign="center">
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => handleToggleProduct(id)}
                                  disabled={isSavingProducts}
                                />
                                <Text variant="bodyMd" fontWeight="medium">
                                  {title}
                                </Text>
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
            )}
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
                        Saving changes...
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </Banner>
              </Box>
            )}

            {isLoadingProducts ? (
              <ProductsLoadingState />
            ) : (
              <BlockStack gap="400">
                <Button
                  fullWidth
                  onClick={() => {
                    setModifyProductModalActive(false);
                    setAddProductModalActive(true);
                  }}
                  disabled={isSavingProducts}
                  variant="primary"
                >
                  + Attach products
                </Button>

                {/* Show changes indicator */}
                {hasChanges && (
                  <Banner tone="warning">
                    <Text variant="bodySm">
                      You have unsaved changes. Click "Save Changes" to apply.
                    </Text>
                  </Banner>
                )}

                <div
                  style={{
                    opacity: isSavingProducts ? 0.5 : 1,
                    pointerEvents: isSavingProducts ? "none" : "auto",
                  }}
                >
                  {getSelectedProductDetails().length > 0 ? (
                    <BlockStack gap="200">
                      {getSelectedProductDetails().map((product) => (
                        <Card key={product.id}>
                          <InlineStack
                            align="space-between"
                            blockAlign="center"
                          >
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
                      <p>
                        Click "Attach products" to add products to this video
                      </p>
                    </EmptyState>
                  )}
                </div>

                <InlineStack align="end">
                  <Button
                    onClick={handleSaveProducts}
                    loading={isSavingProducts}
                    disabled={isSavingProducts || !hasChanges} // Disabled when no changes
                    variant="primary"
                  >
                    {isSavingProducts ? "Saving..." : "Save Changes"}
                  </Button>
                </InlineStack>
              </BlockStack>
            )}
          </Modal.Section>
        </Modal>
      </Page>
      {toastMarkup}
    </Frame>
  );
}