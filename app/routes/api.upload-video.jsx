// import { json } from "@remix-run/node";
// import Busboy from "busboy";
// import { Readable } from "stream";
// import path from "path";
// import { uploadVideoToFirebase } from "../utils/firebase.server";
// import { createVideo } from "../models/video.server";

// export const action = async ({ request }) => {
//   const contentType = request.headers.get("content-type");
  
//   if (!contentType || !contentType.includes("multipart/form-data")) {
//     return json({ error: "Invalid content type" }, { status: 400 });
//   }

//   try {
//     const uploadedVideos = [];
//     const busboy = Busboy({ headers: { "content-type": contentType } });

//     const filePromises = [];

//     busboy.on("file", (fieldname, file, info) => {
//       const { filename, mimeType } = info;
//       console.log(`Receiving file: ${filename}, type: ${mimeType}`);

//       const chunks = [];
      
//       file.on("data", (data) => {
//         chunks.push(data);
//       });

//       file.on("end", () => {
//         console.log(`File received: ${filename}, size: ${Buffer.concat(chunks).length} bytes`);
//       });

//       const filePromise = new Promise((resolve, reject) => {
//         file.on("end", async () => {
//           try {
//             const buffer = Buffer.concat(chunks);
//             resolve({ filename, buffer, mimeType });
//           } catch (error) {
//             reject(error);
//           }
//         });
        
//         file.on("error", reject);
//       });

//       filePromises.push(filePromise);
//     });

//     await new Promise((resolve, reject) => {
//       busboy.on("finish", resolve);
//       busboy.on("error", reject);

//       const nodeStream = Readable.from(request.body);
//       nodeStream.pipe(busboy);
//     });

//     console.log(`Busboy finished. Total files: ${filePromises.length}`);

//     const files = await Promise.all(filePromises);

//     for (const { filename, buffer, mimeType } of files) {
//       try {
//         console.log(`Processing: ${filename}`);

//         // Upload to Firebase
//         const timestamp = Date.now();
//         const uniqueId = Math.random().toString(36).substring(2, 15);
//         const firebasePath = `videos/vid_${timestamp}_${uniqueId}/${filename}`;
        
//         console.log(`Uploading to Firebase: ${firebasePath}`);
//         const videoUrl = await uploadVideoToFirebase(buffer, firebasePath, mimeType);
//         console.log(`Upload successful: ${videoUrl}`);

//         // Save to database
//         const videoData = {
//           title: path.parse(filename).name,
//           videoUrl: videoUrl,
//           thumbnailUrl: videoUrl, // You can generate a proper thumbnail later
//           firebasePath: firebasePath,
//           source: 'upload',
//           duration: null,
//         };

//         console.log('Creating video in database with data:', videoData);
        
//         const video = await createVideo(videoData);
//         console.log('Video created successfully:', video);
        
//         uploadedVideos.push(video);
//       } catch (error) {
//         console.error(`Failed to upload ${filename}:`, error);
//         console.error('Error stack:', error.stack);
//       }
//     }

//     if (uploadedVideos.length === 0) {
//       return json({ error: "No videos were uploaded successfully" }, { status: 500 });
//     }

//     return json({ 
//       success: true, 
//       videos: uploadedVideos,
//       message: `${uploadedVideos.length} video(s) uploaded successfully`
//     });

//   } catch (error) {
//     console.error("Upload error:", error);
//     console.error('Error stack:', error.stack);
//     return json({ error: error.message }, { status: 500 });
//   }
// };




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
async function waitForVideoProcessing(admin, fileId, maxAttempts = 15) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await admin.graphql(GET_FILE_DETAILS, {
      variables: { id: fileId }
    });
    
    const data = await response.json();
    const videoNode = data.data?.node;
    
    if (videoNode?.fileStatus === 'READY' && videoNode?.sources?.length > 0) {
      return videoNode;
    }
    
    // Wait 2 seconds before next attempt
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return null;
}

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    const formData = await request.formData();
    const videoFiles = formData.getAll("videos");
    
    if (!videoFiles || videoFiles.length === 0) {
      return json({ error: "No videos provided" }, { status: 400 });
    }

    const uploadedVideos = [];

    for (const file of videoFiles) {
      try {
        console.log(`Processing file: ${file.name}`);
        
        // Step 1: Get staged upload URL from Shopify
        const stagedResponse = await admin.graphql(STAGED_UPLOADS_CREATE, {
          variables: {
            input: [
              {
                filename: file.name,
                mimeType: file.type,
                resource: "VIDEO",
                fileSize: file.size.toString(),
              },
            ],
          },
        });

        const stagedData = await stagedResponse.json();
        
        if (stagedData.data?.stagedUploadsCreate?.userErrors?.length > 0) {
          console.error("Staged upload errors:", stagedData.data.stagedUploadsCreate.userErrors);
          continue;
        }

        const stagedTarget = stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0];
        
        if (!stagedTarget) {
          console.error("No staged target received");
          continue;
        }

        // Step 2: Upload file to Shopify's staged URL
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
          console.error(`Upload failed: ${uploadResponse.status}`);
          continue;
        }

        console.log("File uploaded to staged URL successfully");

        // Step 3: Create file record in Shopify
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
          console.error("File create errors:", fileCreateData.data.fileCreate.userErrors);
          continue;
        }

        const createdFile = fileCreateData.data?.fileCreate?.files?.[0];
        
        if (!createdFile) {
          console.error("No file created");
          continue;
        }

        console.log("File created in Shopify:", createdFile.id);

        // Step 4: Wait for video processing and get actual CDN URLs
        console.log("Waiting for video processing...");
        const processedVideo = await waitForVideoProcessing(admin, createdFile.id);
        
        if (!processedVideo) {
          console.error("Video processing timed out");
          continue;
        }

        // Step 5: Extract the actual CDN URLs
        let videoUrl = null;
        let thumbnailUrl = null;
        
        // Get the best quality video source
        if (processedVideo.sources && processedVideo.sources.length > 0) {
          // Sort by width to get highest quality
          const sortedSources = [...processedVideo.sources].sort((a, b) => 
            (b.width || 0) - (a.width || 0)
          );
          videoUrl = sortedSources[0].url;
          console.log("Video CDN URL:", videoUrl);
        }
        
        // Get thumbnail
        if (processedVideo.preview?.image?.url) {
          thumbnailUrl = processedVideo.preview.image.url;
          console.log("Thumbnail URL:", thumbnailUrl);
        }

        // Validate URLs
        if (!videoUrl || !videoUrl.includes('cdn.shopify.com')) {
          console.error("Invalid video URL:", videoUrl);
          continue;
        }

        // Step 6: Save to database with actual CDN URLs
        const video = await createVideo({
          title: file.name.replace(/\.[^/.]+$/, ""), 
          videoUrl: videoUrl,
          thumbnailUrl: thumbnailUrl || `https://cdn.shopify.com/s/files/1/0262/4071/2726/files/placeholder-images-video.png`,
          firebasePath: null,
          source: 'upload',
          shopifyFileId: createdFile.id,
          processingStatus: 'complete',
          processingProgress: 100,
        });

        uploadedVideos.push(video);
        console.log(`Video saved to database with CDN URL: ${video.id}`);

      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        continue;
      }
    }

    if (uploadedVideos.length === 0) {
      return json({ error: "Failed to upload videos" }, { status: 500 });
    }

    return json({ 
      success: true, 
      videos: uploadedVideos,
      message: `${uploadedVideos.length} video(s) uploaded successfully`
    });

  } catch (error) {
    console.error("Upload error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

export const loader = async () => {
  return json({ error: "Method not allowed" }, { status: 405 });
};