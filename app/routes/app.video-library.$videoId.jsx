import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Modal,
  TextField,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Text,
  InlineStack,
  Checkbox,
  Button,
  EmptyState
} from "@shopify/polaris";
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
  const limit = 250; // Max allowed by Shopify GraphQL

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

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  
  // Import server modules only in loader
  const { getVideoById } = await import("../models/video.server");
  const { getProducts, syncProductsFromShopify } = await import("../models/product.server");
  
  const video = await getVideoById(params.videoId);
  
  // Fetch ALL products from Shopify using GraphQL with pagination
  const shopifyProducts = await fetchAllProducts(admin);

  console.log('Total products fetched from Shopify:', shopifyProducts.length);
  
  // Sync products to database
  await syncProductsFromShopify(shopifyProducts);
  
  // Get all products from database
  const products = await getProducts();
  
  return json({ video, products });
};

export const action = async ({ request, params }) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const productIds = JSON.parse(formData.get("productIds") || "[]");
  
  // Import in action only
  const { attachProductsToVideo } = await import("../models/product.server");
  await attachProductsToVideo(params.videoId, productIds);
  
  return redirect("/app");
};

export default function AttachProducts() {
  const { video, products } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  
  const [active, setActive] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState(
    video.videoProducts.map(vp => vp.productId)
  );
  const [searchValue, setSearchValue] = useState("");

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleToggleProduct = useCallback((productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const handleClose = useCallback(() => {
    setActive(false);
    navigate("/app");
  }, [navigate]);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("productIds", JSON.stringify(selectedProducts));
    submit(formData, { method: "post" });
    setActive(false);
  }, [selectedProducts, submit]);

  return (
    <Modal
      open={active}
      onClose={handleClose}
      title="Add products"
      primaryAction={{
        content: "Add",
        onAction: handleSave,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: handleClose,
        },
      ]}
    >
      <Modal.Section>
        <TextField
          label=""
          value={searchValue}
          onChange={handleSearchChange}
          placeholder="Search products"
          autoComplete="off"
          clearButton
          onClearButtonClick={() => setSearchValue("")}
        />
        
        <div style={{ marginTop: '16px' }}>
          <Text as="p" variant="bodySm" tone="subdued">
            {selectedProducts.length} product selected
          </Text>
        </div>

        <div style={{ marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
          {filteredProducts.length > 0 ? (
            <ResourceList
              resourceName={{ singular: 'product', plural: 'products' }}
              items={filteredProducts}
              renderItem={(product) => {
                const { id, title, image, price } = product;
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
                    onClick={() => handleToggleProduct(id)}
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="300" blockAlign="center">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleProduct(id)}
                        />
                        <div>
                          <Text variant="bodyMd" fontWeight="medium">
                            {title}
                          </Text>
                          {price && (
                            <Text as="p" variant="bodySm" tone="subdued">
                              ${price}
                            </Text>
                          )}
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
      </Modal.Section>
    </Modal>
  );
}