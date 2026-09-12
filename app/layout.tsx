import type { Metadata } from "next";
import "./globals.css";
import VideoProviderControl from "./VideoProviderControl";
import RegenerateVideoLabels from "./RegenerateVideoLabels";
import HookPickerControl from "./HookPickerControl";

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
        <HookPickerControl />
      </body>
    </html>
  );
}
