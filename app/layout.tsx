import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "회사 지원 내역",
  description: "사람인과 잡코리아 지원 내역 관리 페이지",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
