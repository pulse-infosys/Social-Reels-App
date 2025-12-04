import { useState, useCallback } from "react";
import { useNavigate } from "@remix-run/react";
import {
  Frame,
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Tabs,
  Badge,
  TextField,
  Select,
  Checkbox,
} from "@shopify/polaris";

const WIDGET_TABS = [
  { id: "carousel", content: "Carousel" },
  { id: "story", content: "Story" },
  { id: "floating", content: "Floating" },
  { id: "overlay", content: "Overlay" },
];

const TEMPLATE_TABS = [
  { id: "template-1", content: "Template 1" },
  { id: "template-2", content: "Template 2" },
];

// Simple component blocks in the preview
const INITIAL_COMPONENTS = {
  image: {
    id: "image",
    label: "Hero image",
    type: "image",
    settings: {
      backgroundColor: "#f4f4f4",
      borderRadius: "24px",
    },
  },
  title: {
    id: "title",
    label: "Story title/subtitle",
    type: "text",
    settings: {
      text: "Story title / subtitle",
      fontSize: "16px",
      textAlign: "center",
    },
  },
  price: {
    id: "price",
    label: "Price section",
    type: "price",
    settings: {
      priceText: "Rs 399",
      compareAt: "Rs 799",
      badgeText: "50% off",
    },
  },
};

export default function TemplateEditorPage() {
  const navigate = useNavigate();

  const [selectedWidgetTab, setSelectedWidgetTab] = useState(0);
  const [selectedTemplateTab, setSelectedTemplateTab] = useState(0);
  const [selectedComponentId, setSelectedComponentId] = useState("title");
  const [components, setComponents] = useState(INITIAL_COMPONENTS);

  const selectedComponent = components[selectedComponentId];

  const handleWidgetTabChange = useCallback((index) => {
    setSelectedWidgetTab(index);
  }, []);

  const handleTemplateTabChange = useCallback((index) => {
    setSelectedTemplateTab(index);
  }, []);

  const handleSelectComponent = (id) => {
    setSelectedComponentId(id);
  };

  // Small helpers to update settings for selected component
  const updateComponentSetting = (field, value) => {
    setComponents((prev) => ({
      ...prev,
      [selectedComponentId]: {
        ...prev[selectedComponentId],
        settings: {
          ...prev[selectedComponentId].settings,
          [field]: value,
        },
      },
    }));
  };

  return (
    <Frame>
      <Page
        title="Template Editor"
        backAction={{
          content: "Back",
          onAction: () => navigate("/app"),
        }}
      >
        <Layout>
          {/* LEFT: Preview column */}
          <Layout.Section>
            <Card padding="0">
              <BlockStack gap="0">
                {/* Top widget tabs */}
                <div style={{ borderBottom: "1px solid #e3e5e8" }}>
                  <Tabs
                    tabs={WIDGET_TABS}
                    selected={selectedWidgetTab}
                    onSelect={handleWidgetTabChange}
                  />
                </div>

                {/* Template tabs */}
                <div
                  style={{
                    borderBottom: "1px solid #e3e5e8",
                    paddingInline: "16px",
                    paddingBlock: "8px",
                  }}
                >
                  <InlineStack gap="300" align="space-between">
                    <Tabs
                      tabs={TEMPLATE_TABS}
                      selected={selectedTemplateTab}
                      onSelect={handleTemplateTabChange}
                    />
                    <Badge tone="info">Default</Badge>
                  </InlineStack>
                </div>

                {/* Phone preview */}
                <div
                  style={{
                    padding: "24px",
                    display: "flex",
                    justifyContent: "center",
                    backgroundColor: "#f6f6f7",
                  }}
                >
                  <div
                    style={{
                      width: "280px",
                      height: "560px",
                      borderRadius: "32px",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {/* Image block */}
                    <div
                      onClick={() => handleSelectComponent("image")}
                      style={{
                        flex: "0 0 65%",
                        borderRadius:
                          components.image.settings.borderRadius || "24px",
                        background:
                          components.image.settings.backgroundColor ||
                          "#f4f4f4",
                        border:
                          selectedComponentId === "image"
                            ? "2px dashed #2c6ecb"
                            : "1px solid #e3e5e8",
                        cursor: "pointer",
                      }}
                    ></div>

                    {/* Thumbnail row (static example) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          backgroundColor: "#dfe3e8",
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          height: "8px",
                          borderRadius: "4px",
                          backgroundColor: "#dfe3e8",
                        }}
                      />
                    </div>

                    {/* Title block */}
                    <div
                      onClick={() => handleSelectComponent("title")}
                      style={{
                        borderRadius: "12px",
                        padding: "10px 12px",
                        border:
                          selectedComponentId === "title"
                            ? "2px dashed #2c6ecb"
                            : "1px dashed #dde0e4",
                        cursor: "pointer",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <Text
                        variant="bodyMd"
                        alignment={selectedComponent?.settings.textAlign || "center"}
                      >
                        {components.title.settings.text}
                      </Text>
                    </div>

                    {/* Price block */}
                    <div
                      onClick={() => handleSelectComponent("price")}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "12px",
                        border:
                          selectedComponentId === "price"
                            ? "2px dashed #2c6ecb"
                            : "1px solid #e3e5e8",
                        cursor: "pointer",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <BlockStack gap="050">
                        <InlineStack
                          align="space-between"
                          blockAlign="center"
                        >
                          <Text variant="bodyMd" fontWeight="bold">
                            {components.price.settings.priceText}
                          </Text>
                          <Text
                            variant="bodySm"
                            tone="subdued"
                            decoration="lineThrough"
                          >
                            {components.price.settings.compareAt}
                          </Text>
                          <Text variant="bodySm" tone="success">
                            {components.price.settings.badgeText}
                          </Text>
                        </InlineStack>
                      </BlockStack>
                    </div>
                  </div>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* RIGHT: Settings panel */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  Settings
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Configure the selected block in your template.
                </Text>

                <InlineStack
                  align="space-between"
                  blockAlign="center"
                  style={{ marginTop: "8px" }}
                >
                  <Text variant="bodySm">
                    Selected:{" "}
                    <strong>{selectedComponent?.label || "None"}</strong>
                  </Text>
                  <Badge tone="info">
                    {WIDGET_TABS[selectedWidgetTab].content}
                  </Badge>
                </InlineStack>

                {/* Background color for image block */}
                {selectedComponent?.id === "image" && (
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">
                      Background
                    </Text>
                    <InlineStack gap="150" blockAlign="center">
                      <Checkbox
                        label="Custom background color"
                        checked={
                          !!selectedComponent.settings.backgroundColor &&
                          selectedComponent.settings.backgroundColor !==
                            "#f4f4f4"
                        }
                        onChange={(checked) => {
                          updateComponentSetting(
                            "backgroundColor",
                            checked ? "#ffffff" : "#f4f4f4",
                          );
                        }}
                      />
                    </InlineStack>
                    <TextField
                      label="Background color (hex)"
                      value={selectedComponent.settings.backgroundColor}
                      onChange={(value) =>
                        updateComponentSetting("backgroundColor", value)
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Border radius"
                      value={selectedComponent.settings.borderRadius}
                      onChange={(value) =>
                        updateComponentSetting("borderRadius", value)
                      }
                      autoComplete="off"
                      suffix="px"
                    />
                  </BlockStack>
                )}

                {/* Title settings */}
                {selectedComponent?.id === "title" && (
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">
                      Title
                    </Text>
                    <TextField
                      label="Text"
                      value={selectedComponent.settings.text}
                      onChange={(value) =>
                        updateComponentSetting("text", value)
                      }
                      autoComplete="off"
                    />
                    <Select
                      label="Alignment"
                      options={[
                        { label: "Left", value: "left" },
                        { label: "Center", value: "center" },
                        { label: "Right", value: "right" },
                      ]}
                      value={selectedComponent.settings.textAlign}
                      onChange={(value) =>
                        updateComponentSetting("textAlign", value)
                      }
                    />
                  </BlockStack>
                )}

                {/* Price settings */}
                {selectedComponent?.id === "price" && (
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">
                      Price
                    </Text>
                    <TextField
                      label="Price text"
                      value={selectedComponent.settings.priceText}
                      onChange={(value) =>
                        updateComponentSetting("priceText", value)
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Compare at"
                      value={selectedComponent.settings.compareAt}
                      onChange={(value) =>
                        updateComponentSetting("compareAt", value)
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Badge"
                      value={selectedComponent.settings.badgeText}
                      onChange={(value) =>
                        updateComponentSetting("badgeText", value)
                      }
                      autoComplete="off"
                    />
                  </BlockStack>
                )}

                {/* Default message if nothing selected */}
                {!selectedComponent && (
                  <Text variant="bodySm" tone="subdued">
                    Click on any block in the preview to edit its settings.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}