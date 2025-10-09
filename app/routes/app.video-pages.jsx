import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";

import { authenticate } from "../shopify.server";
import { getVideoPages } from "../models/videoPage.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const videoPages = await getVideoPages();
  return json({ videoPages });
};

export default function VideoPages() {
  const { videoPages } = useLoaderData();
  const navigate = useNavigate();

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Video Pages</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/app/upload')}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            Upload videos
          </button>
          <button
            onClick={() => navigate('/app/video-pages/new')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              background: '#000',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Add videos to a new page
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by page name"
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '5px'
          }}
        />
      </div>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px'
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Page path</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Widgets present</th>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Widget status</th>
          </tr>
        </thead>
        <tbody>
          {videoPages.map((page) => (
            <tr key={page.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '12px' }}>{page.pagePath}</td>
              <td style={{ padding: '12px' }}>
                {page.widgetType === 'carousel' && 'Floating, Carousel'}
                {page.widgetType === 'stories' && 'Stories'}
                {page.widgetType === 'floating' && 'Floating'}
              </td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  backgroundColor: page.status === 'live' ? '#d4f4dd' : '#f0f0f0',
                  color: page.status === 'live' ? '#0d7c2d' : '#666',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {page.status === 'live' ? 'Live' : 'Draft'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}