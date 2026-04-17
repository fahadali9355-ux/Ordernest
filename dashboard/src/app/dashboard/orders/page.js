"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import {
  RefreshCw, Phone, Clock, ChevronRight,
  MapPin, CreditCard, User, Edit2, Package,
} from "lucide-react";
import OrderEditModal from "@/components/OrderEditModal";
import CancelReasonModal from "@/components/CancelReasonModal";

const STATUS_CONFIG = {
  PENDING:    { label: "Pending",    bg: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "rgba(107,114,128,0.3)" },
  CONFIRMED:  { label: "Confirmed",  bg: "rgba(59,130,246,0.15)",  color: "#60a5fa", border: "rgba(59,130,246,0.3)" },
  NEW:        { label: "New",        bg: "rgba(168,85,247,0.15)",  color: "#c084fc", border: "rgba(168,85,247,0.3)" },
  PROCESSING: { label: "Processing", bg: "rgba(245,158,11,0.15)",  color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
  DISPATCHED: { label: "Dispatched", bg: "rgba(99,102,241,0.15)",  color: "#818cf8", border: "rgba(99,102,241,0.3)" },
  DELIVERED:  { label: "Delivered",  bg: "rgba(16,185,129,0.15)",  color: "#34d399", border: "rgba(16,185,129,0.3)" },
  COMPLETED:  { label: "Completed",  bg: "rgba(16,185,129,0.15)",  color: "#34d399", border: "rgba(16,185,129,0.3)" },
  CANCELLED:  { label: "Cancelled",  bg: "rgba(239,68,68,0.15)",   color: "#f87171", border: "rgba(239,68,68,0.3)" },
};

const LOCKED = ["DISPATCHED", "DELIVERED", "COMPLETED", "CANCELLED"];

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className="status-badge" style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: config.color, display: "inline-block" }} />
      {config.label}
    </span>
  );
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

function nextAction(status) {
  switch (status) {
    case "PENDING": case "CONFIRMED": case "NEW":
      return { label: "Process", next: "PROCESSING", className: "btn btn-warning" };
    case "PROCESSING":
      return { label: "Dispatch 🚚", next: "DISPATCHED", className: "btn btn-primary" };
    case "DISPATCHED":
      return { label: "Delivered ✅", next: "DELIVERED", className: "btn btn-success" };
    default: return null;
  }
}

// Cached item store
const itemCache = {};

export default function Orders() {
  const [orders, setOrders]         = useState([]);
  const [orderItems, setOrderItems] = useState({}); // order_id → items[]
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState(null);
  const [editOrder, setEditOrder]   = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get("/dashboard/orders");
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch items for each order (cached)
  const fetchItemsForOrders = useCallback(async (orders) => {
    const missing = orders.filter((o) => !itemCache[o.id]);
    await Promise.allSettled(
      missing.map(async (o) => {
        try {
          const res = await api.get(`/orders/${o.id}/items`);
          itemCache[o.id] = res.data;
        } catch { /* ignore */ }
      })
    );
    setOrderItems({ ...itemCache });
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    if (orders.length > 0) fetchItemsForOrders(orders);
  }, [orders, fetchItemsForOrders]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.patch(`/orders/${id}/status`, { status });
      // Invalidate cache for this order
      delete itemCache[id];
      await fetchOrders();
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setUpdating(null);
    }
  };

  const handleSaved = () => {
    // Bust cache for edited order
    if (editOrder) delete itemCache[editOrder.id];
    fetchOrders();
  };

  const handleCancelled = () => {
    if (cancelOrder) delete itemCache[cancelOrder.id];
    fetchOrders();
  };

  // Format items summary
  const formatItems = (orderId) => {
    const items = orderItems[orderId];
    if (!items || items.length === 0) return null;
    return items.map((it) => `${it.quantity}x ${it.product_name}`).join(", ");
  };

  return (
    <div>
      {/* Modals */}
      {editOrder && (
        <OrderEditModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={handleSaved}
        />
      )}
      {cancelOrder && (
        <CancelReasonModal
          order={cancelOrder}
          onClose={() => setCancelOrder(null)}
          onCancelled={handleCancelled}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "4px" }}>Live Orders</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            {orders.length} total orders • Auto-refreshing every 5s
          </p>
        </div>
        <button onClick={fetchOrders} className="btn btn-ghost">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Loading orders...
        </div>
      )}

      {/* Empty State */}
      {!loading && orders.length === 0 && (
        <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "rgba(124, 58, 237, 0.1)", margin: "0 auto 12px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "1.5rem" }}>📦</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            No orders yet. WhatsApp orders will appear here in real-time.
          </p>
        </div>
      )}

      {/* Orders Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
        {orders.map((order, i) => {
          const action = nextAction(order.status);
          const isLocked = LOCKED.includes(order.status);
          const items = formatItems(order.id);

          return (
            <div
              key={order.id}
              className="glass-card"
              style={{ padding: "20px", animation: `fadeIn 0.3s ease ${i * 0.04}s both` }}
            >
              {/* Top Row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: "700", color: "#a855f7" }}>
                  {order.order_number || `#${order.id}`}
                </span>
                <StatusBadge status={order.status} />
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                {/* Customer */}
                {(order.customer_name) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <User size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.875rem", fontWeight: "500" }}>{order.customer_name}</span>
                  </div>
                )}
                {/* Phone */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Phone size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.875rem" }}>{order.customer_phone || order.phone || "N/A"}</span>
                </div>
                {/* Address */}
                {order.address && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <MapPin size={13} style={{ color: "var(--text-secondary)", flexShrink: 0, marginTop: "2px" }} />
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                      {order.address}
                    </span>
                  </div>
                )}
                {/* Time */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Clock size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{timeAgo(order.created_at)}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              {items && (
                <div style={{
                  padding: "8px 12px", borderRadius: "8px", marginBottom: "10px",
                  background: "rgba(124, 58, 237, 0.05)", border: "1px solid rgba(124, 58, 237, 0.12)",
                  display: "flex", alignItems: "flex-start", gap: "8px",
                }}>
                  <Package size={13} style={{ color: "#a855f7", flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "0.8125rem", lineHeight: "1.5" }}>{items}</span>
                </div>
              )}

              {/* Price + Payment Row */}
              <div style={{
                padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px",
                marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CreditCard size={13} style={{ color: "var(--text-secondary)" }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {order.payment_method || "COD"}
                  </span>
                </div>
                <span style={{ fontSize: "1.125rem", fontWeight: "700" }}>
                  Rs {Number(order.total_price || 0).toLocaleString()}
                </span>
              </div>

              {/* Cancel reason if cancelled */}
              {order.status === "CANCELLED" && order.cancel_reason && (
                <div style={{
                  padding: "8px 12px", borderRadius: "8px", marginBottom: "12px",
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                  fontSize: "0.8125rem", color: "#f87171",
                }}>
                  Reason: {order.cancel_reason}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {action && (
                  <button
                    id={`order-action-${order.id}`}
                    onClick={() => updateStatus(order.id, action.next)}
                    className={action.className}
                    disabled={updating === order.id}
                    style={{ flex: 1, minWidth: "100px", opacity: updating === order.id ? 0.6 : 1 }}
                  >
                    {updating === order.id ? "..." : action.label}
                    <ChevronRight size={13} />
                  </button>
                )}

                {/* Edit button — only for non-locked orders */}
                {!isLocked && (
                  <button
                    id={`order-edit-${order.id}`}
                    onClick={() => setEditOrder(order)}
                    className="btn btn-ghost"
                    style={{ padding: "8px 11px", minWidth: 0 }}
                    title="Edit Order"
                  >
                    <Edit2 size={14} />
                  </button>
                )}

                {/* Cancel button — only for non-locked orders */}
                {!isLocked && (
                  <button
                    id={`order-cancel-${order.id}`}
                    onClick={() => setCancelOrder(order)}
                    className="btn btn-danger"
                    disabled={updating === order.id}
                    style={{ padding: "8px 11px", minWidth: 0 }}
                    title="Cancel Order"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
