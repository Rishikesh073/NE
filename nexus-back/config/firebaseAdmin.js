const admin = require("firebase-admin");
require("dotenv").config(); // Loads your local .env file if you test on your machine

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // The replace() function is crucial here so Render reads the newlines correctly
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  })
});

module.exports = admin;