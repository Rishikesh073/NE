const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');
const db = require('../config/db');

// 1. Configure Cloudinary (Replace with your actual credentials)
cloudinary.config({
  cloud_name: 'dxgzkijjo',
  api_key: '554168347247721',
  api_secret: 'xsE7enhG-_D57dsy1gRyDqZiEtw'
});

// 2. Configure Multer to hold the file in memory temporarily
const storage = multer.memoryStorage();
const upload = multer({ storage }).single('file');

// 3. Helper function to upload buffer stream to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', folder: 'nexus_client_assets' }, // 'auto' allows PDFs, Images, etc.
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

const saveAsset = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { clientId, fileName } = req.body;

    // 4. Send to Cloudinary
    const cloudRes = await uploadToCloudinary(req.file.buffer);

    // 5. Save the secure Cloudinary URL to Firestore
    const newAsset = {
      clientId,
      name: fileName || req.file.originalname,
      url: cloudRes.secure_url,
      type: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    const docRef = await db.collection('assets').add(newAsset);
    res.status(201).json({ id: docRef.id, ...newAsset });

  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
};

const getAssets = async (req, res) => {
  try {
    const snapshot = await db.collection('assets').get();
    let assets = [];
    snapshot.forEach(doc => assets.push({ id: doc.id, ...doc.data() }));
    res.status(200).json(assets);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
};

module.exports = { saveAsset, getAssets, upload };