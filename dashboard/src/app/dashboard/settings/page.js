"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Settings, Phone, Key, Hash, Save, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function SettingsPage() {
  const [form, setForm] = useState({ wa_phone: "", wa_phone_id: "", wa_token: "" });
  const [info, setInfo]   = useState(null); // shop info
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // {type: 'success'|'error', msg}
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/me")
      .then(r => {
        const d = r.data;
        setInfo(d);
        setForm({
          wa_phone:    d.wa_phone    || "",
          wa_phone_id: d.wa_phone_id || "",
          wa_token:    "",  // never prefill token for security
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus(null);
    setSaving(true);
    try {
      await api.patch("/auth/profile", form);
      setStatus({ type: "success", msg: "Settings save ho gayi! Ab bot naya token use karega." });
      setForm(f => ({ ...f, wa_token: "" })); // clear token field after save
    } catch (err) {
      setStatus({ type: "error", msg: err.response?.data?.error || "Save failed. Try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <RefreshCw size={32} className="spin" style={{ color: "#7c3aed" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: "600px", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Settings size={22} style={{ color: "#a855f7" }} />
          <h1 style={{ fontSize: "1.375rem", fontWeight: "700", margin: 0 }}>Shop Settings</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
          WhatsApp credentials update karo — especially jab token expire ho jaye
        </p>
      </div>

      {/* Shop Info Card */}
      {info && (
        <div className="glass-card" style={{ padding: "16px 20px", marginBottom: "20px", borderLeft: "3px solid #7c3aed" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: "600", letterSpacing: "0.05em" }}>YOUR SHOP</div>
          <div style={{ fontSize: "1rem", fontWeight: "600", color: "var(--text-primary)" }}>{info.name}</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{info.email}</div>
        </div>
      )}

      {/* Token Expiry Warning */}
      <div style={{
        padding: "12px 16px", borderRadius: "10px", marginBottom: "20px",
        background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)",
        display: "flex", gap: "10px", alignItems: "flex-start",
      }}>
        <AlertCircle size={16} style={{ color: "#f59e0b", marginTop: "2px", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: "0.8125rem", fontWeight: "600", color: "#f59e0b", marginBottom: "3px" }}>
            Token Expire Hone Par Kya Karo
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
            Meta temporary tokens ~24-60 hours mein expire ho jate hain. Jab bot reply karna band kare:
            Meta Console → API Setup → "Generate access token" → naya token yahan paste karo → Save.
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="glass-card" style={{ padding: "24px" }}>

        {status && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "18px",
            display: "flex", alignItems: "center", gap: "8px",
            background: status.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${status.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: status.type === "success" ? "#34d399" : "#f87171",
            fontSize: "0.8125rem",
          }}>
            <CheckCircle size={15} />
            {status.msg}
          </div>
        )}

        {/* WA Phone */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
            WhatsApp Business Number
          </label>
          <div style={{ position: "relative" }}>
            <Phone size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input className="input" value={form.wa_phone} onChange={update("wa_phone")} placeholder="923001234567" style={{ paddingLeft: "36px" }} />
          </div>
        </div>

        {/* Phone ID */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
            Phone Number ID <span style={{ color: "var(--text-secondary)", fontWeight: "400" }}>(from Meta)</span>
          </label>
          <div style={{ position: "relative" }}>
            <Hash size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input className="input" value={form.wa_phone_id} onChange={update("wa_phone_id")} placeholder="1101693923025862" style={{ paddingLeft: "36px" }} />
          </div>
        </div>

        {/* Access Token */}
        <div style={{ marginBottom: "22px" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "6px" }}>
            New Access Token{" "}
            <span style={{ color: "#f59e0b", fontWeight: "400", fontSize: "0.75rem" }}>← sirf tabhi bharo jab update karna ho</span>
          </label>
          <div style={{ position: "relative" }}>
            <Key size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input
              className="input" type="password"
              value={form.wa_token} onChange={update("wa_token")}
              placeholder="Naya token yahan paste karo..."
              style={{ paddingLeft: "36px" }}
            />
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "5px" }}>
            Khali chhodo agar token change nahi karna
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}
          style={{ width: "100%", padding: "11px", fontWeight: "600", opacity: saving ? 0.7 : 1 }}>
          {saving
            ? <><RefreshCw size={15} className="spin" /> Saving...</>
            : <><Save size={15} /> Save Settings</>}
        </button>
      </form>
    </div>
  );
}
