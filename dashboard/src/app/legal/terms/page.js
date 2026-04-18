import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service | Ordernest",
  description: "Terms of Service for Ordernest",
};

export default function TermsOfService() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-dark)", color: "var(--text-primary)", padding: "40px 20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "16px", padding: "40px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
          <FileText size={32} style={{ color: "#a855f7" }} />
          <h1 style={{ fontSize: "2rem", fontWeight: "700", margin: 0 }}>Terms of Service</h1>
        </div>
        
        <div style={{ fontSize: "0.95rem", lineHeight: "1.7", color: "var(--text-secondary)" }}>
          <p><strong>Last Updated: April 2026</strong></p>
          
          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>1. Acceptance of Terms</h2>
          <p>By accessing and using Ordernest ("us", "we", or "our"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, then you may not access the Service.</p>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>2. Description of Service</h2>
          <p>Ordernest is a software-as-a-service (SaaS) platform that provides shopkeepers with an automated WhatsApp bot for taking orders, managing inventory, and tracking customer interactions.</p>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>3. Merchant Responsibilities</h2>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li>You are responsible for obtaining explicit consent from your customers before messaging them via our platform, adhering to Meta's WhatsApp Business policies.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials and Access Tokens.</li>
            <li>You agree not to use the platform for any illegal or unauthorized purpose.</li>
          </ul>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>4. Service Availability</h2>
          <p>We strive to ensure maximum uptime, but we do not guarantee that the Service will be uninterrupted or error-free. The Service is reliant on the Meta WhatsApp Cloud API and associated network providers.</p>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>5. Limitation of Liability</h2>
          <p>In no event shall Ordernest, nor its directors, employees, or partners, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, or goodwill, resulting from your use of the Service.</p>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>6. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at: <strong>fahadali9355@gmail.com</strong></p>
        </div>
      </div>
    </div>
  );
}
