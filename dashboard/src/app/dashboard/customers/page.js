"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { Users, Phone, ShoppingBag, Clock, Star, Search, ChevronDown, ChevronUp, Edit2, Check } from "lucide-react";

function timeAgo(dateStr) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CustomerCard({ customer, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [orders, setOrders]     = useState(null);
  const [editName, setEditName] = useState(false);
  const [name, setName]         = useState(customer.name || "");
  const [savingName, setSavingName] = useState(false);

  const isRegular = Number(customer.total_orders) >= 5;

  const loadOrders = async () => {
    if (orders) { setExpanded(!expanded); return; }
    try {
      const res = await api.get(`/customers/${customer.phone}`);
      setOrders(res.data.orders || []);
      setExpanded(true);
    } catch {}
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      await api.patch(`/customers/${customer.phone}`, { name });
      setEditName(false);
      onUpdated?.();
    } catch {}
    setSavingName(false);
  };

  return (
    <div className="glass-card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "18px 20px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "12px" }}>
          <div style={{
            width: "42px", height: "42px", borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.15))",
            border: "1px solid rgba(124,58,237,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            fontSize: "1rem", fontWeight: "700", color: "#a855f7",
          }}>
            {(customer.name || customer.phone).charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editName ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer name"
                  style={{ fontSize: "0.875rem", padding: "6px 10px" }}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                />
                <button onClick={saveName} disabled={savingName} className="btn btn-primary"
                  style={{ padding: "6px 10px", minWidth: 0 }}>
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{ fontWeight: "600", fontSize: "0.9375rem" }}>
                  {customer.name || "Unknown"}
                </span>
                {isRegular && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "3px",
                    fontSize: "0.6875rem", fontWeight: "700",
                    background: "rgba(245,158,11,0.15)", color: "#fbbf24",
                    border: "1px solid rgba(245,158,11,0.25)",
                    borderRadius: "9999px", padding: "2px 8px",
                  }}>
                    <Star size={10} />REGULAR
                  </span>
                )}
                <button
                  onClick={() => setEditName(true)}
                  className="btn btn-ghost"
                  style={{ padding: "3px 6px", minWidth: 0, opacity: 0.6 }}
                  title="Edit name"
                >
                  <Edit2 size={11} />
                </button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "3px" }}>
              <Phone size={12} style={{ color: "var(--text-secondary)" }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{customer.phone}</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <div style={{
            flex: 1, padding: "8px 10px", borderRadius: "8px",
            background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginBottom: "2px" }}>Orders</div>
            <div style={{ fontSize: "1.125rem", fontWeight: "700", color: "#a855f7" }}>
              {customer.total_orders || 0}
            </div>
          </div>
          <div style={{
            flex: 2, padding: "8px 12px", borderRadius: "8px",
            background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginBottom: "2px" }}>Last Order</div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Clock size={12} style={{ color: "var(--text-secondary)" }} />
              <span style={{ fontSize: "0.8125rem" }}>{timeAgo(customer.last_order_at)}</span>
            </div>
          </div>
          {customer.address && (
            <div style={{
              flex: 0, padding: "8px 10px", borderRadius: "8px",
              background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
              cursor: "help",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} title={customer.address}>
              📍
            </div>
          )}
        </div>

        {/* Toggle order history */}
        <button
          onClick={loadOrders}
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center", fontSize: "0.8125rem" }}
        >
          <ShoppingBag size={14} />
          Order History
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Order history */}
      {expanded && orders && (
        <div style={{
          borderTop: "1px solid var(--border)",
          background: "rgba(0,0,0,0.2)",
          maxHeight: "200px", overflowY: "auto",
        }}>
          {orders.length === 0 ? (
            <p style={{ padding: "16px 20px", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              No orders yet.
            </p>
          ) : (
            orders.map((o) => (
              <div key={o.id} style={{
                padding: "10px 20px", display: "flex",
                alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: "600", color: "#a855f7" }}>
                    {o.order_number || `#${o.id}`}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "8px" }}>
                    {timeAgo(o.created_at)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{
                    fontSize: "0.75rem", padding: "2px 8px", borderRadius: "9999px",
                    background: o.status === "CANCELLED" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                    color: o.status === "CANCELLED" ? "#f87171" : "#34d399",
                  }}>
                    {o.status}
                  </span>
                  <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>
                    Rs {Number(o.total_price || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get("/customers");
      setCustomers(res.data);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.name || "").toLowerCase().includes(q) || c.phone.includes(q);
  });

  const regularCount = customers.filter((c) => Number(c.total_orders) >= 5).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "4px" }}>Customers</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            {customers.length} total • {regularCount} regulars
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "24px" }}>
        <Search size={16} style={{
          position: "absolute", left: "12px", top: "50%",
          transform: "translateY(-50%)", color: "var(--text-secondary)",
        }} />
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          style={{ paddingLeft: "38px" }}
        />
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
          Loading customers...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "rgba(124,58,237,0.1)", margin: "0 auto 12px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={24} style={{ color: "#a855f7" }} />
          </div>
          <p style={{ color: "var(--text-secondary)" }}>
            {search ? "Koi customer nahi mila." : "WhatsApp orders aane par customers yahan dikhenge."}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
        {filtered.map((c, i) => (
          <div key={c.id || c.phone} style={{ animation: `fadeIn 0.3s ease ${i * 0.04}s both` }}>
            <CustomerCard customer={c} onUpdated={fetchCustomers} />
          </div>
        ))}
      </div>
    </div>
  );
}
