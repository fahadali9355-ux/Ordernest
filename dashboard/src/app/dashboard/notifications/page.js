"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bell, CheckCheck, AlertTriangle, ShoppingBag, XCircle } from "lucide-react";

function getNotifIcon(msg) {
  if (!msg) return Bell;
  const lower = msg.toLowerCase();
  if (lower.includes("low stock")) return AlertTriangle;
  if (lower.includes("new order")) return ShoppingBag;
  if (lower.includes("failed")) return XCircle;
  return Bell;
}

function getNotifAccent(msg) {
  if (!msg) return { bg: "rgba(124, 58, 237, 0.1)", color: "#a855f7", border: "rgba(124, 58, 237, 0.2)" };
  const lower = msg.toLowerCase();
  if (lower.includes("low stock"))  return { bg: "rgba(245, 158, 11, 0.1)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.2)" };
  if (lower.includes("new order"))  return { bg: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "rgba(16, 185, 129, 0.2)" };
  if (lower.includes("failed"))    return { bg: "rgba(239, 68, 68, 0.1)", color: "#f87171", border: "rgba(239, 68, 68, 0.2)" };
  return { bg: "rgba(124, 58, 237, 0.1)", color: "#a855f7", border: "rgba(124, 58, 237, 0.2)" };
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Notifications() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/notifications")
      .then((res) => setData(res.data))
      .catch((err) => console.error("Notifs failed:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "28px",
      }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "4px" }}>Notifications</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            {data.length} alerts
          </p>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
          Loading notifications...
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "rgba(124, 58, 237, 0.1)", margin: "0 auto 12px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CheckCheck size={24} style={{ color: "#a855f7" }} />
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            All clear! No notifications yet.
          </p>
        </div>
      )}

      {/* Notification Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {data.map((n, i) => {
          const Icon = getNotifIcon(n.message);
          const accent = getNotifAccent(n.message);
          return (
            <div
              key={n.id}
              className="glass-card"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
              }}
            >
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: accent.bg, border: `1px solid ${accent.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={16} style={{ color: accent.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.875rem", lineHeight: "1.5", marginBottom: "4px" }}>
                  {n.message}
                </p>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {timeAgo(n.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
