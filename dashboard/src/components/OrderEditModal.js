"use client";
import { useState, useEffect } from "react";
import { X, Plus, Minus, Trash2, Save, Loader2 } from "lucide-react";
import api from "@/lib/api";

export default function OrderEditModal({ order, onClose, onSaved }) {
  const [products, setProducts]       = useState([]);
  const [items, setItems]             = useState([]);
  const [address, setAddress]         = useState(order?.address || "");
  const [paymentMethod, setPayment]   = useState(order?.payment_method || "COD");
  const [customerName, setName]       = useState(order?.customer_name || "");
  const [notes, setNotes]             = useState(order?.notes || "");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if (!order) return;

    // Load order items + all products in parallel
    Promise.all([
      api.get(`/orders/${order.id}/items`),
      api.get("/products"),
    ]).then(([itemsRes, productsRes]) => {
      setItems(
        itemsRes.data.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          price: it.price,
        }))
      );
      setProducts(productsRes.data.filter((p) => !p.is_deleted));
    }).catch((err) => {
      setError("Failed to load order details.");
      console.error(err);
    }).finally(() => setLoadingItems(false));
  }, [order]);

  const updateQty = (idx, delta) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it
      )
    );
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addProduct = (productId) => {
    const p = products.find((pr) => pr.id === Number(productId));
    if (!p) return;
    const existing = items.findIndex((it) => it.product_id === p.id);
    if (existing >= 0) {
      // Bump quantity instead of adding duplicate
      setItems((prev) =>
        prev.map((it, i) => i === existing ? { ...it, quantity: it.quantity + 1 } : it)
      );
    } else {
      setItems((prev) => [
        ...prev,
        { product_id: p.id, product_name: p.name, quantity: 1, price: Number(p.price) },
      ]);
    }
  };

  const total = items.reduce((sum, it) => sum + it.quantity * it.price, 0);

  const handleSave = async () => {
    if (items.length === 0) {
      setError("Order mein kum az kum ek item hona chahiye.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/orders/${order.id}`, {
        customer_name: customerName || undefined,
        address:        address || undefined,
        payment_method: paymentMethod,
        notes:          notes || undefined,
        items: items.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <div
      id="order-edit-modal-overlay"
      onClick={(e) => e.target.id === "order-edit-modal-overlay" && onClose?.()}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%", maxWidth: "600px",
          maxHeight: "90vh", overflowY: "auto",
          padding: "28px",
          border: "1px solid rgba(124, 58, 237, 0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: "700" }}>
              Edit Order {order.order_number || `#${order.id}`}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              Status: {order.status} — sirf editable fields change karo
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: "6px", minWidth: 0 }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "16px",
            background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#f87171", fontSize: "0.8125rem",
          }}>{error}</div>
        )}

        {loadingItems ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            Loading order details...
          </div>
        ) : (
          <>
            {/* ── ORDER ITEMS ── */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Order Items
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                {items.map((it, idx) => (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                  }}>
                    <span style={{ flex: 1, fontSize: "0.875rem" }}>{it.product_name}</span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", minWidth: "72px", textAlign: "right" }}>
                      Rs {(it.quantity * it.price).toLocaleString()}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button onClick={() => updateQty(idx, -1)} className="btn btn-ghost"
                        style={{ padding: "4px 7px", minWidth: 0, borderRadius: "6px" }}>
                        <Minus size={13} />
                      </button>
                      <span style={{ fontWeight: "600", minWidth: "20px", textAlign: "center" }}>{it.quantity}</span>
                      <button onClick={() => updateQty(idx, 1)} className="btn btn-ghost"
                        style={{ padding: "4px 7px", minWidth: 0, borderRadius: "6px" }}>
                        <Plus size={13} />
                      </button>
                    </div>
                    <button onClick={() => removeItem(idx)} className="btn btn-danger"
                      style={{ padding: "5px 8px", minWidth: 0, borderRadius: "6px" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {items.length === 0 && (
                  <div style={{ textAlign: "center", padding: "16px", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                    Koi item nahi. Neeche se add karo.
                  </div>
                )}
              </div>

              {/* Add product dropdown */}
              <select
                onChange={(e) => { if (e.target.value) { addProduct(e.target.value); e.target.value = ""; } }}
                defaultValue=""
                className="input"
                style={{ fontSize: "0.875rem" }}
              >
                <option value="" disabled>+ Product add karo...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — Rs {p.price}</option>
                ))}
              </select>
            </div>

            {/* Total */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", borderRadius: "8px",
              background: "rgba(124, 58, 237, 0.08)", border: "1px solid rgba(124, 58, 237, 0.2)",
              marginBottom: "20px",
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>New Total</span>
              <span style={{ fontSize: "1.125rem", fontWeight: "700" }}>Rs {total.toLocaleString()}</span>
            </div>

            {/* ── SCALAR FIELDS ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: "500" }}>
                  Customer Name
                </label>
                <input
                  className="input"
                  value={customerName}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ali Raza"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: "500" }}>
                  Payment Method
                </label>
                <select
                  className="input"
                  value={paymentMethod}
                  onChange={(e) => setPayment(e.target.value)}
                >
                  <option value="COD">Cash on Delivery</option>
                  <option value="ONLINE">Online Payment</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: "500" }}>
                Delivery Address
              </label>
              <input
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House 5, Street 3, Gulshan-e-Iqbal"
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: "500" }}>
                Notes (optional)
              </label>
              <input
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Extra sauce chahiye, etc."
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || items.length === 0}
                className="btn btn-primary"
                style={{ flex: 2, opacity: (saving || items.length === 0) ? 0.7 : 1 }}
              >
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
