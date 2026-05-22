import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LuLoaderCircle } from "react-icons/lu";

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0f0f23] text-white z-50">
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <LuLoaderCircle className="animate-spin text-indigo-500" size={50} />
        <p className="text-sm font-medium tracking-widest text-indigo-300 uppercase animate-pulse">
          Verificando credenciales...
        </p>
      </div>
    </div>
  );
};

export const ProtectedRoute: React.FC = () => {
  const { user, loading, needsUsername } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (needsUsername) {
    return <Navigate to="/choose-username" replace />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const PublicRoute: React.FC = () => {
  const { user, loading, needsUsername } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (needsUsername) {
    return <Navigate to="/choose-username" replace />;
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};

export const UsernameRequiredRoute: React.FC = () => {
  const { user, loading, needsUsername } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  if (!needsUsername) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
