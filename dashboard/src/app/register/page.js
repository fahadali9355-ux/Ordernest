"use client";
import { useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Lock, Phone, Key, Hash, Zap } from "lucide-react";
import Link from "next/link";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    wa_phone: "",
    wa_phone_id: "",
    wa_token: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password || !form.name) {
      setError("Name, email and password are required");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      // Auto-login after register
      const loginRes = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
      });
      localStorage.setItem("token", loginRes.data.token);
      router.push("/dashboard/orders");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
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
        maxWidth: "480px",
        animation: "fadeIn 0.5s ease-out",
      }}>
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
        <form onSubmit={handleRegister} className="glass-card" style={{ padding: "28px" }}>
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "8px", marginBottom: "16px",
              background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#f87171", fontSize: "0.8125rem",
            }}>{error}</div>
          )}

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
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Password *
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
              <input className="input" type="password" value={form.password} onChange={update("password")} placeholder="••••••••" style={{ paddingLeft: "36px" }} />
            </div>
          </div>

          {/* Divider */}
          <div style={{
            borderTop: "1px solid var(--border)", margin: "20px 0", position: "relative",
          }}>
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
            💡 Yeh values Meta Developer Console se milegi. Baad mein bhi add kar sakte ho dashboard settings se.
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
            {loading ? "Creating..." : <><UserPlus size={18} /> Create Shop</>}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "16px", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#a855f7", textDecoration: "none", fontWeight: "500" }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
