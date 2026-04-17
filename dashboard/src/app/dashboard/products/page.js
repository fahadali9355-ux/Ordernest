"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Package, AlertTriangle, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data.filter(p => !p.is_deleted));
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const addProduct = async (e) => {
    e.preventDefault();
    if (!name || !price) {
      setError("Name and price are required.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      await api.post("/products", {
        name,
        price: Number(price),
        stock_quantity: Number(stock) || 10,
      });
      setName(""); setPrice(""); setStock("10");
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add product.");
    } finally {
      setAdding(false);
    }
  };

  const toggleAvailability = async (id, currentState) => {
    try {
      await api.patch(`/products/${id}`, { is_available: !currentState });
      await fetchProducts();
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const updateStock = async (id, newQty) => {
    try {
      await api.patch(`/products/${id}`, { stock_quantity: Number(newQty) });
      await fetchProducts();
    } catch (err) {
      console.error("Stock update failed:", err);
    }
  };

  const deleteProduct = async (id) => {
    try {
      await api.patch(`/products/${id}`, { is_deleted: true });
      await fetchProducts();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "4px" }}>Products</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          {products.length} products in your menu
        </p>
      </div>

      {/* Add Product Form */}
      <form onSubmit={addProduct} className="glass-card" style={{
        padding: "20px",
        marginBottom: "24px",
        display: "flex",
        gap: "12px",
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}>
        <div style={{ flex: "2", minWidth: "160px" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: "500" }}>
            Product Name
          </label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Burger" />
        </div>
        <div style={{ flex: "1", minWidth: "100px" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: "500" }}>
            Price (Rs)
          </label>
          <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="250" />
        </div>
        <div style={{ flex: "1", minWidth: "100px" }}>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "6px", fontWeight: "500" }}>
            Stock
          </label>
          <input className="input" type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="10" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={adding} style={{
          padding: "10px 20px",
          opacity: adding ? 0.7 : 1,
        }}>
          <Plus size={16} />
          {adding ? "Adding..." : "Add"}
        </button>
      </form>

      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "8px", marginBottom: "16px",
          background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)",
          color: "#f87171", fontSize: "0.8125rem",
        }}>{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
          Loading products...
        </div>
      )}

      {/* Products Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
      }}>
        {products.map((p, i) => (
          <div
            key={p.id}
            className="glass-card"
            style={{
              padding: "20px",
              opacity: p.is_available ? 1 : 0.55,
              animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
            }}
          >
            {/* Top */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              marginBottom: "14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px",
                  background: "linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(168, 85, 247, 0.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Package size={18} style={{ color: "#a855f7" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: "600", marginBottom: "2px" }}>
                    {p.name}
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    ID: {p.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Price + Stock */}
            <div style={{
              display: "flex", gap: "12px", marginBottom: "16px",
            }}>
              <div style={{
                flex: 1, padding: "10px",
                background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px",
              }}>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginBottom: "2px" }}>Price</div>
                <div style={{ fontSize: "1rem", fontWeight: "700" }}>Rs {Number(p.price).toLocaleString()}</div>
              </div>
              <div style={{
                flex: 1, padding: "10px",
                background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px",
              }}>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", marginBottom: "2px" }}>Stock</div>
                <div style={{
                  fontSize: "1rem", fontWeight: "700",
                  color: p.stock_quantity < 5 ? "#f87171" : p.stock_quantity < 15 ? "#fbbf24" : "#34d399",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                  {p.stock_quantity < 5 && <AlertTriangle size={14} />}
                  {p.stock_quantity}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => toggleAvailability(p.id, p.is_available)}
                className={p.is_available ? "btn btn-success" : "btn btn-warning"}
                style={{ flex: 1, fontSize: "0.75rem" }}
              >
                {p.is_available ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                {p.is_available ? "Available" : "Disabled"}
              </button>
              <button
                onClick={() => deleteProduct(p.id)}
                className="btn btn-danger"
                style={{ fontSize: "0.75rem" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
