import "./globals.css";

export const metadata = {
  title: "OrderBot Dashboard",
  description: "WhatsApp Order Management SaaS Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
