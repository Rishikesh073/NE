const admin = require("firebase-admin");
require("dotenv").config(); // Loads your local .env file if you test on your machine

let pKey = process.env.FIREBASE_PRIVATE_KEY || '';

if (pKey) {
  // 1. Strip exact wrapping quotes if accidentally pasted with them
  pKey = pKey.replace(/^["']|["']$/g, "");

  // 2. Fix literal \n characters if they exist
  if (pKey.includes("\\n")) {
    pKey = pKey.replace(/\\n/g, "\n");
  }

  // 3. If there are NO newlines but it has spaces instead (very common copy-paste error)
  if (!pKey.includes("\n") && pKey.includes("-----BEGIN PRIVATE KEY-----")) {
    // Extract the base64 content
    let keyContent = pKey
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s+/g, ""); // Remove all empty spaces

    // Reconstruct valid PEM format (break into 64 char lines)
    let formattedKey = keyContent.match(/.{1,64}/g)?.join("\n") || "";
    pKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----\n`;
  }
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: pKey || undefined,
  })
});

module.exports = admin;