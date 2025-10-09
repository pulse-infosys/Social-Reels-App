import { json } from "@remix-run/node";
import Busboy from "busboy";
import { Readable } from "stream";
import path from "path";
import { uploadVideoToFirebase } from "../utils/firebase.server";
import { createVideo } from "../models/video.server";

export const action = async ({ request }) => {
  const contentType = request.headers.get("content-type");
  
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return json({ error: "Invalid content type" }, { status: 400 });
  }

  try {
    const uploadedVideos = [];
    const busboy = Busboy({ headers: { "content-type": contentType } });

    const filePromises = [];

    busboy.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;
      console.log(`Receiving file: ${filename}, type: ${mimeType}`);

      const chunks = [];
      
      file.on("data", (data) => {
        chunks.push(data);
      });

      file.on("end", () => {
        console.log(`File received: ${filename}, size: ${Buffer.concat(chunks).length} bytes`);
      });

      const filePromise = new Promise((resolve, reject) => {
        file.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            resolve({ filename, buffer, mimeType });
          } catch (error) {
            reject(error);
          }
        });
        
        file.on("error", reject);
      });

      filePromises.push(filePromise);
    });

    await new Promise((resolve, reject) => {
      busboy.on("finish", resolve);
      busboy.on("error", reject);

      const nodeStream = Readable.from(request.body);
      nodeStream.pipe(busboy);
    });

    console.log(`Busboy finished. Total files: ${filePromises.length}`);

    const files = await Promise.all(filePromises);

    for (const { filename, buffer, mimeType } of files) {
      try {
        console.log(`Processing: ${filename}`);

        // Upload to Firebase
        const timestamp = Date.now();
        const uniqueId = Math.random().toString(36).substring(2, 15);
        const firebasePath = `videos/vid_${timestamp}_${uniqueId}/${filename}`;
        
        console.log(`Uploading to Firebase: ${firebasePath}`);
        const videoUrl = await uploadVideoToFirebase(buffer, firebasePath, mimeType);
        console.log(`Upload successful: ${videoUrl}`);

        // Save to database
        const videoData = {
          title: path.parse(filename).name,
          videoUrl: videoUrl,
          thumbnailUrl: videoUrl, // You can generate a proper thumbnail later
          firebasePath: firebasePath,
          source: 'upload',
          duration: null,
        };

        console.log('Creating video in database with data:', videoData);
        
        const video = await createVideo(videoData);
        console.log('Video created successfully:', video);
        
        uploadedVideos.push(video);
      } catch (error) {
        console.error(`Failed to upload ${filename}:`, error);
        console.error('Error stack:', error.stack);
      }
    }

    if (uploadedVideos.length === 0) {
      return json({ error: "No videos were uploaded successfully" }, { status: 500 });
    }

    return json({ 
      success: true, 
      videos: uploadedVideos,
      message: `${uploadedVideos.length} video(s) uploaded successfully`
    });

  } catch (error) {
    console.error("Upload error:", error);
    console.error('Error stack:', error.stack);
    return json({ error: error.message }, { status: 500 });
  }
};