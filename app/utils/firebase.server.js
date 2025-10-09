import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();

export async function uploadVideoToFirebase(buffer, filePath, mimeType) {
  try {
    console.log(`Uploading to Firebase: ${filePath}`);
    
    const file = bucket.file(filePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
      public: true,
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Return just the URL string, not an object
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    console.log(`Upload successful: ${publicUrl}`);
    
    return publicUrl; // Return string, not object!
    
  } catch (error) {
    console.error('Firebase upload error:', error);
    throw error;
  }
}

export async function deleteVideoFromFirebase(filePath) {
  try {
    const file = bucket.file(filePath);
    await file.delete();
    console.log(`Deleted from Firebase: ${filePath}`);
  } catch (error) {
    console.error('Firebase deletion error:', error);
    throw error;
  }
}