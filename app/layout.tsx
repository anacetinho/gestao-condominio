import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Administração de Condomínio",
  description: "Aplicação para gerir condomínios em Portugal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
