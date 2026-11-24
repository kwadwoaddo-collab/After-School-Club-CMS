import type { Metadata } from "next";

export const metadata: Metadata = { title: "Parent portal log in" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
