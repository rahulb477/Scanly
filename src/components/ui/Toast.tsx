"use client";

import { Toaster as HotToaster, toast as showToastFn } from "react-hot-toast";

export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: "#0f172a",
          color: "#fff",
          borderRadius: "12px",
          fontSize: "14px",
          padding: "10px 14px",
        },
        success: {
          iconTheme: { primary: "#22c55e", secondary: "#fff" },
        },
        error: {
          iconTheme: { primary: "#ef4444", secondary: "#fff" },
        },
      }}
    />
  );
}

export const toast = showToastFn;