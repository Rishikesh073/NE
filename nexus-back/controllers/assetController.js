const db = require('../config/db');

const saveAsset = async (req, res) => {
  try {
    const docRef = await db.collection('assets').add({ ...req.body, uploadedAt: new Date().toISOString() });
    res.status(201).json({ id: docRef.id, ...req.body });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getAssets = async (req, res) => {
  try {
    const snapshot = await db.collection('assets').get();
    let assets = [];
    snapshot.forEach(doc => assets.push({ id: doc.id, ...doc.data() }));
    res.status(200).json(assets);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = { saveAsset, getAssets };