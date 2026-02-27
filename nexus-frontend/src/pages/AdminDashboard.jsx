import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import Lottie from "lottie-react";
import { io } from "socket.io-client";

// ─── Lottie placeholder JSON URLs ─────────────────────────────────────────────
// We fetch these from a public CDN so they work out-of-the-box
const emptyAnimation = {
  v: "5.5.7", fr: 30, ip: 0, op: 90, w: 200, h: 200, nm: "empty",
  layers: [{
    ind: 1, ty: 4, nm: "circle", ks: {
      o: { a: 0, k: 80 }, r: { a: 0, k: 0 },
      p: { a: 1, k: [{ i: { x: .5, y: 1 }, o: { x: .5, y: 0 }, t: 0, s: [100, 110, 0] }, { t: 90, s: [100, 90, 0] }] },
      a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] }
    },
    shapes: [{
      ty: "gr", it: [
        { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [80, 80] } },
        { ty: "st", c: { a: 0, k: [1, 0.33, 0, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 3 }, lc: 2, lj: 2 },
        { ty: "fl", c: { a: 0, k: [1, 0.33, 0, 0.12] }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
      ]
    }]
  }]
};

// ─── Reusable Premium Empty State ─────────────────────────────────────────────
function PremiumEmpty({ title, subtitle, ctaLabel, onCta }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "16px" }}>
      <div style={{ width: "120px", height: "120px" }}>
        <Lottie animationData={emptyAnimation} loop />
      </div>
      <h4 style={{ fontFamily: "'Bebas Neue'", fontSize: "22px", color: "var(--text-dimmer)", letterSpacing: "0.08em", margin: 0 }}>{title}</h4>
      {subtitle && <p style={{ fontSize: "13px", color: "var(--text-dimmer)", maxWidth: "340px", textAlign: "center", margin: 0 }}>{subtitle}</p>}
      {ctaLabel && (
        <button onClick={onCta} className="btn-primary" style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "13px", marginTop: "8px" }}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ─── Tab animation variants ────────────────────────────────────────────────────
const tabVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } }
};

// ─── Modal animation variants ─────────────────────────────────────────────────
const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } }
};
const modalVariants = {
  initial: { opacity: 0, scale: 0.92, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 28 } },
  exit: { opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.15 } }
};

// ─── Custom Recharts Tooltip ──────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, prefix = "" }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", padding: "10px 14px", fontSize: "13px" }}>
        <div style={{ color: "#888", marginBottom: "4px" }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontWeight: 700 }}>{prefix}{p.value.toLocaleString()}</div>
        ))}
      </div>
    );
  }
  return null;
};

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // LIVE DATA STATES
  const [adminUser] = useState({ name: "Admin", initials: "AD" });
  const [campaigns, setCampaigns] = useState([]);
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  // POPUP MODAL STATES
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminFeedback, setAdminFeedback] = useState("");
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", clientId: "", channel: "Google Ads", spend: 0, leads: 0, status: "live" });

  // NEW ADMIN FEATURE STATES
  const [newTask, setNewTask] = useState({ title: "", clientId: "", status: "todo" });
  const [selectedChatClient, setSelectedChatClient] = useState(null);
  const [chatMsg, setChatMsg] = useState("");

  // SOCKET REF
  const socketRef = useRef(null);

  // ─── SOCKET.IO SETUP ────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    // Admin joins its own admin room
    socket.emit("join_room", "admin_room");

    // Listen for messages that come in from any client room
    socket.on("receive_message", (msgData) => {
      setMessages(prev => {
        // Avoid duplicates if admin is the sender (already added optimistically)
        const exists = prev.some(m => m.time === msgData.time && m.msg === msgData.msg && m.from === msgData.from);
        return exists ? prev : [...prev, msgData];
      });
    });

    // Listen for newly assigned tasks echoing back
    socket.on("new_task_assigned", (taskData) => {
      setTasks(prev => {
        const exists = prev.some(t => t.id === taskData.id);
        return exists ? prev : [...prev, taskData];
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setNetworkError(false); // Reset before each fetch attempt
      try {
        // Wait for Firebase auth to be ready before making API calls
        await new Promise((resolve) => {
          const unsubscribe = import('../services/firebase').then(({ auth }) => {
            if (auth.currentUser) { resolve(); return () => { }; }
            const unsub = auth.onAuthStateChanged(user => { if (user) { unsub(); resolve(); } });
            return unsub;
          });
          // Fallback timeout so we don't wait forever
          setTimeout(resolve, 3000);
        });

        const safeGet = (url) => api.get(url).catch(err => {
          // Only flag as network error for server/network issues, not auth errors
          if (!err.response || err.response.status >= 500 || err.code === 'ERR_NETWORK') {
            console.error(`Network error fetching ${url}:`, err);
            setNetworkError(true);
          } else {
            console.warn(`Non-critical error fetching ${url}:`, err.response?.status);
          }
          return { data: [] };
        });

        const [campRes, clientRes, taskRes, msgRes, reqRes, assetRes] = await Promise.all([
          safeGet('/campaigns'),
          safeGet('/clients'),
          safeGet('/tasks'),
          safeGet('/messages'),
          safeGet('/service-requests'),
          safeGet('/assets')
        ]);

        setCampaigns(campRes.data);
        setClients(clientRes.data);
        setTasks(taskRes.data);
        setMessages(msgRes.data);
        setServiceRequests(reqRes.data || []);
        setAssets(assetRes.data || []);
      } catch (error) {
        console.error("Critical error fetching admin data:", error);
        setNetworkError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleApprove = async (request) => {
    try {
      await api.put(`/service-requests/${request.id}/approve`);
      setServiceRequests(prev => prev.map(req => req.id === request.id ? { ...req, status: 'approved' } : req));
      setClients(prev => prev.map(c => c.uid === request.clientId ? { ...c, plan: request.requirements.selectedTier } : c));
      setSelectedRequest(null);
      toast.success(`AI Agent deployed! Client upgraded to ${request.requirements.selectedTier} Tier.`);
    } catch (error) {
      toast.error("Error approving request. Check console.");
    }
  };

  const handleReject = async (request) => {
    if (!adminFeedback) return toast.error("Please type feedback explaining what needs clarification.");
    try {
      await api.put(`/service-requests/${request.id}/reject`, { feedback: adminFeedback });
      setServiceRequests(prev => prev.map(req => req.id === request.id ? { ...req, status: 'needs_clarification' } : req));
      setSelectedRequest(null);
      setAdminFeedback("");
      toast.success("Brief bounced back to client for clarification.");
    } catch (error) {
      toast.error("Error rejecting request.");
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/campaigns', { ...newCampaign, createdAt: new Date().toISOString() });
      setCampaigns([...campaigns, { id: res.data.id, ...newCampaign }]);
      setShowCampaignModal(false);
      setNewCampaign({ name: "", clientId: "", channel: "Google Ads", spend: 0, leads: 0, status: "live" });
      toast.success("Campaign successfully deployed!");
    } catch (error) { toast.error("Failed to create campaign."); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/tasks', newTask);
      const createdTask = { id: res.data.id, ...newTask };
      setTasks([...tasks, createdTask]);
      // ─── Emit via socket so client sees it instantly ───────────────────────
      socketRef.current?.emit("assign_task", createdTask);
      setNewTask({ title: "", clientId: "", status: "todo" });
      toast.success("Task Assigned to Client!");
    } catch (err) { toast.error("Failed to assign task."); }
  };

  const handleSendReply = async () => {
    if (!chatMsg.trim() || !selectedChatClient) return;
    const newMsg = {
      clientId: selectedChatClient.uid,
      from: "Admin", to: selectedChatClient.uid,
      msg: chatMsg, type: "admin",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    // Optimistic update
    setMessages([...messages, newMsg]);
    setChatMsg("");
    // ─── Emit via socket so client sees it instantly ───────────────────────
    socketRef.current?.emit("send_message", newMsg);
    try { await api.post('/messages', newMsg); } catch (e) { }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/admin-login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const handleForceSync = async () => {
    const toastId = toast.loading("Pinging Meta & Google APIs...");
    try {
      await api.post('/campaigns/sync');
      const campRes = await api.get('/campaigns');
      setCampaigns(campRes.data);
      toast.success("Ad Networks Synced!", { id: toastId });
    } catch (error) {
      toast.error("Failed to sync networks.", { id: toastId });
    }
  };

  const totalMRR = clients.reduce((a, c) => a + (Number(c.mrr) || 0), 0);
  const totalLeads = campaigns.reduce((a, c) => a + (Number(c.leads) || 0), 0);
  const totalSpend = campaigns.reduce((a, c) => a + (Number(c.spend) || 0), 0);

  // ─── Recharts chart data ───────────────────────────────────────────────────
  // Revenue area-chart: use clients as monthly MRR data points
  const mrrChartData = clients.map(c => ({ name: c.name?.split(" ")[0] || "Client", mrr: Number(c.mrr) || 0 }));
  // Leads bar-chart: use real campaigns
  const leadsChartData = campaigns.map(c => ({ name: c.name?.substring(0, 10) || "Camp", leads: Number(c.leads) || 0, spend: Number(c.spend) || 0 }));

  const sidebarItems = [
    { id: "overview", icon: "⊡", label: "Overview" },
    { id: "requests", icon: "⚡", label: "AI Briefs", badge: serviceRequests.filter(r => r.status === 'pending_admin_review').length || null },
    { id: "clients", icon: "◉", label: "Clients", badge: clients.length || null },
    { id: "campaigns", icon: "▲", label: "Campaigns" },
    { id: "assets", icon: "📁", label: "Client Assets" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    { id: "tasks", icon: "☑", label: "Task Board" },
    { id: "messages", icon: "✉", label: "Direct Inbox" },
  ];

  // --- SKELETON UI LOADER ---
  if (loading) return (
    <div style={{ height: "100vh", display: "flex", background: "var(--black)", padding: "32px", gap: "32px" }}>
      <style>{`@keyframes pulse { 0% { opacity: 0.8; } 50% { opacity: 0.3; } 100% { opacity: 0.8; } } .sk-pulse { animation: pulse 1.5s infinite; background: var(--black2); border-radius: 12px; }`}</style>
      <div className="sk-pulse" style={{ width: "240px", height: "100%" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
        <div className="sk-pulse" style={{ width: "30%", height: "40px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <div className="sk-pulse" style={{ height: "120px" }} /><div className="sk-pulse" style={{ height: "120px" }} /><div className="sk-pulse" style={{ height: "120px" }} /><div className="sk-pulse" style={{ height: "120px" }} />
        </div>
        <div className="sk-pulse" style={{ flex: 1 }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* GLOBAL TOAST COMPONENT */}
      <Toaster position="top-right" toastOptions={{ style: { background: '#222', color: '#fff', border: '1px solid #444' } }} />

      {/* Sidebar */}
      <div style={{ width: "250px", flexShrink: 0, background: "var(--black2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "20px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", marginBottom: "8px" }}>
          <div style={{ width: "32px", height: "32px", background: "var(--orange)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: "18px", boxShadow: "0 0 20px rgba(255,85,0,0.4)" }}>N</div>
          <div>
            <span style={{ fontFamily: "'Bebas Neue'", fontSize: "20px", letterSpacing: "0.1em", display: "block" }}>NEXUS</span>
            <span style={{ fontSize: "10px", color: "var(--orange)", fontFamily: "'JetBrains Mono'", letterSpacing: "0.1em" }}>ADMIN CONTROL</span>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "16px" }}>
          {sidebarItems.map(item => (
            <div key={item.id} className={`sidebar-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
              <span style={{ fontSize: "16px" }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <span style={{ marginLeft: "auto", background: activeTab === item.id ? "var(--orange)" : "var(--border)", color: activeTab === item.id ? "white" : "var(--text-dimmer)", borderRadius: "10px", padding: "1px 8px", fontSize: "11px", fontWeight: 700 }}>{item.badge}</span>}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <button className="btn-ghost" onClick={() => navigate("/")} style={{ width: "100%", padding: "10px", borderRadius: "8px", fontSize: "12px", marginBottom: "8px" }}>← Back to Site</button>
          <button className="btn-ghost" onClick={handleLogout} style={{ width: "100%", padding: "10px", borderRadius: "8px", fontSize: "12px", color: "var(--neon-pink)", borderColor: "rgba(255,0,110,0.3)" }}>LOG OUT</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: "auto", background: "var(--black)", position: "relative" }}>

        {networkError && (
          <div style={{ background: "rgba(255,0,110,0.1)", color: "var(--neon-pink)", padding: "12px 32px", fontSize: "13px", borderBottom: "1px solid rgba(255,0,110,0.3)" }}>
            ⚠️ <strong>Backend Connection Failed:</strong> Ensure your Express server is running.
          </div>
        )}

        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(8,8,8,0.9)", backdropFilter: "blur(20px)", zIndex: 100 }}>
          <div><h1 style={{ fontSize: "24px", fontWeight: 700 }}>{sidebarItems.find(s => s.id === activeTab)?.label}</h1></div>
          <button className="btn-primary" onClick={() => setShowCampaignModal(true)} style={{ padding: "10px 20px", borderRadius: "8px", fontSize: "13px" }}>+ DEPLOY CAMPAIGN</button>
        </div>

        <div style={{ padding: "32px" }}>

          {/* ─── ANIMATED TAB CONTENT ─────────────────────────────────────── */}
          <AnimatePresence mode="wait">

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <motion.div key="overview" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {[
                  { label: "Monthly Revenue", value: `$${totalMRR.toLocaleString()}`, color: "var(--neon-green)", icon: "◈" },
                  { label: "Total Clients", value: clients.length, color: "var(--neon-blue)", icon: "◉" },
                  { label: "Ad Spend Managed", value: `$${totalSpend.toLocaleString()}`, color: "var(--orange)", icon: "⚡" },
                  { label: "Total Leads", value: totalLeads.toLocaleString(), color: "var(--neon-pink)", icon: "★" },
                ].map((kpi, i) => (
                  <div key={i} className="card-hover" style={{ padding: "24px", borderRadius: "16px", background: "var(--card)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono'" }}>{kpi.label}</span>
                      <span style={{ color: kpi.color, fontSize: "18px" }}>{kpi.icon}</span>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: "40px", color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* AI REQUESTS TAB */}
            {activeTab === "requests" && (
              <motion.div key="requests" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                className="card-hover" style={{ borderRadius: "16px", background: "var(--card)", overflow: "hidden" }}>
                <div style={{ padding: "24px 24px 0" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "20px" }}>Pending AI Strategies</h3>
                </div>
                {serviceRequests.filter(r => r.status === 'pending_admin_review').length === 0 ? (
                  <PremiumEmpty title="NO BRIEFS PENDING" subtitle="All client AI strategy briefs have been reviewed." />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Client Name</th>
                        <th>Primary Goal</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceRequests.filter(r => r.status === 'pending_admin_review').map(req => (
                        <tr key={req.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: "14px" }}>{req.clientName || 'N/A'}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>{req.clientEmail || 'N/A'}</div>
                          </td>
                          <td><span style={{ fontSize: "13px", color: "var(--neon-blue)" }}>{req.requirements?.primaryGoal}</span></td>
                          <td><span className={`tag status-draft`}>PENDING REVIEW</span></td>
                          <td>
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="btn-ghost"
                              style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "11px", border: "1px solid var(--border)" }}>
                              VIEW BRIEF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}

            {/* CLIENTS TAB */}
            {activeTab === "clients" && (
              <motion.div key="clients" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                className="card-hover" style={{ borderRadius: "16px", background: "var(--card)", overflow: "hidden" }}>
                {clients.length === 0 ? (
                  <PremiumEmpty title="NO CLIENTS YET" subtitle="Clients will appear here once they register on the platform." />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Client Name</th>
                        <th>Email Address</th>
                        <th>Plan / MRR</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => (
                        <tr key={c.id}>
                          <td><div style={{ fontWeight: 600, fontSize: "14px" }}>{c.name || "N/A"}</div></td>
                          <td><div style={{ fontSize: "13px", color: "var(--text-dim)" }}>{c.email}</div></td>
                          <td>
                            <div style={{ fontSize: "11px", color: "var(--orange)", textTransform: "uppercase", fontWeight: 700 }}>{c.plan || "Pending"}</div>
                            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "13px", color: "var(--neon-green)" }}>${(c.mrr || 0).toLocaleString()}</span>
                          </td>
                          <td>
                            <button className="btn-ghost" style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "11px", border: "1px solid var(--border)" }}>EDIT</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}

            {/* CAMPAIGNS TAB */}
            {activeTab === "campaigns" && (
              <motion.div key="campaigns" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                className="card-hover" style={{ borderRadius: "16px", background: "var(--card)", overflow: "hidden" }}>
                <div style={{ padding: "24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "16px" }}>Live Ad Network Feeds</h3>
                  <button onClick={handleForceSync} className="btn-ghost" style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "12px", border: "1px solid var(--neon-blue)", color: "var(--neon-blue)", display: "flex", gap: "8px", alignItems: "center" }}>
                    <span>🔄</span> FORCE API SYNC
                  </button>
                </div>
                {campaigns.length === 0 ? (
                  <PremiumEmpty
                    title="NO CAMPAIGNS DEPLOYED"
                    subtitle="Deploy your first AI campaign to start tracking performance metrics."
                    ctaLabel="+ DEPLOY CAMPAIGN"
                    onCta={() => setShowCampaignModal(true)}
                  />
                ) : (
                  <table>
                    <thead>
                      <tr><th>Campaign Name</th><th>Client ID</th><th>Status</th><th>Spend</th><th>Leads</th></tr>
                    </thead>
                    <tbody>
                      {campaigns.map(c => (
                        <tr key={c.id}>
                          <td><span style={{ fontWeight: 600 }}>{c.name}</span></td>
                          <td style={{ color: "var(--text-dim)", fontSize: "12px" }}>{c.clientId.substring(0, 8)}...</td>
                          <td><span className={`tag status-${c.status || 'draft'}`}>{(c.status || 'live').toUpperCase()}</span></td>
                          <td><span style={{ color: "var(--orange)", fontFamily: "'JetBrains Mono'" }}>${c.spend}</span></td>
                          <td><span style={{ color: "var(--neon-green)", fontFamily: "'JetBrains Mono'" }}>{c.leads}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}

            {/* ASSETS TAB */}
            {activeTab === "assets" && (
              <motion.div key="assets" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                className="card-hover" style={{ borderRadius: "16px", background: "var(--card)", overflow: "hidden" }}>
                {assets.length === 0 ? (
                  <PremiumEmpty
                    title="NO ASSETS UPLOADED"
                    subtitle="Client brand assets will appear here once they upload files from their dashboard."
                  />
                ) : (
                  <table>
                    <thead><tr><th>Client Name</th><th>File Name</th><th>Action</th></tr></thead>
                    <tbody>
                      {assets.map(a => {
                        const owner = clients.find(c => c.uid === a.clientId);
                        return (
                          <tr key={a.id}>
                            <td>
                              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--orange)" }}>{owner ? owner.name : "Unknown Client"}</div>
                              <div style={{ fontSize: "10px", color: "var(--text-dimmer)" }}>ID: {a.clientId.substring(0, 8)}...</div>
                            </td>
                            <td style={{ fontWeight: 600 }}>{a.name}</td>
                            <td><a href={a.url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "11px", textDecoration: "none" }}>DOWNLOAD</a></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}

            {/* TASKS TAB */}
            {activeTab === "tasks" && (
              <motion.div key="tasks" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
                <div className="card-hover" style={{ flex: 1, padding: "24px", borderRadius: "16px", background: "var(--card)" }}>
                  <h3 style={{ fontWeight: 700, marginBottom: "16px" }}>Assign New Task</h3>
                  <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <select required value={newTask.clientId} onChange={e => setNewTask({ ...newTask, clientId: e.target.value })} style={{ padding: "10px", borderRadius: "8px", background: "var(--black)", color: "white", border: "1px solid var(--border)" }}>
                      <option value="">Select Target Client...</option>
                      {clients.map(c => <option key={c.uid} value={c.uid}>{c.name}</option>)}
                    </select>
                    <input required placeholder="Task Title (e.g. Connect Meta Pixel)" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} style={{ padding: "10px", borderRadius: "8px", background: "var(--black)", color: "white", border: "1px solid var(--border)" }} />
                    <button type="submit" className="btn-primary" style={{ padding: "10px", borderRadius: "8px" }}>ASSIGN TASK</button>
                  </form>
                </div>

                <div style={{ flex: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {["todo", "progress", "done"].map(status => (
                    <div key={status} style={{ padding: "20px", borderRadius: "16px", background: "var(--card)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dimmer)" }}>{status}</span>
                      </div>
                      {tasks.filter(t => t.status === status).map((task, i) => (
                        <div key={i} style={{ padding: "16px", borderRadius: "10px", background: "var(--black3)", border: "1px solid var(--border)", marginBottom: "10px" }}>
                          <div style={{ fontSize: "13px", fontWeight: 600 }}>{task.title}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-dimmer)", marginTop: "4px" }}>Client ID: {task.clientId || "N/A"}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* MESSAGES TAB */}
            {activeTab === "messages" && (
              <motion.div key="messages" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                className="card-hover" style={{ borderRadius: "16px", background: "var(--card)", display: "flex", height: "calc(100vh - 200px)", overflow: "hidden" }}>
                <div style={{ width: "300px", borderRight: "1px solid var(--border)", background: "var(--black2)", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "20px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "14px" }}>ACTIVE CHATS</div>
                  <div style={{ overflowY: "auto" }}>
                    {clients.map(client => (
                      <div key={client.uid} onClick={() => setSelectedChatClient(client)} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: selectedChatClient?.uid === client.uid ? "var(--black)" : "transparent", borderLeft: selectedChatClient?.uid === client.uid ? "4px solid var(--orange)" : "4px solid transparent" }}>
                        <div style={{ fontWeight: 600, fontSize: "13px" }}>{client.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-dimmer)" }}>ID: {client.uid.substring(0, 8)}...</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--black)" }}>
                  {!selectedChatClient ? (
                    <div style={{ margin: "auto", color: "var(--text-dimmer)" }}>Select a client from the left to open a secure channel.</div>
                  ) : (
                    <>
                      <div style={{ padding: "20px", borderBottom: "1px solid var(--border)", fontWeight: 700, display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "8px", height: "8px", background: "var(--neon-green)", borderRadius: "50%" }}></div>
                        Encrypted Channel: {selectedChatClient.name}
                      </div>

                      <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                        {messages.filter(m => m.clientId === selectedChatClient.uid || m.to === selectedChatClient.uid).map((m, i) => (
                          <div key={i} style={{ display: "flex", flexDirection: m.from === "Admin" ? "row-reverse" : "row", gap: "12px" }}>
                            <div style={{ padding: "12px 16px", borderRadius: "8px", background: m.from === "Admin" ? "var(--orange)" : "var(--black3)", fontSize: "14px" }}>
                              <div style={{ fontSize: "10px", opacity: 0.7, marginBottom: "4px" }}>{m.from}</div>
                              {m.msg}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", background: "var(--black2)" }}>
                        <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendReply()} placeholder={`Message ${selectedChatClient.name}...`} style={{ flex: 1, padding: "12px", borderRadius: "8px", background: "var(--black)", color: "white", border: "1px solid var(--border)" }} />
                        <button className="btn-primary" onClick={handleSendReply} style={{ padding: "12px 24px", borderRadius: "8px" }}>SEND DIRECT</button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ANALYTICS TAB — RECHARTS ──────────────────────────────────────── */}
            {activeTab === "analytics" && (
              <motion.div key="analytics" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

                {/* MRR Area Chart */}
                <div className="card-hover" style={{ padding: "24px", borderRadius: "16px", background: "var(--card)" }}>
                  <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: 700 }}>Revenue Overview (MRR)</h3>
                  {mrrChartData.length === 0 ? (
                    <PremiumEmpty title="NO DATA YET" subtitle="MRR data will appear as clients are added." />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={mrrChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ff94" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#00ff94" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                        <Tooltip content={<CustomTooltip prefix="$" />} />
                        <Area type="monotone" dataKey="mrr" stroke="#00ff94" strokeWidth={2} fill="url(#mrrGrad)" dot={{ fill: "#00ff94", r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Leads Bar Chart */}
                <div className="card-hover" style={{ padding: "24px", borderRadius: "16px", background: "var(--card)" }}>
                  <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: 700 }}>Global Lead Generation</h3>
                  {leadsChartData.length === 0 ? (
                    <PremiumEmpty title="NO CAMPAIGNS" subtitle="Deploy campaigns to see lead analytics here." />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={leadsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF5500" stopOpacity={1} />
                            <stop offset="100%" stopColor="#FF5500" stopOpacity={0.5} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="leads" fill="url(#leadsGrad)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
          {/* ─── END ANIMATED TAB CONTENT ─────────────────────────────────── */}

        </div>

        {/* ─── CAMPAIGN CREATION MODAL ───────────────────────────────────── */}
        <AnimatePresence>
          {showCampaignModal && (
            <motion.div key="camp-modal-backdrop" variants={backdropVariants} initial="initial" animate="animate" exit="exit"
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <motion.div key="camp-modal" variants={modalVariants} initial="initial" animate="animate" exit="exit"
                className="card-hover" style={{ background: "var(--black2)", padding: "40px", borderRadius: "16px", maxWidth: "500px", width: "100%", position: "relative", border: "1px solid var(--border)" }}>
                <button onClick={() => setShowCampaignModal(false)} style={{ position: "absolute", top: "20px", right: "24px", background: "none", border: "none", color: "var(--text-dimmer)", fontSize: "24px", cursor: "pointer" }}>×</button>
                <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: "28px", color: "var(--neon-blue)", marginBottom: "24px" }}>DEPLOY AI CAMPAIGN</h2>

                <form onSubmit={handleCreateCampaign} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Target Client</label>
                    <select required value={newCampaign.clientId} onChange={e => setNewCampaign({ ...newCampaign, clientId: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--black)", color: "white", border: "1px solid var(--border)" }}>
                      <option value="">Select a Client...</option>
                      {clients.map(c => <option key={c.id} value={c.uid}>{c.name} ({c.email})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Campaign Name</label>
                    <input required type="text" placeholder="e.g., Q3 Retargeting" value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--black)", color: "white", border: "1px solid var(--border)" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Current Spend</label>
                      <input type="number" required value={newCampaign.spend} onChange={e => setNewCampaign({ ...newCampaign, spend: Number(e.target.value) })} style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--black)", color: "white", border: "1px solid var(--border)" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Leads Generated</label>
                      <input type="number" required value={newCampaign.leads} onChange={e => setNewCampaign({ ...newCampaign, leads: Number(e.target.value) })} style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--black)", color: "white", border: "1px solid var(--border)" }} />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" style={{ padding: "14px", borderRadius: "8px", marginTop: "12px" }}>INJECT CAMPAIGN TO CLIENT</button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── AI BRIEF POPUP MODAL ──────────────────────────────────────── */}
        <AnimatePresence>
          {selectedRequest && (
            <motion.div key="brief-backdrop" variants={backdropVariants} initial="initial" animate="animate" exit="exit"
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <motion.div key="brief-modal" variants={modalVariants} initial="initial" animate="animate" exit="exit"
                className="card-hover" style={{ background: "var(--black2)", padding: "40px", borderRadius: "16px", maxWidth: "800px", width: "100%", position: "relative", border: "1px solid rgba(255,85,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}>
                <button onClick={() => setSelectedRequest(null)} style={{ position: "absolute", top: "20px", right: "24px", background: "transparent", border: "none", color: "var(--text-dimmer)", fontSize: "24px", cursor: "pointer" }}>×</button>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                  <div style={{ width: "40px", height: "40px", background: "var(--orange)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: "20px" }}>⚡</div>
                  <div>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: "28px", color: "var(--orange)", lineHeight: 1 }}>CLIENT AI BRIEF</h2>
                    <div style={{ fontSize: "12px", color: "var(--text-dimmer)" }}>{selectedRequest.clientName} • <strong style={{ color: "white" }}>{selectedRequest.requirements?.selectedTier} TIER</strong></div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "32px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Business Domain</label>
                      <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>{selectedRequest.requirements?.businessDomain}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Business Type</label>
                      <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>{selectedRequest.requirements?.businessType}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Primary Goal</label>
                      <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>{selectedRequest.requirements?.primaryGoal}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Monthly Budget</label>
                      <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>${selectedRequest.requirements?.monthlyBudget}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Target Geography</label>
                      <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>{selectedRequest.requirements?.geography}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Requested Channels</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {selectedRequest.requirements?.channels?.map(channel => (
                          <span key={channel} style={{ padding: "4px 8px", background: "var(--black)", border: "1px solid var(--orange)", color: "var(--orange)", borderRadius: "12px", fontSize: "10px", fontWeight: 700 }}>{channel}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Target Audience</label>
                    <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>{selectedRequest.requirements?.targetAudience}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Unique Selling Proposition (USP)</label>
                    <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>{selectedRequest.requirements?.usp}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Competitors</label>
                      <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>{selectedRequest.requirements?.competitors || "None listed"}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Offers / Magnets</label>
                      <div style={{ padding: "12px", background: "var(--black3)", borderRadius: "8px", fontSize: "13px", border: "1px solid var(--border)" }}>{selectedRequest.requirements?.offers || "None listed"}</div>
                    </div>
                  </div>
                </div>

                {/* REJECTION FEEDBACK INPUT */}
                <div style={{ marginBottom: "24px" }}>
                  <input
                    placeholder="If rejecting, type feedback here..."
                    value={adminFeedback}
                    onChange={(e) => setAdminFeedback(e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "var(--black)", border: "1px dashed var(--neon-pink)", color: "white", fontSize: "13px" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button className="btn-ghost" onClick={() => handleReject(selectedRequest)} style={{ flex: 1, padding: "16px", borderRadius: "8px", fontSize: "13px", color: "var(--neon-pink)", borderColor: "rgba(255,0,110,0.3)" }}>
                    REQUEST CLARIFICATION
                  </button>
                  <button className="btn-primary" onClick={() => handleApprove(selectedRequest)} style={{ flex: 2, padding: "16px", borderRadius: "8px", fontSize: "15px" }}>
                    APPROVE & UPGRADE TIER
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}