import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api"; 
import { useAuth } from "../contexts/AuthContext";
import toast, { Toaster } from "react-hot-toast"; // <-- NEW IMPORT

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
  
  // CLOUDINARY UPLOAD STATE
  const [uploadStatus, setUploadStatus] = useState(""); 

  // PROFILE STATE
  const [profileForm, setProfileForm] = useState({ companyName: "", contactName: "", email: "", phone: "", industry: "", website: "" });

  // --- COMPREHENSIVE AI INTAKE ARRAYS ---
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

  // --- HIGH VISIBILITY FORM STYLES ---
  const labelStyle = { fontSize: "12px", color: "#b0b0b0", textTransform: "uppercase", display: "block", marginBottom: "8px", fontWeight: 700, letterSpacing: "0.05em" };
  const inputStyle = { width: "100%", padding: "14px", borderRadius: "8px", background: "var(--black)", color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.15)", fontSize: "15px", fontWeight: 500, outline: "none", fontFamily: "inherit" };

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        const safeGet = (url) => api.get(url).catch(() => ({ data: [] }));

        const [campRes, reqRes, clientsRes, taskRes, msgRes, assetRes] = await Promise.all([
          safeGet('/campaigns'), safeGet('/service-requests'), safeGet('/clients'), safeGet('/tasks'), safeGet('/messages'), safeGet('/assets')
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
      toast.success("Profile updated securely."); // <-- REPLACED ALERT
    } catch (err) { toast.error("Error saving profile. Make sure Express server is running."); }
  };

  const handleProceedToCheckout = (e) => {
    e.preventDefault();
    if(intakeData.channels.length === 0) return toast.error("Select at least one channel."); // <-- REPLACED ALERT
    setShowCheckout(true); 
  };

  const processPaymentAndSubmit = async () => {
    const loadingToast = toast.loading("Submitting Brief...");
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
      toast.success("AI Agent Brief successfully submitted!", { id: loadingToast }); // <-- REPLACED ALERT
    } catch (error) { toast.error("Error submitting request.", { id: loadingToast }); }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login"); 
  };

  const sendMessage = async () => {
    if (!chatMsg.trim()) return;
    const newMsg = { 
      clientId: currentUser.uid,
      from: currentUser?.displayName || "User", msg: chatMsg, type: "user", unread: true, 
      avatar: currentUser?.photoURL || "U", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatHistory(h => [...h, newMsg]);
    setChatMsg("");
    try { await api.post('/messages', newMsg); } catch (e) {}
  };

  // --- SECURE CLOUDINARY API UPLOAD ---
  const handleAssetUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadStatus("Uploading to secure cloud...");
    const uploadToast = toast.loading("Uploading file...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", currentUser.uid);
    formData.append("fileName", file.name);

    try {
      const res = await api.post('/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setMyAssets([...myAssets, res.data]);
      setUploadStatus("");
      toast.success("Asset uploaded successfully!", { id: uploadToast }); // <-- REPLACED ALERT
    } catch (error) {
      console.error(error);
      setUploadStatus("");
      toast.error("Failed to upload asset.", { id: uploadToast });
    }
  };

  const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + (Number(c.leads) || 0), 0);
  const liveCampaignsCount = campaigns.filter(c => c.status === "live").length;
  
  const sidebarItems = [
    { id: "overview", icon: "⊡", label: "Overview" },
    { id: "deploy", icon: "🚀", label: "Launch Agent" }, 
    { id: "campaigns", icon: "◉", label: "Live Campaigns" },
    { id: "analytics", icon: "▲", label: "Analytics" }, 
    { id: "assets", icon: "📁", label: "Brand Assets" }, 
    { id: "tasks", icon: "☑", label: "Tasks" },
    { id: "chat", icon: "✉", label: "Support Chat" },
    { id: "profile", icon: "◆", label: "My Profile" },
  ];

  // --- NEW SKELETON UI LOADER ---
  if (loading) return (
    <div style={{ height: "100vh", display: "flex", background: "var(--black)", padding: "32px", gap: "32px" }}>
      <style>{`@keyframes pulse { 0% { opacity: 0.8; } 50% { opacity: 0.3; } 100% { opacity: 0.8; } } .sk-pulse { animation: pulse 1.5s infinite; background: var(--black2); border-radius: 12px; }`}</style>
      <div className="sk-pulse" style={{ width: "240px", height: "100%" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
        <div className="sk-pulse" style={{ width: "30%", height: "40px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          <div className="sk-pulse" style={{ height: "120px" }} />
          <div className="sk-pulse" style={{ height: "120px" }} />
          <div className="sk-pulse" style={{ height: "120px" }} />
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
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
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
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
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
                  <p style={{ fontSize: "14px", color: "white", marginBottom: "16px" }}>" {myRequests[0]?.adminFeedback} "</p>
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
                          <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "24px", maxWidth: "450px", margin: "0 auto" }}>Your strategy has been approved! The AI Agent is currently generating your campaigns. They will appear here shortly.</p>
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
                              <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,85,0,0.2)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "bold", flexShrink: 0 }}>1</div>
                                <div>
                                  <div style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>Audience Analysis</div>
                                  <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px", lineHeight: 1.5 }}>Structuring targeting parameters for: <span style={{ color: "var(--text-dimmer)" }}>"{myRequests[0].requirements.targetAudience.substring(0, 60)}..."</span></div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,85,0,0.2)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "bold", flexShrink: 0 }}>2</div>
                                <div>
                                  <div style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>Channel Integration</div>
                                  <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px", lineHeight: 1.5 }}>Setting up automated bidding pipelines for <span style={{ color: "var(--orange)" }}>{myRequests[0].requirements.channels.join(", ")}</span>.</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,85,0,0.2)", color: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "bold", flexShrink: 0 }}>3</div>
                                <div>
                                  <div style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>Budget & Goal Optimization</div>
                                  <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px", lineHeight: 1.5 }}>Allocating <span style={{ color: "var(--neon-green)" }}>${myRequests[0].requirements.monthlyBudget}/mo</span> to maximize <span style={{ color: "var(--neon-blue)" }}>{myRequests[0].requirements.primaryGoal}</span>.</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "60px 20px" }}>
                      <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚡</div>
                      <h4 style={{ fontSize: "20px", marginBottom: "8px", fontFamily: "'Bebas Neue'", letterSpacing: "0.05em" }}>NO CAMPAIGNS DETECTED</h4>
                      <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>
                        Your AI Marketing Agent is standing by. Provide your business requirements to initialize your custom strategy.
                      </p>
                      <button className="btn-primary" onClick={() => setActiveTab("deploy")} style={{ padding: "16px 32px", borderRadius: "8px", fontSize: "14px" }}>
                        INITIALIZE AI AGENT →
                      </button>
                    </div>
                  )
                ) : (
                  <div style={{ color: "var(--neon-green)", textAlign: "center", padding: "40px" }}>{campaigns.length} Active Campaigns Running Globally</div>
                )}
              </div>
            </div>
          )}

          {/* DEPLOY AGENT TAB */}
          {activeTab === "deploy" && (
            <div style={{ maxWidth: "900px" }}>
              <div style={{ marginBottom: "32px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Step 1: Select Your Protocol</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  {pricingTiers.map(tier => (
                    <div key={tier.name} 
                      onClick={() => setIntakeData({...intakeData, selectedTier: tier.name})}
                      className="card-hover" 
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
                      <select required value={intakeData.businessDomain} onChange={e => setIntakeData({...intakeData, businessDomain: e.target.value})} style={inputStyle}>
                        {availableDomains.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Business Type *</label>
                      <select required value={intakeData.businessType} onChange={e => setIntakeData({...intakeData, businessType: e.target.value})} style={inputStyle}>
                        {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                      <label style={labelStyle}>Primary Goal *</label>
                      <select required value={intakeData.primaryGoal} onChange={e => setIntakeData({...intakeData, primaryGoal: e.target.value})} style={inputStyle}>
                        {availableGoals.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Monthly Ad Budget ($) *</label>
                      <input type="number" required placeholder="e.g. 5000" value={intakeData.monthlyBudget} onChange={e => setIntakeData({...intakeData, monthlyBudget: e.target.value})} style={inputStyle} />
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                      <label style={labelStyle}>Business URL (Optional)</label>
                      <input type="url" placeholder="https://" value={intakeData.businessUrl} onChange={e => setIntakeData({...intakeData, businessUrl: e.target.value})} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Target Geography *</label>
                      <input type="text" required placeholder="e.g. Nationwide, or Miami FL" value={intakeData.geography} onChange={e => setIntakeData({...intakeData, geography: e.target.value})} style={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Target Audience Profile *</label>
                    <textarea required placeholder="Describe your ideal customer (Age, interests, pain points)..." value={intakeData.targetAudience} onChange={e => setIntakeData({...intakeData, targetAudience: e.target.value})} style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} />
                  </div>

                  <div>
                    <label style={labelStyle}>Unique Selling Proposition (USP) *</label>
                    <textarea required placeholder="Why should customers choose you over competitors? What makes you unique?" value={intakeData.usp} onChange={e => setIntakeData({...intakeData, usp: e.target.value})} style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                      <label style={labelStyle}>Main Competitors</label>
                      <textarea placeholder="List 2-3 competitor URLs or names..." value={intakeData.competitors} onChange={e => setIntakeData({...intakeData, competitors: e.target.value})} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Current Offers / Lead Magnets</label>
                      <textarea placeholder="e.g. 20% off first order, Free PDF guide..." value={intakeData.offers} onChange={e => setIntakeData({...intakeData, offers: e.target.value})} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Preferred Channels *</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                      {availableChannels.map(channel => {
                        const isSelected = intakeData.channels.includes(channel);
                        return (
                          <div key={channel} onClick={() => { setIntakeData({...intakeData, channels: isSelected ? intakeData.channels.filter(c => c !== channel) : [...intakeData.channels, channel]}); }}
                            style={{ padding: "10px 20px", borderRadius: "20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", background: isSelected ? "var(--orange)" : "var(--black3)", color: isSelected ? "white" : "#a0a0a0", border: `1px solid ${isSelected ? "var(--orange)" : "rgba(255,255,255,0.1)"}`, transition: "all 0.2s ease" }}>
                            {channel}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  <button type="submit" className="btn-primary" style={{ padding: "18px", borderRadius: "10px", fontSize: "16px", fontWeight: 700, marginTop: "12px", letterSpacing: "0.05em" }}>
                    PROCEED TO CHECKOUT
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* CAMPAIGNS TAB */}
          {activeTab === "campaigns" && (
            <div className="card-hover" style={{ borderRadius: "16px", background: "var(--card)", overflow: "hidden" }}>
              {campaigns.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dimmer)" }}>Waiting for Admin to deploy AI campaigns.</div> : (
                <table>
                  <thead>
                    <tr><th>Campaign</th><th>Status</th><th>Spend</th><th>Leads</th></tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td><span className={`tag status-live`}>LIVE</span></td>
                        <td style={{ fontFamily: "'JetBrains Mono'" }}>${c.spend}</td>
                        <td style={{ fontFamily: "'JetBrains Mono'", color: "var(--neon-green)" }}>{c.leads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* DYNAMIC ANALYTICS TAB */}
          {activeTab === "analytics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
               <h3 style={{ fontWeight: 700, fontSize: "18px" }}>Campaign Performance Analytics</h3>
               {campaigns.length === 0 ? (
                 <div style={{ padding: "40px", textAlign: "center", background: "var(--card)", borderRadius: "16px", border: "1px dashed var(--border)", color: "var(--text-dimmer)" }}>
                   Waiting for AI Agent to deploy campaigns to generate analytics.
                 </div>
               ) : (
                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                   <div className="card-hover" style={{ background: "var(--card)", padding: "32px", borderRadius: "16px", border: "1px solid var(--border)" }}>
                     <h4 style={{ fontSize: "14px", color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "24px" }}>Leads by Campaign</h4>
                     <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", height: "250px" }}>
                       {campaigns.map(c => {
                         const heightPercentage = Math.min((c.leads / Math.max(...campaigns.map(cp => cp.leads || 1))) * 100, 100) || 5;
                         return (
                           <div key={`lead-${c.id}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                             <div style={{ fontSize: "12px", color: "var(--neon-green)", fontFamily: "'JetBrains Mono'" }}>{c.leads}</div>
                             <div style={{ width: "100%", height: `${heightPercentage}%`, background: "linear-gradient(to top, var(--neon-green), #00ff94)", borderRadius: "4px 4px 0 0", minHeight: "10px", transition: "height 1s ease" }}></div>
                             <div style={{ fontSize: "10px", color: "var(--text-dimmer)", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", width: "100%" }}>{c.name}</div>
                           </div>
                         )
                       })}
                     </div>
                   </div>

                   <div className="card-hover" style={{ background: "var(--card)", padding: "32px", borderRadius: "16px", border: "1px solid var(--border)" }}>
                     <h4 style={{ fontSize: "14px", color: "var(--text-dimmer)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "24px" }}>Ad Spend Allocation</h4>
                     <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", height: "250px" }}>
                       {campaigns.map(c => {
                         const heightPercentage = Math.min((c.spend / Math.max(...campaigns.map(cp => cp.spend || 1))) * 100, 100) || 5;
                         return (
                           <div key={`spend-${c.id}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                             <div style={{ fontSize: "12px", color: "var(--orange)", fontFamily: "'JetBrains Mono'" }}>${c.spend}</div>
                             <div style={{ width: "100%", height: `${heightPercentage}%`, background: "linear-gradient(to top, var(--orange), #FF7A00)", borderRadius: "4px 4px 0 0", minHeight: "10px", transition: "height 1s ease" }}></div>
                             <div style={{ fontSize: "10px", color: "var(--text-dimmer)", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", width: "100%" }}>{c.name}</div>
                           </div>
                         )
                       })}
                     </div>
                   </div>
                 </div>
               )}
            </div>
          )}

          {/* ASSETS TAB */}
          {activeTab === "assets" && (
            <div style={{ maxWidth: "800px" }}>
              <div className="card-hover" style={{ padding: "40px", borderRadius: "16px", background: "var(--card)", border: "1px dashed var(--border)", textAlign: "center", marginBottom: "24px" }}>
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

              {/* Display previously uploaded assets */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {myAssets.map(asset => (
                   <div key={asset.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "var(--black3)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                     <span style={{ fontSize: "13px", fontWeight: 600 }}>{asset.name}</span>
                     <a href={asset.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--orange)", fontSize: "12px", textDecoration: "none" }}>Download ↓</a>
                   </div>
                ))}
              </div>
            </div>
          )}

          {/* TASKS TAB */}
          {activeTab === "tasks" && (
            <div>
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
            </div>
          )}

          {/* CHAT TAB */}
          {activeTab === "chat" && (
            <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
              <div className="card-hover" style={{ flex: 1, borderRadius: "16px", background: "var(--card)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflow: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  {chatHistory.length === 0 ? <div style={{ margin: "auto", color: "var(--text-dimmer)" }}>Start a conversation with our team...</div> : (
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
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px", maxWidth: "700px" }}>
              <div className="card-hover" style={{ padding: "32px", borderRadius: "16px", background: "var(--card)" }}>
                <h3 style={{ fontWeight: 700, marginBottom: "24px", fontSize: "20px" }}>Company Profile</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <label style={labelStyle}>Company Name</label>
                    <input value={profileForm.companyName} onChange={e => setProfileForm({...profileForm, companyName: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Industry</label>
                    <input value={profileForm.industry} onChange={e => setProfileForm({...profileForm, industry: e.target.value})} placeholder="e.g. Real Estate" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input value={profileForm.email} readOnly style={{ ...inputStyle, background: "rgba(255,255,255,0.03)", color: "#888", cursor: "not-allowed" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: "28px" }}>
                  <label style={labelStyle}>Company Website</label>
                  <input value={profileForm.website} onChange={e => setProfileForm({...profileForm, website: e.target.value})} placeholder="https://" style={inputStyle} />
                </div>

                <button className="btn-primary" onClick={handleSaveProfile} style={{ padding: "14px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: 700 }}>SAVE PROFILE DATA</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* SECURE CHECKOUT MODAL (Mocked) */}
      {showCheckout && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card-hover" style={{ background: "var(--card)", padding: "40px", borderRadius: "16px", maxWidth: "400px", width: "100%", border: "1px solid var(--orange)" }}>
            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: "32px", color: "white", marginBottom: "8px" }}>SECURE CHECKOUT</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "24px" }}>You are subscribing to the <strong style={{ color: "var(--orange)" }}>{intakeData.selectedTier}</strong> Protocol.</p>
            
            <div style={{ padding: "16px", background: "var(--black)", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "24px", color: "var(--text-dimmer)", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
              [ BILLING GATEWAY PAUSED FOR MVP ]
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button className="btn-ghost" onClick={() => setShowCheckout(false)} style={{ flex: 1, padding: "12px", borderRadius: "8px", fontWeight: 600 }}>CANCEL</button>
              <button className="btn-primary" onClick={processPaymentAndSubmit} style={{ flex: 2, padding: "12px", borderRadius: "8px", fontWeight: 700 }}>SUBMIT BRIEF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}