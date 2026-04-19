"use client";
import { useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Zap, Eye, EyeOff, KeyRound } from "lucide-react";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Forgot password flow states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      router.push("/dashboard/orders");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendForgotPasswordOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!forgotEmail) return setError("Please enter your email");
    
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email: forgotEmail });
      setForgotStep(2);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!forgotOtp) return setForgotError("Enter the 6-digit code");
    setForgotLoading(true); setForgotError("");
    try {
      const res = await api.post("/auth/verify-otp", { email: forgotEmail, code: forgotOtp });
      setForgotToken(res.data.resetToken);
      setForgotStep(3);
    } catch (err) {
      setForgotError("Invalid code");
    } finally { setForgotLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!forgotNewPassword) return setForgotError("Enter new password");
    setForgotLoading(true); setForgotError("");
    try {
      await api.post("/auth/reset-password", { resetToken: forgotToken, newPassword: forgotNewPassword });
      setShowForgotModal(false);
      setForgotStep(1);
      setError("Password updated! You can now login."); // Show as success
    } catch (err) {
      setForgotError("Failed to reset. Try again.");
    } finally { setForgotLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.12) 0%, #0a0a0f 60%)",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        animation: "fadeIn 0.5s ease-out",
      }}>
        {/* Logo/Brand */}
        <div style={{
          textAlign: "center",
          marginBottom: "32px",
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            marginBottom: "16px",
            boxShadow: "0 4px 24px rgba(124, 58, 237, 0.35)",
          }}>
            <Zap size={28} color="white" />
          </div>
          <h1 style={{
            fontSize: "1.75rem",
            fontWeight: "700",
            marginBottom: "6px",
            background: "linear-gradient(135deg, #f0f0f5, #a0a0b5)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>OrderBot</h1>
          <p style={{
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
          }}>Sign in to your dashboard</p>
        </div>

        {/* Login Card */}
        <form onSubmit={handleLogin} className="glass-card" style={{
          padding: "32px",
          position: "relative"
        }}>
          {error && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: error.includes("updated") ? "rgba(16,185,129,0.1)" : "rgba(239, 68, 68, 0.1)",
              border: `1px solid ${error.includes("updated") ? "rgba(16,185,129,0.25)" :"rgba(239, 68, 68, 0.25)"}`,
              color: error.includes("updated") ? "#34d399" : "#f87171",
              fontSize: "0.8125rem",
              marginBottom: "20px",
              animation: "fadeIn 0.3s ease",
            }}>{error}</div>
          )}

          <div style={{ marginBottom: "18px" }}>
            <label style={{
              display: "block",
              fontSize: "0.8125rem",
              fontWeight: "500",
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}>Email</label>
            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ paddingLeft: "36px" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
               <label style={{ fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)" }}>Password</label>
               <button 
                 type="button" 
                 onClick={() => setShowForgotModal(true)}
                 style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: '0.75rem', cursor: 'pointer', outline: 'none' }}
               >
                 Forgot?
               </button>
            </div>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
              <input
                className="input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingLeft: "36px", paddingRight: "36px" }}
              />
              <button 
                 type="button"
                 onClick={() => setShowPassword(!showPassword)}
                 style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}
              >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", padding: "12px", fontSize: "0.9375rem", fontWeight: "600", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <span>Signing in...</span> : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "16px", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          Don&apos;t have an account? <Link href="/register" style={{ color: "#a855f7", textDecoration: "none", fontWeight: "500" }}>Create Shop</Link>
        </p>

        {/* FORGOT PASSWORD MODAL */}
        {showForgotModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
          }}>
             <div className="glass-card" style={{ padding: "32px", width: "100%", maxWidth: "400px", position: "relative" }}>
                 <button onClick={() => setShowForgotModal(false)} style={{ position: "absolute", top: 15, right: 15, background: "none", border: "none", color: "white", fontSize: "1.2rem", cursor: "pointer" }}>×</button>
                 
                 <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <KeyRound size={32} color="#a855f7" style={{ margin: "0 auto 10px auto" }} />
                    <h2 style={{ color: 'white', fontSize: '1.25rem' }}>Reset Password</h2>
                 </div>

                 {forgotError && <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '10px', textAlign: 'center' }}>{forgotError}</div>}

                 {forgotStep === 1 && (
                   <div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '15px', textAlign: 'center' }}>Enter your email to receive a secure recovery code.</p>
                      <input className="input" type="email" placeholder="Email Address" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} style={{ marginBottom: "15px" }} />
                      <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSendOtp} disabled={forgotLoading}>{forgotLoading ? "Sending..." : "Send Code"}</button>
                   </div>
                 )}

                 {forgotStep === 2 && (
                   <div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '15px', textAlign: 'center' }}>Check your email inbox for the 6-digit code.</p>
                      <input className="input" type="text" placeholder="------" style={{ textAlign: "center", letterSpacing: "5px", fontSize: "1.2rem", marginBottom: "15px" }} value={forgotOtp} onChange={e=>setForgotOtp(e.target.value)} maxLength={6} />
                      <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleVerifyOtp} disabled={forgotLoading}>{forgotLoading ? "Verifying..." : "Verify Code"}</button>
                   </div>
                 )}

                 {forgotStep === 3 && (
                   <div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '15px', textAlign: 'center' }}>Set your new password.</p>
                      <div style={{ position: "relative" }}>
                        <input className="input" type={showPassword ? "text" : "password"} placeholder="New Password" value={forgotNewPassword} onChange={e=>setForgotNewPassword(e.target.value)} style={{ marginBottom: "15px", paddingRight: "36px" }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "20px", transform: "translateY(-50%)", color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}>
                           {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleResetPassword} disabled={forgotLoading}>{forgotLoading ? "Saving..." : "Update Password"}</button>
                   </div>
                 )}
             </div>
          </div>
        )}

      </div>
    </div>
  );
}
