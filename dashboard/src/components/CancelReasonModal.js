"use client";
import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import api from "@/lib/api";

const CANCEL_REASONS = [
  "Customer request",
  "Wrong order / bot error",
  "Item out of stock",
  "Delivery not possible",
  "Duplicate order",
  "Other",
];

export default function CancelReasonModal({ order, onClose, onCancelled }) {
  const [reason, setReason]   = useState(CANCEL_REASONS[0]);
  const [custom, setCustom]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  if (!order) return null;

  const finalReason = reason === "Other" ? custom.trim() : reason;

  const handleCancel = async () => {
    if (reason === "Other" && !custom.trim()) {
      setError("Reason likhna zaroori hai.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/orders/${order.id}/cancel`, { cancel_reason: finalReason });
      onCancelled?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "Cancel failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="cancel-modal-overlay"
      onClick={(e) => e.target.id === "cancel-modal-overlay" && onClose?.()}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%", maxWidth: "420px",
          padding: "28px",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AlertTriangle size={18} style={{ color: "#f87171" }} />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>Cancel Order</h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                {order.order_number || `#${order.id}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: "6px", minWidth: 0 }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "14px",
            background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#f87171", fontSize: "0.8125rem",
          }}>{error}</div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label style={{
            display: "block", fontSize: "0.75rem", fontWeight: "600",
            color: "var(--text-secondary)", marginBottom: "8px",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            Cancellation Reason
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {CANCEL_REASONS.map((r) => (
              <label
                key={r}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 14px", borderRadius: "8px", cursor: "pointer",
                  background: reason === r ? "rgba(239, 68, 68, 0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${reason === r ? "rgba(239, 68, 68, 0.25)" : "var(--border)"}`,
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  style={{ accentColor: "#ef4444" }}
                />
                <span style={{ fontSize: "0.875rem" }}>{r}</span>
              </label>
            ))}
          </div>
        </div>

        {reason === "Other" && (
          <div style={{ marginBottom: "14px" }}>
            <input
              className="input"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Reason likhein..."
              autoFocus
            />
          </div>
        )}

        <p style={{
          fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "20px",
          padding: "10px 12px", borderRadius: "8px",
          background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
        }}>
          ⚠️ Customer ko WhatsApp pe cancel notification jaayega.
        </p>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>
            Back
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="btn btn-danger"
            style={{ flex: 2, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? <Loader2 size={16} /> : <AlertTriangle size={16} />}
            {saving ? "Cancelling..." : "Confirm Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
