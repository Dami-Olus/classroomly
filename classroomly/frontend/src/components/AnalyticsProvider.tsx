"use client";
import { useEffect } from "react";
import { initGA } from "@/lib/analytics";

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initGA();
  }, []);

  return <>{children}</>;
} 