import type { Metadata } from "next";
import "./globals.css";
import VideoProviderControl from "./VideoProviderControl";
import RegenerateVideoLabels from "./RegenerateVideoLabels";

export const metadata: Metadata = {
  title: "Flow Fashion Factory",
  description: "AI fashion production dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <VideoProviderControl />
        <RegenerateVideoLabels />
      </body>
    </html>
  );
}
