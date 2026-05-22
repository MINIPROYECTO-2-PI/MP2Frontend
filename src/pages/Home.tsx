import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { LuLogOut, LuVideo, LuPlus, LuUser } from "react-icons/lu";

const Home: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Fondo decorativo premium */}
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
      </div>

      {/* Navbar Premium */}
      <nav className="relative z-10 bg-rgba(255,255,255,0.03) backdrop-blur-md border-b border-rgba(255,255,255,0.08) px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="auth-logo w-10 h-10 rounded-xl m-0 shadow-lg">
              <LuVideo size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              MeetClone
            </span>
          </div>

          <div className="flex items-center gap-5">
            {/* Info de Perfil de Usuario */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full pl-3 pr-4 py-1.5 shadow-inner">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user?.displayName || "Avatar"}
                  className="w-7 h-7 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold border border-white/20">
                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <LuUser size={14} />}
                </div>
              )}
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-white/90 leading-tight">
                  {user?.displayName || "Usuario"}
                </span>
                <span className="text-[10px] text-indigo-300 leading-none">
                  @{user?.username || "sin_usuario"}
                </span>
              </div>
            </div>

            {/* Botón Logout Premium */}
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 border border-red-500/20 hover:border-red-500/30 rounded-lg px-3 py-2 transition-all duration-200 shadow-md cursor-pointer"
              title="Cerrar Sesión"
            >
              <LuLogOut size={14} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="relative z-10 max-w-4xl mx-auto flex-grow flex flex-col justify-center items-center px-6 py-16 text-center">
        <div className="animate-fadeIn flex flex-col items-center gap-6">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-4 rounded-3xl shadow-2xl mb-2">
            <LuVideo size={64} className="text-indigo-400 animate-pulse" />
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Videoconferencias{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Premium y Seguras
            </span>
          </h1>
          
          <p className="text-white/60 text-base sm:text-lg max-w-xl leading-relaxed">
            Conéctate al instante con estudiantes y profesores. Crea una reunión o únete a una ya existente de forma rápida y sencilla.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mt-6">
            <a
              href="/join"
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 rounded-xl font-medium transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
            >
              <LuPlus size={18} className="text-indigo-300" />
              Unirse a una Reunión
            </a>
            
            <a
              href="/create"
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 text-white rounded-xl font-medium transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-indigo-500/20"
            >
              <LuVideo size={18} />
              Crear una Reunión Nueva
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-white/30 text-xs border-t border-white/5">
        &copy; 2026 MeetClone. Todos los derechos reservados.
      </footer>
    </div>
  );
};

export default Home;