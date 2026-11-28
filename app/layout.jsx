import "./globals.css";
export const metadata = {
  // Neutral default: school pages under /s/ must never be labelled as the owner console.
  title: "Rwanda Education Platform",
  description: "Rwanda School Management Platform.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
