const db = require('../config/db');

// @route   PUT /api/service-requests/:id/approve
const approveServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const requestRef = db.collection('serviceRequests').doc(id);
    const requestDoc = await requestRef.get();
    const requestData = requestDoc.data();
    
    // 1. Update the status to 'approved'
    await requestRef.update({
      status: 'approved',
      approvedAt: new Date().toISOString()
    });
    
    // 2. Automatically upgrade the Client's official Tier in the database
    if (requestData && requestData.clientId) {
      const clientsRef = db.collection('clients');
      const snapshot = await clientsRef.where('uid', '==', requestData.clientId).get();
      if (!snapshot.empty) {
        const clientDoc = snapshot.docs[0];
        await clientDoc.ref.update({ 
          plan: requestData.requirements?.selectedTier || "GROWTH",
          status: 'active'
        });
      }
    }

    res.status(200).json({ message: 'AI Agent Deployed & Tier Upgraded Successfully', id });
  } catch (error) {
    console.error("Error approving service request:", error);
    res.status(500).json({ error: error.message });
  }
};

// @route   PUT /api/service-requests/:id/reject
const rejectServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;
    
    await db.collection('serviceRequests').doc(id).update({
      status: 'needs_clarification',
      adminFeedback: feedback,
      rejectedAt: new Date().toISOString()
    });

    res.status(200).json({ message: 'Request sent back to client for clarification' });
  } catch (error) {
    console.error("Error rejecting service request:", error);
    res.status(500).json({ error: error.message });
  }
};

const createServiceRequest = async (req, res) => {
  try {
    const newRequest = {
      ...req.body,
      status: req.body.status || 'pending_admin_review',
      createdAt: new Date().toISOString()
    };
    
    const docRef = await db.collection('serviceRequests').add(newRequest);
    res.status(201).json({ id: docRef.id, ...newRequest });
  } catch (error) {
    console.error("Error creating service request:", error);
    res.status(500).json({ error: error.message });
  }
};

const getServiceRequests = async (req, res) => {
  try {
    const requestsRef = db.collection('serviceRequests');
    const snapshot = await requestsRef.orderBy('createdAt', 'desc').get();
    
    if (snapshot.empty) return res.status(200).json([]);

    const requests = [];
    snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching service requests:", error);
    res.status(500).json({ error: error.message });
  }
};

const updateServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const requestRef = db.collection('serviceRequests').doc(id);
    await requestRef.update(updates);
    res.status(200).json({ message: 'Service request updated successfully', id, ...updates });
  } catch (error) {
    console.error("Error updating service request:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createServiceRequest, getServiceRequests, updateServiceRequest, approveServiceRequest, rejectServiceRequest };