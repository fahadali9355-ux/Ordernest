"use client";
import { useEffect, useState } from "react";
import { Shield, Store, Users, ShoppingBag, Activity, ToggleLeft, ToggleRight, AlertTriangle, Loader2 } from "lucide-react";

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function AdminPanel() {
  const [shops, setShops]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [secret, setSecret]     = useState("");
  const [authed, setAuthed]     = useState(false);
  const [error, setError]       = useState("");
  const [toggling, setToggling] = useState(null);

  const fetchShops = async (s) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api-proxy/admin/shops", {
        headers: { "x-admin-secret": s },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unauthorized");
      }
      setShops(await res.json());
      setAuthed(true);
    } catch (err) {
      setError(err.message || "Access denied");
    } finally {
      setLoading(false);
    }
  };

  // Direct API call (assuming backend at port 3000)
  const fetchShopsDirect = async (s) => {
    setLoading(true);
    setError("");
    try {
      const BASE =  "https://ordernest-production-2671.up.railway.app";
      const res = await fetch(`${BASE}/admin/shops`, {
        headers: { "x-admin-secret": s },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unauthorized — wrong secret");
      }
      setShops(await res.json());
      setAuthed(true);
    } catch (err) {
      setError(err.message || "Access denied");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!secret.trim()) { setError("Secret key daalo."); return; }
    fetchShopsDirect(secret.trim());
  };

  const toggleShop = async (shopId, currentActive) => {
    setToggling(shopId);
    try {
      const BASE = "https://ordernest-production-2671.up.railway.app";
      const res = await fetch(`${BASE}/admin/shops/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (res.ok) {
        setShops((prev) => prev.map((s) => s.id === shopId ? { ...s, is_active: !currentActive } : s));
      }
    } catch {}
    setToggling(null);
  };

  const activeCount = shops.filter((s) => s.is_active).length;
  const totalOrders = shops.reduce((sum, s) => sum + Number(s.total_orders || 0), 0);

  if (!authed) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.12) 0%, #0a0a0f 60%)",
        padding: "20px",
      }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "56px", height: "56px", borderRadius: "14px",
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              marginBottom: "16px", boxShadow: "0 4px 24px rgba(124,58,237,0.35)",
            }}>
              <Shield size={28} color="white" />
            </div>
            <h1 style={{
              fontSize: "1.5rem", fontWeight: "700", marginBottom: "6px",
              background: "linear-gradient(135deg, #f0f0f5, #a0a0b5)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Admin Panel</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              OrderBot Super Admin
            </p>
          </div>

          <form onSubmit={handleLogin} className="glass-card" style={{ padding: "28px" }}>
            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: "8px", marginBottom: "16px",
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171", fontSize: "0.8125rem", display: "flex", gap: "8px",
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                {error}
              </div>
            )}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "500", color: "var(--text-secondary)", marginBottom: "8px" }}>
                Admin Secret Key
              </label>
              <input
                className="input"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary"
              style={{ width: "100%", padding: "12px", fontWeight: "600", opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 size={16} /> : <Shield size={16} />}
              {loading ? "Verifying..." : "Access Panel"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#0a0a0f" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <Shield size={22} style={{ color: "#a855f7" }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700" }}>Admin Control Panel</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          All shops on the platform
        </p>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px", marginBottom: "28px" }}>
        {[
          { label: "Total Shops", value: shops.length, icon: Store, color: "#a855f7" },
          { label: "Active Shops", value: activeCount, icon: Activity, color: "#34d399" },
          { label: "Total Customers", value: shops.reduce((s, sh) => s + Number(sh.total_customers || 0), 0), icon: Users, color: "#60a5fa" },
          { label: "Total Orders",   value: totalOrders, icon: ShoppingBag, color: "#fbbf24" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <stat.icon size={16} style={{ color: stat.color }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: "800" }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Shops Table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: "600" }}>All Shops</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Shop", "Email", "WhatsApp", "Orders (Today)", "Customers", "Joined", "Status"].map((h) => (
                  <th key={h} style={{
                    padding: "12px 16px", textAlign: "left",
                    fontSize: "0.75rem", fontWeight: "600",
                    color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shops.map((shop, i) => (
                <tr key={shop.id} style={{
                  borderBottom: i < shops.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  opacity: shop.is_active ? 1 : 0.55,
                  transition: "opacity 0.2s",
                }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: "600", fontSize: "0.9375rem" }}>{shop.name || "—"}</div>
                    <div style={{ fontSize: "0.75rem", color: "#a855f7" }}>#{shop.id}</div>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    {shop.email}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.8125rem" }}>
                    {shop.wa_phone || <span style={{ color: "var(--text-secondary)" }}>Not set</span>}
                    {shop.wa_phone_id && (
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                        ID: {shop.wa_phone_id.slice(0, 10)}...
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.875rem" }}>
                    <span style={{ fontWeight: "700" }}>{shop.total_orders}</span>
                    {Number(shop.today_orders) > 0 && (
                      <span style={{
                        marginLeft: "6px", fontSize: "0.75rem",
                        color: "#34d399", fontWeight: "600",
                      }}>
                        (+{shop.today_orders} today)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.875rem" }}>
                    {shop.total_customers}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                    {timeAgo(shop.created_at)}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <button
                      onClick={() => toggleShop(shop.id, shop.is_active)}
                      disabled={toggling === shop.id}
                      className={shop.is_active ? "btn btn-success" : "btn btn-danger"}
                      style={{ fontSize: "0.75rem", opacity: toggling === shop.id ? 0.6 : 1 }}
                    >
                      {toggling === shop.id ? (
                        <Loader2 size={13} />
                      ) : shop.is_active ? (
                        <><ToggleRight size={14} /> Active</>
                      ) : (
                        <><ToggleLeft size={14} /> Inactive</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {shops.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              No shops found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
