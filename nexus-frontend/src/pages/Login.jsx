import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, ADMIN_EMAILS } from "../contexts/AuthContext";

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false); // <-- NEW STATE
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { login, registerClient, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setMsg(""); setLoading(true);

    try {
      if (isResetting) {
        await resetPassword(email);
        setMsg("Password reset email sent! Check your inbox.");
      } else if (isRegistering) {
        await registerClient(name, email, password);
        navigate("/client");
      } else {
        const result = await login(email, password);
        if (ADMIN_EMAILS.includes(result.user.email)) navigate("/admin");
        else navigate("/client");
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--black)", padding: "20px" }}>
      <div className="card-hover" style={{ padding: "40px", borderRadius: "16px", background: "var(--card)", maxWidth: "400px", width: "100%" }}>
        
        <div style={{ width: "48px", height: "48px", background: "var(--orange)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: "28px", color: "white", margin: "0 auto 24px" }}>N</div>
        
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: "32px", letterSpacing: "0.05em", marginBottom: "8px", textAlign: "center" }}>
          {isResetting ? "RESET PASSWORD" : isRegistering ? "CLIENT REGISTRATION" : "SECURE LOGIN"}
        </h2>
        
        {error && <div style={{ background: "rgba(255,0,110,0.1)", color: "var(--neon-pink)", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", border: "1px solid rgba(255,0,110,0.3)" }}>{error}</div>}
        {msg && <div style={{ background: "rgba(0,255,148,0.1)", color: "var(--neon-green)", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", border: "1px solid rgba(0,255,148,0.3)" }}>{msg}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {isRegistering && !isResetting && (
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Full Name / Company *</label>
              <input required type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px" }} />
            </div>
          )}

          <div>
            <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Email Address *</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px" }} />
          </div>

          {!isResetting && (
            <div>
              <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Password *</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px" }} />
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "14px", borderRadius: "8px", fontSize: "15px", marginTop: "12px", opacity: loading ? 0.7 : 1 }}>
            {loading ? "PROCESSING..." : isResetting ? "SEND RESET LINK" : isRegistering ? "CREATE ACCOUNT" : "LOG IN"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {!isResetting && (
             <button onClick={() => { setIsResetting(true); setIsRegistering(false); setError(""); setMsg(""); }} style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "12px" }}>
               Forgot your password?
             </button>
          )}

          <div>
            <span style={{ fontSize: "13px", color: "var(--text-dim)" }}>
              {isRegistering || isResetting ? "Already have an account? " : "New client? "}
            </span>
            <button onClick={() => { setIsRegistering(!isRegistering); setIsResetting(false); setError(""); setMsg(""); }} style={{ background: "transparent", border: "none", color: "var(--orange)", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
              {isRegistering || isResetting ? "Log in here" : "Register here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}