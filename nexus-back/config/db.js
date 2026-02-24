const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../serviceAccountKey.json');

// THIS IS THE FIX: Check if Firebase is already running before trying to initialize it
let app;
if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount)
  });
} else {
  // If it's already running, just use the existing instance
  app = getApp(); 
}

const db = getFirestore(app, 'default');

module.exports = db;