import { Trash2 } from "lucide-react";

export const metadata = {
  title: "Data Deletion Policy | Ordernest",
  description: "Instructions on how to request data deletion",
};

export default function DataDeletion() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-dark)", color: "var(--text-primary)", padding: "40px 20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "16px", padding: "40px" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
          <Trash2 size={32} style={{ color: "#ef4444" }} />
          <h1 style={{ fontSize: "2rem", fontWeight: "700", margin: 0 }}>Data Deletion Instructions</h1>
        </div>
        
        <div style={{ fontSize: "0.95rem", lineHeight: "1.7", color: "var(--text-secondary)" }}>
          <p>Ordernest fully complies with global privacy laws and Meta's Developer Policies regarding user data. If you wish to have your data completely removed from our systems, follow the instructions below.</p>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>For Customers</h2>
          <p>If you are a customer who interacted with an Ordernest-powered WhatsApp bot and want your order history, phone number, and chat logs deleted:</p>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li>Please send an email to <strong>fahadali9355@gmail.com</strong> with the subject line <strong>"Customer Data Deletion Request"</strong>.</li>
            <li>Include the phone number from which you used the service (including your country code) so we can locate your records.</li>
            <li>We will delete all your associated records from our database within 5-7 business days.</li>
          </ul>

          <h2 style={{ color: "var(--text-primary)", marginTop: "30px", fontSize: "1.2rem" }}>For Shop Owners / Merchants</h2>
          <p>If you are a merchant using the Ordernest SaaS and you wish to delete your account and all associated data (including access tokens, customer databases, and product lists):</p>
          <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
            <li>Log into your Ordernest Dashboard.</li>
            <li>Navigate to the settings (or contact support) to initiate an account closure.</li>
            <li>Alternatively, email us at <strong>fahadali9355@gmail.com</strong> from your registered email address with the subject <strong>"Merchant Account Deletion"</strong>.</li>
            <li>Once processed, all your business data, tokens, and associated customer records will be permanently erased.</li>
          </ul>

          <div style={{ padding: "16px 20px", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.3)", marginTop: "40px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#f87171", fontSize: "1rem" }}>Note on Meta Connections</h3>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>Deleting your data with Ordernest will delete it from our servers. To fully disconnect Ordernest from your WhatsApp Business Account, you must also go to your <strong>Facebook Business Settings &gt; Integrations &gt; Connected Apps</strong> and remove our app.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
