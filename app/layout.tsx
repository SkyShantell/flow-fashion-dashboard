import type { Metadata } from "next";
import "./globals.css";
import VideoProviderControl from "./VideoProviderControl";
import RegenerateVideoLabels from "./RegenerateVideoLabels";
import HookPickerControl from "./HookPickerControl";
import ShoeO1Control from "./ShoeO1Control";

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
        <ShoeO1Control />
      </body>
    </html>
  );
}
