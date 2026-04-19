"use client";
import { useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Lock, Phone, Key, Hash, Zap, CheckCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function Register() {
  const [step, setStep] = useState(1); // 1 = Details, 2 = Verify OTP
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    wa_phone: "",
    wa_phone_id: "",
    wa_token: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [otpCode, setOtpCode] = useState("");
  
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password || !form.name) {
      return setError("Shop name, email aur password zaroori hain.");
    }
    if (form.password.length < 6) {
      return setError("Password kam az kam 6 characters ka hona chahiye.");
    }
    if (form.password !== confirmPassword) {
      return setError("Passwords match nahi kar rahay!");
    }
    
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email: form.email });
      setStep(2);
    } catch (err) {
      setError("Failed to send verification code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!otpCode || otpCode.length !== 6) {
      return setError("Enter the 6-digit verification code");
    }
    
    setLoading(true);
    try {
      await api.post("/auth/register", { ...form, otp_code: otpCode });

      // Show success state before redirect
      setSuccess(true);

      // Auto-login
      const loginRes = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
      });
      localStorage.setItem("token", loginRes.data.token);

      // Redirect after 1.5s so user sees success message
      setTimeout(() => {
        router.push("/dashboard/orders");
      }, 1500);

    } catch (err) {
      setStep(1); // Reset to first step if failed to register (e.g. invalid code)
      const msg = err.response?.data?.error || "Registration failed. Try again.";
      if (msg.includes("already exists") || err.response?.status === 409) {
        setError("Yeh email already registered hai. Login karo ya doosra email use karo.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── SUCCESS STATE ─────────────────────────────
  if (success) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.1) 0%, #0a0a0f 60%)",
        padding: "20px",
      }}>
        <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-out" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(16, 185, 129, 0.15)",
            border: "2px solid rgba(16, 185, 129, 0.4)",
            marginBottom: "20px",
            boxShadow: "0 0 40px rgba(16, 185, 129, 0.2)",
          }}>
            <CheckCircle size={36} style={{ color: "#34d399" }} />
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "8px", color: "#34d399" }}>
            Shop Successfully Bana! 🎉
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", marginBottom: "6px" }}>
            <strong style={{ color: "var(--text-primary)" }}>{form.name}</strong> register ho gaya.
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Dashboard mein redirect ho raha hai...
          </p>
          <div style={{
            marginTop: "20px", display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "8px 16px", borderRadius: "9999px",
            background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)",
            fontSize: "0.8125rem", color: "#34d399",
          }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#34d399",
              animation: "pulse-glow 1.5s infinite",
            }} />
            Auto-login ho raha hai...
          </div>
        </div>
      </div>
    );
  }

  // ── REGISTER FORM ─────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.12) 0%, #0a0a0f 60%)",
      padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: "480px", animation: "fadeIn 0.5s ease-out" }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "56px", height: "56px", borderRadius: "14px",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            marginBottom: "16px",
            boxShadow: "0 4px 24px rgba(124, 58, 237, 0.35)",
          }}>
            <Zap size={28} color="white" />
          </div>
          <h1 style={{
            fontSize: "1.75rem", fontWeight: "700", marginBottom: "6px",
            background: "linear-gradient(135deg, #f0f0f5, #a0a0b5)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Create Your Shop</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Register and connect your WhatsApp number
          </p>
        </div>

        {/* Register Card */}
        <div className="glass-card" style={{ padding: "28px" }}>
          
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "8px", marginBottom: "16px",
              background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#f87171", fontSize: "0.8125rem",
            }}>{error}</div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOtp}>
              {/* Shop Name */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Shop Name *
                </label>
                <input className="input" value={form.name} onChange={update("name")} placeholder="Ali's Burger Shop" />
              </div>

              {/* Email */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Email *
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                  <input className="input" type="email" value={form.email} onChange={update("email")} placeholder="you@example.com" style={{ paddingLeft: "36px" }} />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Password * (min 6 characters)
                </label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                  <input className="input" type={showPassword ? "text" : "password"} value={form.password} onChange={update("password")} placeholder="••••••••" style={{ paddingLeft: "36px", paddingRight: "36px" }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Confirm Password *
                </label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                  <input className="input" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} placeholder="••••••••" style={{ paddingLeft: "36px", paddingRight: "36px" }} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}>
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* WhatsApp Divider */}
              <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0", position: "relative" }}>
                <span style={{
                  position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)",
                  background: "var(--bg-primary)", padding: "0 12px",
                  fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "500",
                }}>WHATSAPP SETUP (Optional)</span>
              </div>

              <p style={{
                fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "14px",
                lineHeight: "1.5", padding: "8px 12px", borderRadius: "8px",
                background: "rgba(124, 58, 237, 0.06)", border: "1px solid rgba(124, 58, 237, 0.15)",
              }}>
                💡 Yeh values Meta Developer Console se milegi. Baad mein bhi add kar sakte ho.
              </p>

              {/* WhatsApp Phone */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  WhatsApp Number (with country code)
                </label>
                <div style={{ position: "relative" }}>
                  <Phone size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                  <input className="input" value={form.wa_phone} onChange={update("wa_phone")} placeholder="923001234567" style={{ paddingLeft: "36px" }} />
                </div>
              </div>

              {/* Phone ID */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Phone Number ID (from Meta)
                </label>
                <div style={{ position: "relative" }}>
                  <Hash size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                  <input className="input" value={form.wa_phone_id} onChange={update("wa_phone_id")} placeholder="1101693923025862" style={{ paddingLeft: "36px" }} />
                </div>
              </div>

              {/* WA Token */}
              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Access Token (from Meta)
                </label>
                <div style={{ position: "relative" }}>
                  <Key size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                  <input className="input" type="password" value={form.wa_token} onChange={update("wa_token")} placeholder="EAAxxxxxxx..." style={{ paddingLeft: "36px" }} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{ width: "100%", padding: "12px", fontSize: "0.9375rem", fontWeight: "600", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Sending Code..." : "Next Step"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <Mail size={32} color="#a855f7" style={{ margin: "0 auto 10px auto" }} />
                <h2 style={{ color: 'white', fontSize: '1.25rem' }}>Verify Email</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "10px" }}>
                   We sent a 6-digit code to <strong>{form.email}</strong>.
                </p>
              </div>

              <div style={{ marginBottom: "22px" }}>
                 <input className="input" type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="------" maxLength={6} style={{ textAlign: "center", letterSpacing: "8px", fontSize: "1.5rem" }} />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setStep(1)} className="btn" style={{ padding: "12px", background: "var(--bg-secondary)", flex: 1, border: "1px solid var(--border)", color: "white" }}>
                  Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, padding: "12px", fontSize: "0.9375rem", fontWeight: "600" }}>
                  {loading ? "Creating Shop..." : <><UserPlus size={18} /> Finish & Register</>}
                </button>
              </div>
            </form>
          )}

        </div>

        <p style={{ textAlign: "center", marginTop: "16px", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#a855f7", textDecoration: "none", fontWeight: "500" }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
