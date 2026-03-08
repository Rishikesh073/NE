const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const verifyToken = require('../middleware/authMiddleware'); // <-- THE BOUNCER
const { syncWithAdNetworks } = require('../services/adNetworkSync');
// Import Controllers

const { getCampaigns, createCampaign } = require('../controllers/campaignController');
const { getClients, createClient, updateClientProfile } = require('../controllers/clientController'); // Added updateClientProfile
const { getTasks, createTask, updateTask } = require('../controllers/taskController');
const { getMessages, createMessage } = require('../controllers/messageController');

const {
  createServiceRequest,
  getServiceRequests,
  updateServiceRequest,
  approveServiceRequest,
  rejectServiceRequest // Added reject function
} = require('../controllers/serviceRequestController');

const { saveAsset, getAssets, upload } = require('../controllers/assetController');
const { generateContent } = require('../controllers/aiController');
const { createCheckoutSession, handleStripeWebhook } = require('../controllers/stripeController');

// --- RATE LIMITER ---
// Prevents DDoS attacks and spam bot submissions
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests from this IP, please try again later.' }
});

// --- ROUTES ---
// Campaigns
router.get('/campaigns', verifyToken, getCampaigns);
router.post('/campaigns', verifyToken, createCampaign);


// Clients
router.get('/clients', verifyToken, getClients);
router.post('/clients', verifyToken, createClient);
router.put('/clients/:uid', verifyToken, updateClientProfile); // <-- NEW: Save Profile Data

// Tasks
router.get('/tasks', verifyToken, getTasks);
router.post('/tasks', verifyToken, createTask);
router.put('/tasks/:id', verifyToken, updateTask);

// Messages
router.get('/messages', verifyToken, getMessages);
router.post('/messages', verifyToken, createMessage);

// Service Requests (AI Intake)
router.get('/service-requests', verifyToken, getServiceRequests);
router.post('/service-requests', verifyToken, createServiceRequest);
router.put('/service-requests/:id', verifyToken, updateServiceRequest);
router.put('/service-requests/:id/approve', verifyToken, approveServiceRequest);
router.put('/service-requests/:id/reject', verifyToken, rejectServiceRequest); // <-- NEW: Admin Reject

// Billing & Subscriptions
router.post('/checkout/create-session', verifyToken, createCheckoutSession);
// Note: Webhook must use express.raw({type: 'application/json'}) so it's usually defined directly in server.js before body parsers, but here it is for structure.

// NEW: Assets Routes
router.post('/ai/generate', verifyToken, generateContent);
router.get('/assets', verifyToken, getAssets);
router.post('/assets', verifyToken, upload, saveAsset);
router.delete('/assets/:id', verifyToken, async (req, res) => {
  try {
    const db = require('../config/db');
    await db.collection('assets').doc(req.params.id).delete();
    res.status(200).json({ message: "Asset deleted" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/campaigns/sync', verifyToken, async (req, res) => {
  try {
    await syncWithAdNetworks();
    res.status(200).json({ message: "Ad Networks Synced Successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;