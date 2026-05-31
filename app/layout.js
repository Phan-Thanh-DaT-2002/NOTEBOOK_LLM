import "./globals.css";
import { ToastProvider } from '@/components/ui/Toast.js';

export const metadata = {
  title: "Local Notebook AI",
  description: "Self-hosted, private research notebook assistant powered by local and cloud LLMs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
