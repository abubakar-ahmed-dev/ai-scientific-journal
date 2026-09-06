import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "../lib/queryClient";
import { AuthProvider } from "../lib/firebase/authContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
