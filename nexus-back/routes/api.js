const express = require('express');
const router = express.Router();

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

// --- ROUTES ---

// Campaigns
router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);

// Clients
router.get('/clients', getClients);
router.post('/clients', createClient);
router.put('/clients/:uid', updateClientProfile); // <-- NEW: Save Profile Data

// Tasks
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);

// Messages
router.get('/messages', getMessages);
router.post('/messages', createMessage);

// Service Requests (AI Intake)
router.get('/service-requests', getServiceRequests);
router.post('/service-requests', createServiceRequest);
router.put('/service-requests/:id', updateServiceRequest);
router.put('/service-requests/:id/approve', approveServiceRequest);
router.put('/service-requests/:id/reject', rejectServiceRequest); // <-- NEW: Admin Reject

// NEW: Assets Routes
router.get('/assets', getAssets);
router.post('/assets', upload, saveAsset);

module.exports = router;