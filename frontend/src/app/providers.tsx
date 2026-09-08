import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { queryClient } from "../lib/queryClient";
import { AuthProvider } from "../lib/firebase/authContext";
import App from "@/app/App";

// Data router (createBrowserRouter) instead of the <BrowserRouter> component
// form: the settings page uses useBlocker for unsaved-changes protection,
// which is only available inside a data router. The wildcard route delegates
// all matching to App's <Routes>, so route definitions stay unchanged.
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
