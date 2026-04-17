"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{
        flex: 1,
        padding: "28px 32px",
        overflowY: "auto",
        maxHeight: "100vh",
        background: "radial-gradient(ellipse at 80% 0%, rgba(124, 58, 237, 0.06) 0%, transparent 50%)",
      }}>
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
