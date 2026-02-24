const admin = require("firebase-admin");
const serviceAccount = require("../firebaseServiceAccount.json"); // The file you just downloaded

// Only initialize if there are no existing apps running
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = admin;