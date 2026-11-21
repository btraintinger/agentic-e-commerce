import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";
import { TRPCReactProvider } from "@/trpc/client";

export const metadata: Metadata = {
  title: "JKU Webshop",
  description: "Student webshop catalog and cart validation API",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
