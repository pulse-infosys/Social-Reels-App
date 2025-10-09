import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Text
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  // Import only in loader
  const { getVideoPages } = await import("../models/videoPage.server");
  const videoPages = await getVideoPages();
  
  return json({ videoPages });
};

export default function VideoPages() {
  const { videoPages } = useLoaderData();
  const navigate = useNavigate();

  const rows = videoPages.map((page) => [
    page.pagePath,
    page.widgetType.charAt(0).toUpperCase() + page.widgetType.slice(1),
    <Badge key={page.id} tone={page.status === 'live' ? 'success' : 'default'}>
      {page.status === 'live' ? 'Live' : 'Draft'}
    </Badge>
  ]);

  return (
    <Page
      title="Video Pages"
      primaryAction={{
        content: "Add videos to a new page",
        onAction: () => navigate("/app/video-pages/new")
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            {videoPages.length === 0 ? (
              <Text as="p" tone="subdued">
                No video pages created yet. Create your first page to display videos on your store.
              </Text>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text']}
                headings={['Page path', 'Widget type', 'Status']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}