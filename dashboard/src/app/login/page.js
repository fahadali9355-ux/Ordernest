"use client";
import { useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Zap } from "lucide-react";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        }}>
          {error && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#f87171",
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
              <Mail size={16} style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-secondary)",
              }} />
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
            <label style={{
              display: "block",
              fontSize: "0.8125rem",
              fontWeight: "500",
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}>Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-secondary)",
              }} />
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingLeft: "36px" }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "0.9375rem",
              fontWeight: "600",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </form>

        <p style={{
          textAlign: "center",
          marginTop: "16px",
          fontSize: "0.8125rem",
          color: "var(--text-secondary)",
        }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "#a855f7", textDecoration: "none", fontWeight: "500" }}>Create Shop</Link>
        </p>
      </div>
    </div>
  );
}
