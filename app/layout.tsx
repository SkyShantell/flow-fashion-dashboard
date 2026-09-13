import type { Metadata } from "next";
import "./globals.css";
import VideoProviderControl from "./VideoProviderControl";
import RegenerateVideoLabels from "./RegenerateVideoLabels";
import HookPickerControl from "./HookPickerControl";
import ShoeO1Control from "./ShoeO1Control";
import ShoeReferenceControl from "./ShoeReferenceControl";
import ShoeO1LegacyCopyFix from "./ShoeO1LegacyCopyFix";
import ManualFFmpegControl from "./ManualFFmpegControl";
import RedoFFmpegControl from "./RedoFFmpegControl";
import AppleEmojiSeeder from "./AppleEmojiSeeder";

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
        <ShoeReferenceControl />
        <ShoeO1LegacyCopyFix />
        <ManualFFmpegControl />
        <RedoFFmpegControl />
        <AppleEmojiSeeder />
      </body>
    </html>
  );
}
