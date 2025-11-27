// app/routes/api.upload-video.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createVideo } from "../models/video.server";

// Shopify GraphQL mutation for staging file upload
const STAGED_UPLOADS_CREATE = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Shopify GraphQL mutation to create file in Shopify
const FILE_CREATE = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        ... on Video {
          id
          alt
          fileStatus
          sources {
            url
            mimeType
            format
            height
            width
          }
          preview {
            image {
              url
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Query to get file details by ID
const GET_FILE_DETAILS = `
  query getFile($id: ID!) {
    node(id: $id) {
      ... on Video {
        id
        fileStatus
        sources {
          url
          mimeType
          format
          height
          width
        }
        preview {
          image {
            url
          }
        }
      }
    }
  }
`;

// Helper function to poll for video processing completion
async function waitForVideoProcessing(admin, fileId, maxAttempts = 30) {
  console.log(`Polling for video processing: ${fileId}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await admin.graphql(GET_FILE_DETAILS, {
        variables: { id: fileId }
      });
      
      const data = await response.json();
      const videoNode = data.data?.node;
      
      console.log(`Attempt ${attempt + 1}: Status = ${videoNode?.fileStatus}`);
      
      if (videoNode?.fileStatus === 'READY') {
        if (videoNode?.sources?.length > 0) {
          console.log("Video processing complete!");
          return videoNode;
        }
      }
      
      // If failed, return null early
      if (videoNode?.fileStatus === 'FAILED') {
        console.error("Video processing failed in Shopify");
        return null;
      }
      
      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (pollError) {
      console.error(`Polling error on attempt ${attempt + 1}:`, pollError);
      // Continue polling even on error
    }
  }
  
  console.error("Video processing timed out after max attempts");
  return null;
}

// Helper function to get best video URL
function getBestVideoUrl(sources) {
  if (!sources || sources.length === 0) return null;
  
  // Prefer MP4 format, then sort by quality (width)
  const mp4Sources = sources.filter(s => 
    s.mimeType === 'video/mp4' || s.format === 'mp4'
  );
  
  const sourcesToUse = mp4Sources.length > 0 ? mp4Sources : sources;
  
  // Sort by width (highest quality first)
  const sortedSources = [...sourcesToUse].sort((a, b) => 
    (b.width || 0) - (a.width || 0)
  );
  
  return sortedSources[0]?.url || null;
}

export const action = async ({ request }) => {
  console.log("=== Video Upload Started ===");
  
  try {
    const { admin } = await authenticate.admin(request);
    
    const formData = await request.formData();
    const videoFiles = formData.getAll("videos");
    
    if (!videoFiles || videoFiles.length === 0) {
      return json({ 
        success: false, 
        error: "No videos provided" 
      }, { status: 400 });
    }

    console.log(`Processing ${videoFiles.length} file(s)`);
    
    const uploadedVideos = [];
    const failedVideos = [];

    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i];
      console.log(`\n--- Processing file ${i + 1}/${videoFiles.length}: ${file.name} ---`);
      
      try {
        // Validate file
        if (!file.type.startsWith('video/')) {
          console.error(`Invalid file type: ${file.type}`);
          failedVideos.push({ name: file.name, error: "Invalid file type" });
          continue;
        }
        
        // Check file size (100MB limit)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
          console.error(`File too large: ${file.size} bytes`);
          failedVideos.push({ name: file.name, error: "File exceeds 100MB limit" });
          continue;
        }

        // Step 1: Get staged upload URL from Shopify
        console.log("Step 1: Creating staged upload...");
        const stagedResponse = await admin.graphql(STAGED_UPLOADS_CREATE, {
          variables: {
            input: [
              {
                filename: file.name,
                mimeType: file.type || 'video/mp4',
                resource: "VIDEO",
                fileSize: file.size.toString(),
              },
            ],
          },
        });

        const stagedData = await stagedResponse.json();
        
        if (stagedData.data?.stagedUploadsCreate?.userErrors?.length > 0) {
          const errors = stagedData.data.stagedUploadsCreate.userErrors;
          console.error("Staged upload errors:", errors);
          failedVideos.push({ name: file.name, error: errors[0].message });
          continue;
        }

        const stagedTarget = stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0];
        
        if (!stagedTarget) {
          console.error("No staged target received");
          failedVideos.push({ name: file.name, error: "Failed to get upload URL" });
          continue;
        }

        console.log("Staged upload URL received");

        // Step 2: Upload file to Shopify's staged URL
        console.log("Step 2: Uploading file to Shopify...");
        const uploadFormData = new FormData();
        
        // Add all parameters from Shopify
        stagedTarget.parameters.forEach(param => {
          uploadFormData.append(param.name, param.value);
        });
        
        // Add the actual file
        uploadFormData.append("file", file);

        const uploadResponse = await fetch(stagedTarget.url, {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => 'Unknown error');
          console.error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
          failedVideos.push({ name: file.name, error: `Upload failed: ${uploadResponse.status}` });
          continue;
        }

        console.log("File uploaded to Shopify successfully");

        // Step 3: Create file record in Shopify
        console.log("Step 3: Creating file record in Shopify...");
        const fileCreateResponse = await admin.graphql(FILE_CREATE, {
          variables: {
            files: [
              {
                alt: file.name.replace(/\.[^/.]+$/, ""), 
                contentType: "VIDEO",
                originalSource: stagedTarget.resourceUrl,
              },
            ],
          },
        });

        const fileCreateData = await fileCreateResponse.json();
        
        if (fileCreateData.data?.fileCreate?.userErrors?.length > 0) {
          const errors = fileCreateData.data.fileCreate.userErrors;
          console.error("File create errors:", errors);
          failedVideos.push({ name: file.name, error: errors[0].message });
          continue;
        }

        const createdFile = fileCreateData.data?.fileCreate?.files?.[0];
        
        if (!createdFile) {
          console.error("No file created in Shopify");
          failedVideos.push({ name: file.name, error: "Failed to create file record" });
          continue;
        }

        console.log("File created in Shopify:", createdFile.id);

        // Step 4: Wait for video processing and get actual CDN URLs
        console.log("Step 4: Waiting for video processing...");
        const processedVideo = await waitForVideoProcessing(admin, createdFile.id);
        
        if (!processedVideo) {
          console.error("Video processing timed out or failed");
          failedVideos.push({ name: file.name, error: "Video processing timed out" });
          continue;
        }

        // Step 5: Extract the actual CDN URLs
        console.log("Step 5: Extracting CDN URLs...");
        const videoUrl = getBestVideoUrl(processedVideo.sources);
        const thumbnailUrl = processedVideo.preview?.image?.url || null;
        
        console.log("Video URL:", videoUrl);
        console.log("Thumbnail URL:", thumbnailUrl);

        // Validate video URL
        if (!videoUrl) {
          console.error("No valid video URL found");
          failedVideos.push({ name: file.name, error: "No video URL available" });
          continue;
        }

        // Step 6: Save to database with actual CDN URLs
        console.log("Step 6: Saving to database...");
        const video = await createVideo({
          title: file.name.replace(/\.[^/.]+$/, ""), 
          videoUrl: videoUrl,
          thumbnailUrl: thumbnailUrl || videoUrl, // Use video URL as fallback
          firebasePath: null,
          source: 'shopify',
          shopifyFileId: createdFile.id,
          processingStatus: 'ready',
          processingProgress: 100,
        });

        uploadedVideos.push({
          id: video.id,
          title: video.title,
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl,
        });
        
        console.log(`✓ Video saved successfully: ${video.id}`);

      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        failedVideos.push({ name: file.name, error: fileError.message });
        continue;
      }
    }

    console.log("\n=== Upload Summary ===");
    console.log(`Success: ${uploadedVideos.length}`);
    console.log(`Failed: ${failedVideos.length}`);

    // Return response
    if (uploadedVideos.length === 0) {
      return json({ 
        success: false, 
        error: "Failed to upload any videos",
        failedVideos: failedVideos
      }, { status: 500 });
    }

    return json({ 
      success: true, 
      videos: uploadedVideos,
      failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
      message: `${uploadedVideos.length} video(s) uploaded successfully${failedVideos.length > 0 ? `, ${failedVideos.length} failed` : ''}`
    });

  } catch (error) {
    console.error("Critical upload error:", error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
};

export const loader = async () => {
  return json({ error: "Method not allowed" }, { status: 405 });
};