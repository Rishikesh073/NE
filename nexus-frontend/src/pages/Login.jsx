import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, ADMIN_EMAILS } from "../contexts/AuthContext";

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isPhoneLogin, setIsPhoneLogin] = useState(false);
  const [isPhoneOtp, setIsPhoneOtp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  const { login, registerClient, resetPassword, loginWithGoogle, setupRecaptcha, loginWithPhone, handlePhoneLoginSuccess } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setError(""); setMsg(""); setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (ADMIN_EMAILS.includes(result.user.email)) navigate("/admin");
      else navigate("/client");
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
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

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError(""); setMsg(""); setLoading(true);

    try {
      if (isPhoneOtp) {
        const result = await confirmationResult.confirm(otp);
        const user = result.user;
        await handlePhoneLoginSuccess(user);
        if (ADMIN_EMAILS.includes(user.email || user.phoneNumber)) navigate("/admin");
        else navigate("/client");
      } else {
        const appVerifier = setupRecaptcha('recaptcha-verifier');
        // Add default country code if missing
        const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;
        const confirmation = await loginWithPhone(formattedPhone, appVerifier);
        setConfirmationResult(confirmation);
        setIsPhoneOtp(true);
        setMsg("OTP sent to your phone. Please enter it below.");
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
      if (err.message.includes("auth/invalid-verification-code")) {
        setMsg("Invalid OTP. Try again.");
      }
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then(widgetId => window.grecaptcha.reset(widgetId));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--black)", padding: "20px" }}>
      <div className="card-hover" style={{ padding: "40px", borderRadius: "16px", background: "var(--card)", maxWidth: "400px", width: "100%" }}>

        <button
          className="btn-ghost"
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", marginBottom: "24px", width: "fit-content" }}
        >
          ← Back to Home
        </button>

        <div style={{ width: "48px", height: "48px", background: "var(--orange)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: "28px", color: "white", margin: "0 auto 24px" }}>N</div>

        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: "32px", letterSpacing: "0.05em", marginBottom: "8px", textAlign: "center" }}>
          {isPhoneLogin
            ? (isPhoneOtp ? "ENTER OTP" : "PHONE LOGIN")
            : isResetting ? "RESET PASSWORD" : isRegistering ? "CLIENT REGISTRATION" : "SECURE LOGIN"}
        </h2>

        {error && <div style={{ background: "rgba(255,0,110,0.1)", color: "var(--neon-pink)", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", border: "1px solid rgba(255,0,110,0.3)" }}>{error}</div>}
        {msg && <div style={{ background: "rgba(0,255,148,0.1)", color: "var(--neon-green)", padding: "12px", borderRadius: "8px", fontSize: "13px", marginBottom: "20px", border: "1px solid rgba(0,255,148,0.3)" }}>{msg}</div>}

        {isPhoneLogin ? (
          <form onSubmit={handlePhoneSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!isPhoneOtp ? (
              <div>
                <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Phone Number *</label>
                <input required type="tel" placeholder="+1234567890" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px" }} />
              </div>
            ) : (
              <div>
                <label style={{ fontSize: "11px", color: "var(--text-dimmer)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>OTP *</label>
                <input required type="text" placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px" }} />
              </div>
            )}

            <div id="recaptcha-verifier"></div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "14px", borderRadius: "8px", fontSize: "15px", marginTop: "12px", opacity: loading ? 0.7 : 1 }}>
              {loading ? "PROCESSING..." : isPhoneOtp ? "VERIFY OTP" : "SEND OTP"}
            </button>
            <button type="button" onClick={() => { setIsPhoneLogin(false); setIsPhoneOtp(false); setError(""); setMsg(""); }} style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "12px", marginTop: "8px" }}>
              Back to Email Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

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
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          <span style={{ fontSize: "11px", color: "var(--text-dimmer)", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono'" }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        </div>

        {/* Google & Phone Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {!isPhoneLogin && (
            <button
              onClick={() => { setIsPhoneLogin(true); setError(""); setMsg(""); }}
              disabled={loading}
              style={{
                width: "100%", padding: "13px", borderRadius: "8px", fontSize: "14px",
                background: "var(--black3)", border: "1px solid var(--border)",
                color: "var(--text)", cursor: "pointer", fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                transition: "all 0.2s ease", letterSpacing: "0.05em"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--orange)"; e.currentTarget.style.background = "rgba(255,85,0,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--black3)"; }}
            >
              ☎ CONTINUE WITH PHONE
            </button>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "13px", borderRadius: "8px", fontSize: "14px",
              background: "var(--black3)", border: "1px solid var(--border)",
              color: "var(--text)", cursor: "pointer", fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              transition: "all 0.2s ease", letterSpacing: "0.05em"
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--orange)"; e.currentTarget.style.background = "rgba(255,85,0,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--black3)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            CONTINUE WITH GOOGLE
          </button>
        </div>

        {!isPhoneLogin && (
          <div style={{ textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "20px", marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
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
        )}
      </div>
    </div>
  );
}