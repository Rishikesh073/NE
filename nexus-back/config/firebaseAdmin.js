const admin = require("firebase-admin");
require("dotenv").config(); // Loads your local .env file if you test on your machine

let pKey = process.env.FIREBASE_PRIVATE_KEY || '';
// Strip exact wrapping quotes if accidentally pasted with them
if (pKey.startsWith('"') && pKey.endsWith('"')) {
  pKey = pKey.slice(1, -1);
} else if (pKey.startsWith("'") && pKey.endsWith("'")) {
  pKey = pKey.slice(1, -1);
}
pKey = pKey.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: pKey || undefined,
  })
});

module.exports = admin;