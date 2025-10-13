import admin from 'firebase-admin';

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // converts \\n to real newlines

  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Missing Firebase environment variables.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
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

    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    console.log(`Upload successful: ${publicUrl}`);
    return publicUrl;
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
