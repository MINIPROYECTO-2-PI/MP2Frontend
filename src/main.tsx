import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Login from "./pages/Login.tsx";
import { createBrowserRouter, Outlet } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Register } from "./pages/Register.tsx";
import SwaggerDocs from "./pages/SwaggerDocs.tsx";
import Home from "./pages/Home.tsx";
import Join from "./pages/Join.tsx";
import Create from "./pages/Create.tsx";
import ChooseUsername from "./pages/ChooseUsername.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { ProtectedRoute, PublicRoute, UsernameRequiredRoute } from "./components/AuthRoutes.tsx";

const router = createBrowserRouter([
  // Rutas públicas (solo accesibles si NO estás autenticado)
  {
    element: <PublicRoute />,
    children: [
      {
        path: "/",
        element: <Login />,
      },
      {
        path: "/register",
        element: <Register />,
      },
    ],
  },
  {
    element: <Outlet />,
    children: [
      {
        path: "/docs",
        element: <SwaggerDocs />,
      },
    ],
  },
  // Ruta para elegir username obligatorio tras login con Google
  {
    element: <UsernameRequiredRoute />,
    children: [
      {
        path: "/choose-username",
        element: <ChooseUsername />,
      },
    ],
  },
  // Rutas privadas (solo accesibles si estás completamente autenticado)
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/home",
        element: <Home />,
      },
      {
        path: "/join",
        element: <Join />,
      },
      {
        path: "/create",
        element: <Create />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
