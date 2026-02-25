import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import Lottie from "lottie-react";
import { io } from "socket.io-client";
import { auth } from "../services/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from "firebase/auth";

// ─── Inline Lottie animation (orange pulsing circle) ──────────────────────────
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

function PremiumEmpty({ title, subtitle, ctaLabel, onCta }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "16px" }}>
      <div style={{ width: "120px", height: "120px" }}><Lottie animationData={emptyAnimation} loop /></div>
      <h4 style={{ fontFamily: "'Bebas Neue'", fontSize: "22px", color: "var(--text-dimmer)", letterSpacing: "0.08em", margin: 0 }}>{title}</h4>
      {subtitle && <p style={{ fontSize: "13px", color: "var(--text-dimmer)", maxWidth: "340px", textAlign: "center", margin: 0 }}>{subtitle}</p>}
      {ctaLabel && <button onClick={onCta} className="btn-primary" style={{ padding: "10px 24px", borderRadius: "8px", fontSize: "13px", marginTop: "8px" }}>{ctaLabel}</button>}
    </div>
  );
}

const tabVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } }
};
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

const CustomTooltip = ({ active, payload, label, prefix = "" }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", padding: "10px 14px", fontSize: "13px" }}>
        <div style={{ color: "#888", marginBottom: "4px" }}>{label}</div>
        {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 700 }}>{prefix}{p.value?.toLocaleString()}</div>)}
      </div>
    );
  }
  return null;
};

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ClientDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // LIVE DATA STATES
  const [clientData, setClientData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatMsg, setChatMsg] = useState("");
  const [myRequests, setMyRequests] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  // CLOUDINARY UPLOAD & ASSET MANAGEMENT STATES
  const [uploadStatus, setUploadStatus] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("ALL");

  // PROFILE STATE
  const [profileForm, setProfileForm] = useState({ companyName: "", contactName: "", email: "", phone: "", industry: "", website: "" });

  // SECURITY STATE
  const [securityForm, setSecurityForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [mfaPhone, setMfaPhone] = useState("");
  const [mfaVerId, setMfaVerId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [isMfaEnrolled, setIsMfaEnrolled] = useState(false);
  const [showMfaInput, setShowMfaInput] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      const enrolled = multiFactor(auth.currentUser).enrolledFactors.length > 0;
      setIsMfaEnrolled(enrolled);
    }
  }, [currentUser]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (securityForm.newPassword !== securityForm.confirmPassword) return alert("New passwords do not match.");
    try {
      const cred = EmailAuthProvider.credential(currentUser.email, securityForm.currentPassword);
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, securityForm.newPassword);
      setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert("Password updated securely.");
    } catch (err) {
      alert("Failed to update password: " + err.message);
    }
  };

  const setupRecaptcha = () => {
    try {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } catch (e) {
      // Ignore if already disconnected
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  };

  const handleEnrollMFA = async () => {
    if (!mfaPhone) return alert("Please enter a valid phone number (+1XXXXXXXXXX).");
    try {
      setupRecaptcha();
      const session = await multiFactor(currentUser).getSession();
      const phoneProvider = new PhoneAuthProvider(auth);
      // Wait for SMS verification
      const verificationId = await phoneProvider.verifyPhoneNumber({ phoneNumber: mfaPhone, session }, window.recaptchaVerifier);
      setMfaVerId(verificationId);
      setShowMfaInput(true);
      alert("Verification code sent to " + mfaPhone);
    } catch (err) {
      console.error("MFA Error:", err);
      // Fallback cleanup if verifyPhoneNumber fails during recaptcha render
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; } catch (e) { }
      }
      alert("Failed to send MFA code: " + err.message + "\n\n(See browser console for details. Note: Identity Platform billing must be enabled in Firebase for SMS/MFA)");
    }
  };

  const confirmEnrollMFA = async () => {
    if (!mfaCode || !mfaVerId) return;
    try {
      const cred = PhoneAuthProvider.credential(mfaVerId, mfaCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      await multiFactor(currentUser).enroll(multiFactorAssertion, "Phone Number");
      setIsMfaEnrolled(true);
      setShowMfaInput(false);
      setMfaPhone("");
      setMfaCode("");
      alert("MFA Successfully Enrolled!");
    } catch (err) {
      alert("Invalid SMS code: " + err.message);
    }
  };

  // AI INTAKE ARRAYS
  const availableDomains = [
    "Technology & SaaS", "E-commerce & Retail", "Healthcare & Medical",
    "Real Estate & Property", "Finance & Insurance", "Education & E-Learning",
    "Home Services & Trades", "Restaurant & Hospitality", "Legal Services",
    "Travel & Tourism", "Manufacturing & Logistics", "Other"
  ];
  const availableTypes = [
    "B2B (Business to Business)", "B2C (Business to Consumer)",
    "D2C (Direct to Consumer)", "E-commerce Store",
    "Local Service Provider", "SaaS / Digital Product", "Agency / Consulting"
  ];

  // INTAKE FORM STATES
  const [showCheckout, setShowCheckout] = useState(false);
  const [intakeData, setIntakeData] = useState({
    selectedTier: "GROWTH",
    businessDomain: "Technology & SaaS",
    businessType: "B2B (Business to Business)",
    businessUrl: "",
    targetAudience: "",
    monthlyBudget: "",
    primaryGoal: "Lead Generation",
    channels: [],
    geography: "",
    usp: "",
    competitors: "",
    offers: ""
  });

  const availableGoals = ["Lead Generation", "Direct E-commerce Sales", "Brand Awareness", "Website Traffic", "App Installs"];
  const availableChannels = ["Google Ads", "Meta (Facebook/Instagram)", "LinkedIn B2B", "SEO", "TikTok"];

  const pricingTiers = [
    { name: "STARTER", price: 199, desc: "Perfect for local businesses.", features: ["1 AI Campaign", "Meta Ads Only"] },
    { name: "GROWTH", price: 299, desc: "For scaling operations.", features: ["3 AI Campaigns", "Meta + Google Ads"] },
    { name: "ENTERPRISE", price: 499, desc: "Full autonomous takeover.", features: ["Unlimited Campaigns", "Omnichannel"] }
  ];
  const tierServices = {
    "STARTER": ["1 Active AI Campaign", "Meta Ads Network Optimization", "Basic Lead Gen Analytics", "Email Support Access"],
    "GROWTH": ["Up to 3 Active AI Campaigns", "Meta + Google Ads Network", "Advanced Lead Analytics Dashboard", "Priority Support Chat"],
    "ENTERPRISE": ["Unlimited AI Campaigns", "Full Omnichannel Deployment", "Custom AI Audience Models", "Dedicated Slack Channel"]
  };

  const labelStyle = { fontSize: "12px", color: "#b0b0b0", textTransform: "uppercase", display: "block", marginBottom: "8px", fontWeight: 700, letterSpacing: "0.05em" };
  const inputStyle = { width: "100%", padding: "14px", borderRadius: "8px", background: "var(--black)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)", fontSize: "15px", fontWeight: 500, outline: "none", fontFamily: "inherit" };

  // SOCKET REF
  const socketRef = useRef(null);

  // ─── SOCKET.IO SETUP ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    // Join this client's own room so admin can target messages to them
    socket.emit("join_room", currentUser.uid);

    // Listen for admin messages arriving in real-time
    socket.on("receive_message", (msgData) => {
      setChatHistory(prev => {
        const exists = prev.some(m => m.time === msgData.time && m.msg === msgData.msg);
        return exists ? prev : [...prev, msgData];
      });
    });

    // Listen for tasks assigned by admin in real-time
    socket.on("new_task_assigned", (taskData) => {
      if (taskData.clientId === currentUser.uid) {
        setTasks(prev => {
          const exists = prev.some(t => t.id === taskData.id);
          return exists ? prev : [...prev, taskData];
        });
      }
    });

    return () => socket.disconnect();
  }, [currentUser]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        const safeGet = (url) => api.get(url).catch(() => ({ data: [] }));
        const [campRes, reqRes, clientsRes, taskRes, msgRes, assetRes] = await Promise.all([
          safeGet('/campaigns'), safeGet('/service-requests'), safeGet('/clients'),
          safeGet('/tasks'), safeGet('/messages'), safeGet('/assets')
        ]);
        setCampaigns(campRes.data.filter(c => c.clientId === currentUser.uid));
        setMyRequests(reqRes.data.filter(r => r.clientId === currentUser.uid));
        setTasks(taskRes.data.filter(t => t.clientId === currentUser.uid));
        setChatHistory(msgRes.data.filter(m => m.clientId === currentUser.uid || m.to === currentUser.uid));
        setMyAssets(assetRes.data.filter(a => a.clientId === currentUser.uid));
        const myProfile = clientsRes.data.find(c => c.uid === currentUser.uid);
        if (myProfile) {
          setClientData(myProfile);
          setProfileForm({
            companyName: myProfile.companyName || currentUser.displayName || "",
            contactName: myProfile.contactName || currentUser.displayName || "",
            email: myProfile.email || currentUser.email || "",
            phone: myProfile.phone || "",
            industry: myProfile.industry || "",
            website: myProfile.website || ""
          });
        }
      } catch (error) {
        console.error("Data error:", error);
      } finally { setLoading(false); }
    };
    fetchData();
  }, [currentUser]);

  const handleSaveProfile = async () => {
    try {
      await api.put(`/clients/${currentUser.uid}`, profileForm);
      setClientData({ ...clientData, ...profileForm });
      alert("Profile updated securely.");
    } catch (err) { alert("Error saving profile. Make sure Express server is running."); }
  };

  const handleProceedToCheckout = (e) => {
    e.preventDefault();
    if (intakeData.channels.length === 0) return alert("Select at least one channel.");
    setShowCheckout(true);
  };

  const processPaymentAndSubmit = async () => {
    try {
      await api.post('/service-requests', {
        clientId: currentUser.uid,
        clientName: profileForm.companyName || currentUser.displayName,
        clientEmail: currentUser.email,
        requirements: intakeData,
        status: "pending_admin_review",
        submittedAt: new Date().toISOString()
      });
      setShowCheckout(false);
      setActiveTab("overview");
      const reqRes = await api.get('/service-requests').catch(() => ({ data: [] }));
      setMyRequests(reqRes.data.filter(r => r.clientId === currentUser?.uid));
      alert("AI Agent Brief submitted to Admin.");
    } catch (error) { alert("Error submitting request."); }
  };

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const sendMessage = async () => {
    if (!chatMsg.trim()) return;
    const newMsg = {
      clientId: currentUser.uid,
      from: currentUser?.displayName || "User", msg: chatMsg, type: "user", unread: true,
      avatar: currentUser?.photoURL || "U",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(h => [...h, newMsg]);
    setChatMsg("");
    // Emit via socket so admin sees it instantly
    socketRef.current?.emit("send_message", { ...newMsg, to: "admin_room" });
    try { await api.post('/messages', newMsg); } catch (e) { }
  };

  // SECURE CLOUDINARY API UPLOAD
  const handleAssetUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus("Uploading to secure cloud...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", currentUser.uid);
    formData.append("fileName", file.name);
    try {
      const res = await api.post('/assets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMyAssets([res.data, ...myAssets]);
      setUploadStatus("");
      alert("Asset uploaded successfully!");
    } catch (error) {
      console.error(error);
      setUploadStatus("");
      alert("Failed to upload asset. Check server logs.");
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm("Are you sure you want to delete this file? This cannot be undone.")) return;
    try {
      await api.delete(`/assets/${assetId}`);
      setMyAssets(myAssets.filter(a => a.id !== assetId));
    } catch (error) { alert("Failed to delete asset. Check server connection."); }
  };

  // SEARCH & FILTER LOGIC
  const displayedAssets = myAssets.filter(asset => {
    const searchMatch = asset.name.toLowerCase().includes(assetSearch.toLowerCase());
    let filterMatch = true;
    if (assetFilter === "IMAGES") filterMatch = asset.name.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i);
    else if (assetFilter === "DOCUMENTS") filterMatch = asset.name.match(/\.(pdf|doc|docx|txt|csv|xls|xlsx)$/i);
    return searchMatch && filterMatch;
  });

  const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + (Number(c.leads) || 0), 0);
  const liveCampaignsCount = campaigns.filter(c => c.status === "live").length;

  // Recharts data
  const spendChartData = campaigns.map(c => ({ name: c.name?.substring(0, 10) || "Camp", spend: Number(c.spend) || 0 }));
  const leadsChartData = campaigns.map(c => ({ name: c.name?.substring(0, 10) || "Camp", leads: Number(c.leads) || 0 }));

  const sidebarItems = [
    { id: "overview", icon: "⊡", label: "Overview" },
    { id: "deploy", icon: "🚀", label: "Launch Agent" },
    { id: "campaigns", icon: "◉", label: "Live Campaigns" },
    { id: "analytics", icon: "▲", label: "Analytics" },
    { id: "assets", icon: "📁", label: "Brand Assets" },
    { id: "tasks", icon: "☑", label: "Tasks" },
    { id: "chat", icon: "✉", label: "Support Chat" },
    { id: "profile", icon: "◆", label: "My Profile" },
    { id: "security", icon: "🔒", label: "Security & MFA" },
  ];

  if (loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--orange)" }}>LOADING NEXUS SECURE PORTAL...</div>;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: "240px", flexShrink: 0, background: "var(--black2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "20px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", marginBottom: "32px" }}>
          <div style={{ width: "32px", height: "32px", background: "var(--orange)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: "18px" }}>N</div>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: "20px", letterSpacing: "0.1em" }}>NEXUS</span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {sidebarItems.map(item => (
            <div key={item.id} className={`sidebar-item ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)} style={{ color: item.id === 'deploy' ? "var(--orange)" : "" }}>
              <span style={{ fontSize: "16px" }}>{item.icon}</span>
              <span style={{ fontWeight: item.id === 'deploy' ? 700 : 400 }}>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", padding: "12px", borderRadius: "12px", background: "var(--black3)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: "14px", fontWeight: 700 }}>{currentUser?.displayName?.charAt(0) || "U"}</span>
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{currentUser?.displayName}</div>
              <div style={{ fontSize: "10px", color: "var(--orange)", fontFamily: "'JetBrains Mono'", letterSpacing: "0.1em", textTransform: "uppercase" }}>TIER: {clientData?.plan || "PENDING"}</div>
            </div>
          </div>
        </div>

        <button className="btn-ghost" onClick={handleLogout} style={{ marginTop: "8px", width: "100%", padding: "10px", borderRadius: "8px", fontSize: "12px", color: "var(--neon-pink)", borderColor: "rgba(255,0,110,0.3)" }}>
          LOG OUT
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", background: "var(--black)" }}>
        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(8,8,8,0.9)", backdropFilter: "blur(20px)", zIndex: 100 }}>
          <div><h1 style={{ fontSize: "24px", fontWeight: 700 }}>{sidebarItems.find(s => s.id === activeTab)?.label}</h1></div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "20px", background: "rgba(0,255,148,0.1)", border: "1px solid rgba(0,255,148,0.2)" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--neon-green)", animation: "pulse-green 2s infinite" }} />
            <span style={{ fontSize: "12px", color: "var(--neon-green)", fontFamily: "'JetBrains Mono'" }}>{liveCampaignsCount} CAMPAIGNS LIVE</span>
          </div>
        </div>

        <div style={{ padding: "32px" }}>
          <AnimatePresence mode="wait">

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <motion.div key="overview" variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  <div className="card-hover" style={{ padding: "24px", borderRadius: "16px", background: "var(--card)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-dimmer)", textTransform: "uppercase" }}>Active Campaigns</div>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: "42px", color: "var(--neon-green)" }}>{campaigns.length}</div>
                  </div>
                  <div className="card-hover" style={{ padding: "24px", borderRadius: "16px", background: "var(--card)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-dimmer)", textTransform: "uppercase" }}>Total Ad Spend</div>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: "42px", color: "var(--orange)" }}>${totalSpend.toLocaleString()}</div>
                  </div>
                  <div className="card-hover" style={{ padding: "24px", borderRadius: "16px", background: "var(--card)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-dimmer)", textTransform: "uppercase" }}>Leads Generated</div>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: "42px", color: "var(--neon-blue)" }}>{totalLeads.toLocaleString()}</div>
                  </div>
                </div>

                {myRequests.length > 0 && myRequests[0]?.status === 'needs_clarification' && (
                  <div style={{ padding: "24px", borderRadius: "16px", background: "rgba(255,0,110,0.1)", border: "1px solid var(--neon-pink)" }}>
                    <h3 style={{ color: "var(--neon-pink)", fontWeight: 700, marginBottom: "8px" }}>⚠️ ACTION REQUIRED: Admin Requested Clarification</h3>
                    <p style={{ fontSize: "14px", color: "white", marginBottom: "16px" }}>"{myRequests[0]?.adminFeedback}"</p>
                    <button className="btn-primary" onClick={() => setActiveTab("deploy")} style={{ padding: "10px 20px", fontSize: "13px", borderRadius: "8px" }}>EDIT & RESUBMIT BRIEF</button>
                  </div>
                )}

                <div className="card-hover" style={{ padding: "28px", borderRadius: "16px", background: "var(--card)", marginTop: "16px" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "24px" }}>System Status</h3>
                  {campaigns.length === 0 ? (
                    myRequests.length > 0 ? (
                      <div style={{ padding: "20px" }}>
                        {myRequests[0]?.status === 'approved' ? (
                          <div style={{ textAlign: "center", padding: "40px" }}>
                            <div style={{ fontSize: "40px", marginBottom: "16px", color: "var(--neon-green)" }}>🚀</div>
                            <h4 style={{ fontSize: "20px", marginBottom: "8px", fontFamily: "'Bebas Neue'", letterSpacing: "0.05em", color: "var(--neon-green)" }}>AI AGENT DEPLOYED</h4>
                            <p style={{ color: "var(--text-dim)", fontSize: "14px", maxWidth: "450px", margin: "0 auto" }}>Your strategy has been approved! The AI Agent is currently generating your campaigns.</p>
                          </div>
                        ) : (
                          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
                            <div style={{ textAlign: "center", marginBottom: "40px" }}>
                              <div style={{ fontSize: "40px", marginBottom: "16px", color: "var(--orange)" }}>⏳</div>
                              <h4 style={{ fontSize: "20px", marginBottom: "8px", fontFamily: "'Bebas Neue'", letterSpacing: "0.05em", color: "var(--orange)" }}>INITIALIZATION IN PROGRESS</h4>
                              <p style={{ color: "var(--text-dim)", fontSize: "14px" }}>Your AI Marketing Agent is reviewing your parameters. Awaiting Admin verification.</p>
                            </div>
                            <div style={{ background: "var(--black2)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", textAlign: "left" }}>
                              <h5 style={{ fontFamily: "'Bebas Neue'", fontSize: "18px", color: "white", marginBottom: "20px", letterSpacing: "0.05em" }}>PROPOSED ACTION ROADMAP</h5>
                              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                {[
                                  { n: 1, title: "Audience Analysis", desc: `Structuring targeting parameters for: "${myRequests[0].requirements.targetAudience.substring(0, 60)}..."` },
                                  { n: 2, title: "Channel Integration", desc: `Setting up automated bidding pipelines for ${myRequests[0].requirements.channels.join(", ")}.` },
                                  { n: 3, title: "Budget & Goal Optimization", desc: `Allocating $${myRequests[0].requirements.monthlyBudget}/mo to maximize ${myRequests[0].requirements.primaryGoal}.` }
                                ].map(step => (
                                  <div key={step.n} style={{ display: "flex", gap: "16px" }}>
                                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,85,0,0.2)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "bold", flexShrink: 0 }}>{step.n}</div>
                                    <div>
                                      <div style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>{step.title}</div>
                                      <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px", lineHeight: 1.5 }}>{step.desc}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "60px 20px" }}>
                        <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚡</div>
                        <h4 style={{ fontSize: "20px", marginBottom: "8px", fontFamily: "'Bebas Neue'", letterSpacing: "0.05em" }}>NO CAMPAIGNS DETECTED</h4>
                        <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>Your AI Marketing Agent is standing by. Provide your business requirements to initialize your custom strategy.</p>
                        <button className="btn-primary" onClick={() => setActiveTab("deploy")} style={{ padding: "16px 32px", borderRadius: "8px", fontSize: "14px" }}>INITIALIZE AI AGENT →</button>
                      </div>
                    )
                  ) : (
                    <div style={{ color: "var(--neon-green)", textAlign: "center", padding: "40px" }}>{campaigns.length} Active Campaigns Running Globally</div>
                  )}
                </div>
              </motion.div>
            )}

            {/* DEPLOY AGENT TAB */}
            {activeTab === "deploy" && (
              <motion.div key="deploy" variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ maxWidth: "900px" }}>
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Step 1: Select Your Protocol</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                    {pricingTiers.map(tier => (
                      <div key={tier.name} onClick={() => setIntakeData({ ...intakeData, selectedTier: tier.name })} className="card-hover"
                        style={{ padding: "24px", borderRadius: "12px", cursor: "pointer", border: intakeData.selectedTier === tier.name ? "2px solid var(--orange)" : "1px solid rgba(255,255,255,0.1)", background: intakeData.selectedTier === tier.name ? "rgba(255,85,0,0.08)" : "var(--card)" }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "'JetBrains Mono'", color: intakeData.selectedTier === tier.name ? "var(--orange)" : "white" }}>{tier.name}</div>
                        <div style={{ fontSize: "32px", fontFamily: "'Bebas Neue'", margin: "12px 0" }}>${tier.price}</div>
                        <ul style={{ padding: 0, margin: 0, listStyle: "none", fontSize: "13px", color: "var(--text-dim)" }}>
                          {tier.features.map(f => <li key={f} style={{ marginBottom: "8px" }}>✓ {f}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-hover" style={{ background: "var(--card)", padding: "40px", borderRadius: "16px", border: "1px solid var(--border)" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "32px" }}>Step 2: AI Agent Briefing</h2>
                  <form onSubmit={handleProceedToCheckout} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div>
                        <label style={labelStyle}>Business Domain *</label>
                        <select required value={intakeData.businessDomain} onChange={e => setIntakeData({ ...intakeData, businessDomain: e.target.value })} style={inputStyle}>
                          {availableDomains.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Business Type *</label>
                        <select required value={intakeData.businessType} onChange={e => setIntakeData({ ...intakeData, businessType: e.target.value })} style={inputStyle}>
                          {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div>
                        <label style={labelStyle}>Primary Goal *</label>
                        <select required value={intakeData.primaryGoal} onChange={e => setIntakeData({ ...intakeData, primaryGoal: e.target.value })} style={inputStyle}>
                          {availableGoals.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Monthly Ad Budget ($) *</label>
                        <input type="number" required placeholder="e.g. 5000" value={intakeData.monthlyBudget} onChange={e => setIntakeData({ ...intakeData, monthlyBudget: e.target.value })} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div>
                        <label style={labelStyle}>Business URL (Optional)</label>
                        <input type="url" placeholder="https://" value={intakeData.businessUrl} onChange={e => setIntakeData({ ...intakeData, businessUrl: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Target Geography *</label>
                        <input type="text" required placeholder="e.g. Nationwide, or Miami FL" value={intakeData.geography} onChange={e => setIntakeData({ ...intakeData, geography: e.target.value })} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Target Audience Profile *</label>
                      <textarea required placeholder="Describe your ideal customer (Age, interests, pain points)..." value={intakeData.targetAudience} onChange={e => setIntakeData({ ...intakeData, targetAudience: e.target.value })} style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Unique Selling Proposition (USP) *</label>
                      <textarea required placeholder="Why should customers choose you over competitors?" value={intakeData.usp} onChange={e => setIntakeData({ ...intakeData, usp: e.target.value })} style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div>
                        <label style={labelStyle}>Main Competitors</label>
                        <textarea placeholder="List 2-3 competitor URLs or names..." value={intakeData.competitors} onChange={e => setIntakeData({ ...intakeData, competitors: e.target.value })} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Current Offers / Lead Magnets</label>
                        <textarea placeholder="e.g. 20% off first order, Free PDF guide..." value={intakeData.offers} onChange={e => setIntakeData({ ...intakeData, offers: e.target.value })} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Preferred Channels *</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {availableChannels.map(channel => {
                          const isSelected = intakeData.channels.includes(channel);
                          return (
                            <div key={channel} onClick={() => setIntakeData({ ...intakeData, channels: isSelected ? intakeData.channels.filter(c => c !== channel) : [...intakeData.channels, channel] })}
                              style={{ padding: "10px 20px", borderRadius: "20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", background: isSelected ? "var(--orange)" : "var(--black3)", color: isSelected ? "white" : "#a0a0a0", border: `1px solid ${isSelected ? "var(--orange)" : "rgba(255,255,255,0.1)"}`, transition: "all 0.2s ease" }}>
                              {channel}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ padding: "18px", borderRadius: "10px", fontSize: "16px", fontWeight: 700, marginTop: "12px", letterSpacing: "0.05em" }}>PROCEED TO CHECKOUT</button>
                  </form>
                </div>
              </motion.div>
            )}

            {/* CAMPAIGNS TAB */}
            {activeTab === "campaigns" && (
              <motion.div key="campaigns" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                className="card-hover" style={{ borderRadius: "16px", background: "var(--card)", overflow: "hidden" }}>
                {campaigns.length === 0 ? (
                  <PremiumEmpty title="NO CAMPAIGNS YET" subtitle="Waiting for Admin to deploy your AI campaigns. Submit your brief to get started." ctaLabel="LAUNCH AGENT →" onCta={() => setActiveTab("deploy")} />
                ) : (
                  <table>
                    <thead><tr><th>Campaign</th><th>Status</th><th>Spend</th><th>Leads</th></tr></thead>
                    <tbody>
                      {campaigns.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td><span className="tag status-live">LIVE</span></td>
                          <td style={{ fontFamily: "'JetBrains Mono'" }}>${c.spend}</td>
                          <td style={{ fontFamily: "'JetBrains Mono'", color: "var(--neon-green)" }}>{c.leads}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}

            {/* ANALYTICS TAB — RECHARTS */}
            {activeTab === "analytics" && (
              <motion.div key="analytics" variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <h3 style={{ fontWeight: 700, fontSize: "18px" }}>Campaign Performance Analytics</h3>
                {campaigns.length === 0 ? (
                  <PremiumEmpty title="NO DATA YET" subtitle="Deploy your first campaign to see analytics charts here." ctaLabel="LAUNCH AGENT →" onCta={() => setActiveTab("deploy")} />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    <div className="card-hover" style={{ background: "var(--card)", padding: "32px", borderRadius: "16px", border: "1px solid var(--border)" }}>
                      <h4 style={{ fontSize: "14px", color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "24px" }}>Leads by Campaign</h4>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={leadsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="leadsGradC" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#00ff94" stopOpacity={1} />
                              <stop offset="100%" stopColor="#00ff94" stopOpacity={0.5} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="leads" fill="url(#leadsGradC)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="card-hover" style={{ background: "var(--card)", padding: "32px", borderRadius: "16px", border: "1px solid var(--border)" }}>
                      <h4 style={{ fontSize: "14px", color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "24px" }}>Ad Spend Allocation</h4>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={spendChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FF5500" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#FF5500" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                          <Tooltip content={<CustomTooltip prefix="$" />} />
                          <Area type="monotone" dataKey="spend" stroke="#FF5500" strokeWidth={2} fill="url(#spendGrad)" dot={{ fill: "#FF5500", r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ASSETS TAB */}
            {activeTab === "assets" && (
              <motion.div key="assets" variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ maxWidth: "800px" }}>
                <div className="card-hover" style={{ padding: "40px", borderRadius: "16px", background: "var(--card)", border: "1px dashed var(--border)", textAlign: "center", marginBottom: "32px" }}>
                  <div style={{ fontSize: "40px", marginBottom: "16px" }}>📁</div>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Upload Brand Assets</h3>
                  <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "24px" }}>Upload your Logos, Brand Guidelines (PDF), and past Ad Creatives here.</p>
                  {uploadStatus ? (
                    <div style={{ color: "var(--orange)", fontWeight: 700 }}>{uploadStatus}</div>
                  ) : (
                    <>
                      <input type="file" id="file-upload" hidden onChange={handleAssetUpload} />
                      <label htmlFor="file-upload" className="btn-primary" style={{ padding: "12px 24px", borderRadius: "8px", cursor: "pointer", display: "inline-block" }}>SELECT FILES</label>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
                  <input type="text" placeholder="🔍 Search files by name..." value={assetSearch} onChange={e => setAssetSearch(e.target.value)} style={{ ...inputStyle, flex: 2, padding: "12px 16px" }} />
                  <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)} style={{ ...inputStyle, flex: 1, padding: "12px 16px" }}>
                    <option value="ALL">All Files</option>
                    <option value="IMAGES">Images Only</option>
                    <option value="DOCUMENTS">Documents & PDFs</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {displayedAssets.length === 0 ? (
                    <PremiumEmpty title="NO ASSETS FOUND" subtitle={myAssets.length === 0 ? "Upload your first brand asset to get started." : "No files match your search or filter."} />
                  ) : (
                    displayedAssets.map(asset => (
                      <div key={asset.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "var(--black3)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>{asset.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                          <a href={asset.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--neon-blue)", fontSize: "13px", textDecoration: "none", fontWeight: 700 }}>DOWNLOAD ↓</a>
                          <button onClick={() => handleDeleteAsset(asset.id)} style={{ background: "transparent", border: "none", color: "var(--neon-pink)", fontSize: "13px", cursor: "pointer", fontWeight: 700 }}>DELETE ✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* TASKS TAB */}
            {activeTab === "tasks" && (
              <motion.div key="tasks" variants={tabVariants} initial="initial" animate="animate" exit="exit">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
                  {["todo", "progress", "done"].map(status => (
                    <div key={status} style={{ padding: "20px", borderRadius: "16px", background: "var(--card)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: status === "done" ? "var(--neon-green)" : status === "progress" ? "var(--orange)" : "var(--text-dimmer)" }} />
                        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dimmer)" }}>{status}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {tasks.filter(t => t.status === status).map((task, i) => (
                          <div key={i} style={{ padding: "16px", borderRadius: "10px", background: "var(--black3)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: "13px", fontWeight: 600 }}>{task.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* CHAT TAB */}
            {activeTab === "chat" && (
              <motion.div key="chat" variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
                <div className="card-hover" style={{ flex: 1, borderRadius: "16px", background: "var(--card)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflow: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {chatHistory.length === 0 ? (
                      <div style={{ margin: "auto", color: "var(--text-dimmer)" }}>Start a conversation with our team...</div>
                    ) : (
                      chatHistory.map((m, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: m.type === "user" ? "row-reverse" : "row", gap: "12px", alignItems: "flex-start" }}>
                          <div style={{ padding: "12px 16px", borderRadius: m.type === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px", background: m.type === "user" ? "var(--orange)" : "var(--black3)", fontSize: "14px" }}>{m.msg}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", background: "var(--black2)" }}>
                    <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Type your message..." style={{ ...inputStyle, padding: "12px 16px", background: "var(--black)" }} />
                    <button className="btn-primary" onClick={sendMessage} style={{ padding: "12px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: 700 }}>SEND</button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <motion.div key="profile" variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div className="card-hover" style={{ padding: "32px", borderRadius: "16px", background: "var(--card)" }}>
                  <h3 style={{ fontWeight: 700, marginBottom: "24px", fontSize: "20px" }}>Company Profile</h3>
                  {[
                    { label: "Company Name", key: "companyName", readOnly: false },
                    { label: "Industry", key: "industry", readOnly: false, placeholder: "e.g. Real Estate" },
                    { label: "Email Address", key: "email", readOnly: true },
                    { label: "Phone Number", key: "phone", readOnly: false },
                    { label: "Company Website", key: "website", readOnly: false, placeholder: "https://" },
                  ].map(field => (
                    <div key={field.key} style={{ marginBottom: "20px" }}>
                      <label style={labelStyle}>{field.label}</label>
                      <input
                        value={profileForm[field.key]}
                        readOnly={field.readOnly}
                        placeholder={field.placeholder || ""}
                        onChange={e => !field.readOnly && setProfileForm({ ...profileForm, [field.key]: e.target.value })}
                        style={field.readOnly ? { ...inputStyle, background: "rgba(255,255,255,0.03)", color: "#888", cursor: "not-allowed" } : inputStyle}
                      />
                    </div>
                  ))}
                  <button className="btn-primary" onClick={handleSaveProfile} style={{ padding: "14px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: 700 }}>SAVE PROFILE DATA</button>
                </div>

                <div className="card-hover" style={{ padding: "32px", borderRadius: "16px", background: "var(--card)", height: "fit-content" }}>
                  <h3 style={{ fontWeight: 700, marginBottom: "24px", fontSize: "20px" }}>Your Service Protocol</h3>
                  <div style={{ padding: "16px", background: "rgba(255,85,0,0.1)", border: "1px solid rgba(255,85,0,0.3)", borderRadius: "12px", marginBottom: "24px" }}>
                    <div style={{ fontSize: "11px", color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono'", marginBottom: "4px", fontWeight: 700 }}>Active Subscription Tier</div>
                    <div style={{ fontSize: "24px", fontFamily: "'Bebas Neue'", color: "white" }}>{clientData?.plan || "PENDING SETUP"}</div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: "12px", color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", fontWeight: 700 }}>Included Capabilities</h4>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                      {tierServices[clientData?.plan?.toUpperCase()] ? (
                        tierServices[clientData.plan.toUpperCase()].map((service, i) => (
                          <li key={i} style={{ fontSize: "14px", color: "var(--text)", display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "rgba(0,255,148,0.1)", color: "var(--neon-green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 }}>✓</div>
                            {service}
                          </li>
                        ))
                      ) : (
                        <li style={{ fontSize: "13px", color: "var(--text-dim)" }}>Awaiting Admin tier assignment.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SECURITY TAB */}
            {activeTab === "security" && (
              <motion.div key="security" variants={tabVariants} initial="initial" animate="animate" exit="exit" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div className="card-hover" style={{ padding: "32px", borderRadius: "16px", background: "var(--card)" }}>
                  <h3 style={{ fontWeight: 700, marginBottom: "24px", fontSize: "20px" }}>Update Password</h3>
                  <form onSubmit={handleUpdatePassword}>
                    <div style={{ marginBottom: "20px" }}>
                      <label style={labelStyle}>Current Password</label>
                      <input type="password" required value={securityForm.currentPassword} onChange={e => setSecurityForm({ ...securityForm, currentPassword: e.target.value })} style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: "20px" }}>
                      <label style={labelStyle}>New Password</label>
                      <input type="password" required value={securityForm.newPassword} onChange={e => setSecurityForm({ ...securityForm, newPassword: e.target.value })} style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: "20px" }}>
                      <label style={labelStyle}>Confirm New Password</label>
                      <input type="password" required value={securityForm.confirmPassword} onChange={e => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })} style={inputStyle} />
                    </div>
                    <button type="submit" className="btn-primary" style={{ padding: "14px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: 700 }}>UPDATE PASSWORD</button>
                  </form>
                </div>

                <div className="card-hover" style={{ padding: "32px", borderRadius: "16px", background: "var(--card)" }}>
                  <h3 style={{ fontWeight: 700, marginBottom: "8px", fontSize: "20px" }}>Multi-Factor Authentication</h3>
                  <p style={{ fontSize: "14px", color: "var(--text-dim)", marginBottom: "24px" }}>Add an extra layer of security to your account using SMS verification.</p>

                  <div id="recaptcha-container" style={{ marginBottom: showMfaInput ? "16px" : "0" }}></div>

                  {isMfaEnrolled ? (
                    <div style={{ padding: "16px", background: "rgba(0,255,148,0.1)", border: "1px solid var(--neon-green)", borderRadius: "12px" }}>
                      <div style={{ fontSize: "14px", color: "var(--neon-green)", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>🔒</span> MFA is Active
                      </div>
                      <p style={{ fontSize: "12px", color: "white", marginTop: "8px", marginBottom: "0" }}>Your account is protected by Multi-Factor Authentication.</p>
                    </div>
                  ) : (
                    <div>
                      {!showMfaInput ? (
                        <>
                          <div style={{ marginBottom: "20px" }}>
                            <label style={labelStyle}>Phone Number (+1...)</label>
                            <input type="tel" placeholder="+12345678900" value={mfaPhone} onChange={e => setMfaPhone(e.target.value)} style={inputStyle} />
                          </div>
                          <button onClick={handleEnrollMFA} className="btn-primary" style={{ padding: "14px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, background: "var(--black2)", border: "1px solid var(--border)", color: "#fff" }}>SEND SMS CODE</button>
                        </>
                      ) : (
                        <>
                          <div style={{ marginBottom: "20px" }}>
                            <label style={labelStyle}>Enter 6-digit Code</label>
                            <input type="text" placeholder="123456" value={mfaCode} onChange={e => setMfaCode(e.target.value)} style={inputStyle} />
                          </div>
                          <button onClick={confirmEnrollMFA} className="btn-primary" style={{ padding: "14px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: 700 }}>VERIFY AND ENROLL</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ─── SECURE CHECKOUT MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showCheckout && (
          <motion.div key="checkout-backdrop" variants={backdropVariants} initial="initial" animate="animate" exit="exit"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div key="checkout-modal" variants={modalVariants} initial="initial" animate="animate" exit="exit"
              className="card-hover" style={{ background: "var(--card)", padding: "40px", borderRadius: "16px", maxWidth: "400px", width: "100%", border: "1px solid var(--orange)" }}>
              <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: "32px", color: "white", marginBottom: "8px" }}>SECURE CHECKOUT</h2>
              <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "24px" }}>You are subscribing to the <strong style={{ color: "var(--orange)" }}>{intakeData.selectedTier}</strong> Protocol.</p>
              <div style={{ padding: "16px", background: "var(--black)", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "24px", color: "var(--text-dimmer)", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                [ BILLING GATEWAY PAUSED FOR MVP ]
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn-ghost" onClick={() => setShowCheckout(false)} style={{ flex: 1, padding: "12px", borderRadius: "8px", fontWeight: 600 }}>CANCEL</button>
                <button className="btn-primary" onClick={processPaymentAndSubmit} style={{ flex: 2, padding: "12px", borderRadius: "8px", fontWeight: 700 }}>SUBMIT BRIEF</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}