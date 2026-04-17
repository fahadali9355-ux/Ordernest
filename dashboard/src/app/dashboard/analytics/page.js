"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ShoppingBag, ShoppingCart, DollarSign, Trophy } from "lucide-react";

const STAT_CARDS = [
  { key: "total_orders", label: "Total Orders", icon: ShoppingBag, accent: "violet", format: (v) => v ?? 0 },
  { key: "today_orders", label: "Today's Orders", icon: ShoppingCart, accent: "blue", format: (v) => v ?? 0 },
  { key: "revenue", label: "Revenue", icon: DollarSign, accent: "emerald", format: (v) => `Rs ${Number(v || 0).toLocaleString()}` },
  { key: "top_product", label: "Top Product", icon: Trophy, accent: "amber", format: (v) => v || "—" },
];

export default function Analytics() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/stats")
      .then((res) => setStats(res.data))
      .catch((err) => console.error("Stats fetch failed:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "4px" }}>Analytics</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Your business at a glance
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
          Loading analytics...
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "16px",
        }}>
          {STAT_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className={`glass-card stat-card ${card.accent}`}
                style={{
                  padding: "24px",
                  animation: `fadeIn 0.4s ease ${i * 0.08}s both`,
                }}
              >
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: "16px",
                }}>
                  <span style={{
                    fontSize: "0.8125rem",
                    fontWeight: "500",
                    color: "var(--text-secondary)",
                  }}>{card.label}</span>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.05)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={18} style={{ color: "var(--text-secondary)" }} />
                  </div>
                </div>
                <div style={{
                  fontSize: card.key === "top_product" ? "1.125rem" : "1.75rem",
                  fontWeight: "800",
                  letterSpacing: "-0.02em",
                }}>
                  {card.format(stats[card.key])}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
