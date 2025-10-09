import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Modal,
  ResourceList,
  ResourceItem,
  Thumbnail,
  TextField,
  EmptyState,
  Toast,
  Frame
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);
  
  const { getVideoById } = await import("../models/video.server");
  const video = await getVideoById(params.id);
  
  if (!video) {
    throw new Response("Video not found", { status: 404 });
  }
  
  return json({ video });
};

export const action = async ({ request, params }) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  const { 
    attachProductToVideo, 
    detachProductFromVideo,
    deleteVideo 
  } = await import("../models/video.server");
  
  if (intent === "attach") {
    const productId = formData.get("productId");
    await attachProductToVideo(params.id, productId);
    return json({ success: true });
  }
  
  if (intent === "detach") {
    const productId = formData.get("productId");
    await detachProductFromVideo(params.id, productId);
    return json({ success: true });
  }
  
  if (intent === "delete") {
    await deleteVideo(params.id);
    return json({ success: true, redirect: "/app" });
  }
  
  return json({ success: false });
};

export default function VideoDetail() {
  const { video } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  
  const [productSearchActive, setProductSearchActive] = useState(false);
  const [deleteModalActive, setDeleteModalActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleProductSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await fetch(`/app/api/search-products?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error("Search failed:", error);
      setToastMessage("Failed to search products");
      setToastActive(true);
    } finally {
      setSearching(false);
    }
  };

  const handleAttachProduct = (product) => {
    const formData = new FormData();
    formData.append("intent", "attach");
    formData.append("productId", product.id);
    
    submit(formData, { method: "post" });
    setProductSearchActive(false);
    setToastMessage("Product attached successfully");
    setToastActive(true);
  };

  const handleDetachProduct = (productId) => {
    const formData = new FormData();
    formData.append("intent", "detach");
    formData.append("productId", productId);
    
    submit(formData, { method: "post" });
    setToastMessage("Product detached");
    setToastActive(true);
  };

  const handleDeleteVideo = () => {
    const formData = new FormData();
    formData.append("intent", "delete");
    
    submit(formData, { method: "post" });
    setDeleteModalActive(false);
    setTimeout(() => navigate("/app"), 500);
  };

  const toggleToast = useCallback(() => setToastActive(prev => !prev), []);

  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} onDismiss={toggleToast} />
  ) : null;

  return (
    <Frame>
      <Page
        title={video.title}
        backAction={{ content: "Video library", onAction: () => navigate("/app") }}
        secondaryActions={[
          {
            content: "Delete video",
            destructive: true,
            onAction: () => setDeleteModalActive(true)
          }
        ]}
      >
        <Layout>
          {/* Video Preview */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Video preview</Text>
                <div style={{
                  position: 'relative',
                  paddingTop: '177.78%',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <video
                    src={video.videoUrl}
                    controls
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>
                <InlineStack gap="200">
                  <Badge>Source: {video.source}</Badge>
                  {video.duration && <Badge>{video.duration}s</Badge>}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Attached Products */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Attached products</Text>
                  <Button onClick={() => setProductSearchActive(true)}>
                    Attach products
                  </Button>
                </InlineStack>

                {video.videoProducts && video.videoProducts.length > 0 ? (
                  <ResourceList
                    resourceName={{ singular: 'product', plural: 'products' }}
                    items={video.videoProducts.map(vp => vp.product)}
                    renderItem={(product) => {
                      const { id, title, image, price } = product;
                      const media = (
                        <Thumbnail
                          source={image || 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png'}
                          alt={title}
                          size="small"
                        />
                      );

                      return (
                        <ResourceItem
                          id={id}
                          media={media}
                          accessibilityLabel={`View details for ${title}`}
                        >
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <Text as="h3" variant="bodyMd" fontWeight="semibold">
                                {title}
                              </Text>
                              {price && (
                                <Text as="p" variant="bodySm" tone="subdued">
                                  ${price}
                                </Text>
                              )}
                            </BlockStack>
                            <Button
                              plain
                              destructive
                              onClick={() => handleDetachProduct(id)}
                            >
                              Remove
                            </Button>
                          </InlineStack>
                        </ResourceItem>
                      );
                    }}
                  />
                ) : (
                  <EmptyState
                    heading="No products attached"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Attach products to this video to showcase them in your store.</p>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Product Search Modal */}
        <Modal
          open={productSearchActive}
          onClose={() => setProductSearchActive(false)}
          title="Search and attach products"
          primaryAction={{
            content: "Cancel",
            onAction: () => setProductSearchActive(false)
          }}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search products..."
                    autoComplete="off"
                  />
                </div>
                <Button onClick={handleProductSearch} loading={searching}>
                  Search
                </Button>
              </InlineStack>

              {products.length > 0 && (
                <ResourceList
                  resourceName={{ singular: 'product', plural: 'products' }}
                  items={products}
                  renderItem={(product) => {
                    const { id, title, image, price } = product;
                    const media = (
                      <Thumbnail
                        source={image || 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png'}
                        alt={title}
                        size="small"
                      />
                    );

                    return (
                      <ResourceItem
                        id={id}
                        media={media}
                        accessibilityLabel={`Attach ${title}`}
                      >
                        <InlineStack align="space-between">
                          <BlockStack gap="100">
                            <Text as="h3" variant="bodyMd" fontWeight="semibold">
                              {title}
                            </Text>
                            {price && (
                              <Text as="p" variant="bodySm" tone="subdued">
                                ${price}
                              </Text>
                            )}
                          </BlockStack>
                          <Button onClick={() => handleAttachProduct(product)}>
                            Attach
                          </Button>
                        </InlineStack>
                      </ResourceItem>
                    );
                  }}
                />
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          open={deleteModalActive}
          onClose={() => setDeleteModalActive(false)}
          title="Delete video"
          primaryAction={{
            content: "Delete",
            destructive: true,
            onAction: handleDeleteVideo
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setDeleteModalActive(false)
            }
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete this video? This action cannot be undone.
            </Text>
          </Modal.Section>
        </Modal>
      </Page>
      {toastMarkup}
    </Frame>
  );
}