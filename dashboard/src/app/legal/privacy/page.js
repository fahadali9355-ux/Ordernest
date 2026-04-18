import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Ordernest",
  description: "Privacy Policy and Data Handling for Ordernest",
};

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-dark)", color: "var(--text-primary)", padding: "40px 20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "16px", padding: "40px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
          <ShieldCheck size={32} style={{ color: "#a855f7" }} />
          <h1 style={{ fontSize: "2rem", fontWeight: "700", margin: 0 }}>Privacy Policy</h1>
        </div>
        
        <div style={{ fontSize: "0.95rem", lineHeight: "1.7", color: "var(--text-secondary)" }}>
          <p><strong>Last Updated: April 2026</strong></p>
          
          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>1. Introduction</h2>
          <p>Welcome to Ordernest. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our WhatsApp-based SaaS platform ("Service").</p>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>2. Information We Collect</h2>
          <p>When you interact with our platform, we may collect the following information:</p>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li><strong>WhatsApp Data:</strong> We receive and process text messages, phone numbers, and profile names provided by Meta WhatsApp APIs specifically to facilitate the ordering process.</li>
            <li><strong>Merchant Data:</strong> For shopkeepers, we collect email addresses, business names, and Meta access tokens required to operate the service.</li>
            <li><strong>Order Data:</strong> Details of the items ordered, delivery addresses, and payment preferences.</li>
          </ul>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>3. How We Use Your Information</h2>
          <p>We use your information exclusively to:</p>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li>Provide, operate, and maintain the WhatsApp ordering bot.</li>
            <li>Facilitate communication between the shop owner and the customer regarding their order.</li>
            <li>Improve the functionality and user experience of our Service.</li>
          </ul>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>4. Data Sharing and Third Parties</h2>
          <p>We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. Your data is stored securely in our database and is only accessible to the specific shop owner you interact with, and to our internal systems for maintenance purposes. We comply strictly with Meta's developer policies.</p>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>5. Contact Us</h2>
          <p>If you have any questions or concerns about our Privacy Policy, please contact us at: <strong>fahadali9355@gmail.com</strong></p>

        </div>
      </div>
    </div>
  );
}
