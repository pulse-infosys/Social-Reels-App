import { json } from "@remix-run/node";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const loader = async ({ params }) => {
  const filepath = params["*"];
  const fullPath = join(process.cwd(), "public", "uploads", filepath);
  
  if (!existsSync(fullPath)) {
    return new Response("File not found", { status: 404 });
  }
  
  const file = await readFile(fullPath);
  const ext = filepath.split('.').pop()?.toLowerCase();
  
  const mimeTypes = {
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp'
  };
  
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  return new Response(file, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000'
    }
  });
};