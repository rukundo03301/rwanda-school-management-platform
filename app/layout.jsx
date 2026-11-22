import "./globals.css";
export const metadata = {
  title: "Rwanda Education Platform · Owner Console",
  description: "Tenant, subscriptions, support, and staff management for the Rwanda School Management Platform.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
