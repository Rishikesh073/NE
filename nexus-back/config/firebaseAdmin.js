const admin = require("firebase-admin");

 const serviceAccount = require("../serviceAccountKey.json");// The file you just downloaded

// Only initialize if there are no existing apps running
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') // Handle newlines in the private key
    })
  });
}

module.exports = admin;