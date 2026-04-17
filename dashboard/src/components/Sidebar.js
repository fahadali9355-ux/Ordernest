"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, Package, BarChart3, Bell, LogOut, Zap, Users, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard/orders",        label: "Orders",      icon: ShoppingBag },
  { href: "/dashboard/customers",     label: "Customers",   icon: Users },
  { href: "/dashboard/products",      label: "Products",    icon: Package },
  { href: "/dashboard/analytics",     label: "Analytics",   icon: BarChart3 },
  { href: "/dashboard/notifications", label: "Alerts",      icon: Bell },
  { href: "/dashboard/settings",      label: "Settings",    icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <aside style={{
      width: "240px",
      minHeight: "100vh",
      background: "rgba(255, 255, 255, 0.02)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "24px 14px",
      position: "sticky",
      top: 0,
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 10px", marginBottom: "36px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(124, 58, 237, 0.3)",
        }}>
          <Zap size={18} color="white" />
        </div>
        <span style={{ fontWeight: "700", fontSize: "1.125rem", letterSpacing: "-0.01em" }}>OrderBot</span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: isActive ? "600" : "400",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                background: isActive ? "rgba(124, 58, 237, 0.12)" : "transparent",
                borderLeft: isActive ? "2px solid #7c3aed" : "2px solid transparent",
                textDecoration: "none",
                transition: "all 0.2s ease",
              }}
            >
              <Icon size={18} style={{ color: isActive ? "#a855f7" : "var(--text-secondary)" }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="btn btn-ghost"
        style={{ width: "100%", justifyContent: "flex-start", gap: "10px", marginTop: "12px" }}
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </aside>
  );
}
