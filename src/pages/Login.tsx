import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { doc, getDoc } from "firebase/firestore";
import { User } from "../services/auth";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  LuLoaderCircle,
  LuLogIn,
  LuEye,
  LuEyeOff,
  LuCircleAlert,
  LuVideo,
  LuUser,
  LuLock,
} from "react-icons/lu";

interface LoginFieldErrors {
  username?: string;
  password?: string;
}

export function Login() {
  const navigate = useNavigate();
  const { login, signInWithGoogle } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (field: string, value: string) => {
    let msg = "";
    if (field === "username" && !value.trim())
      msg = "Ingresa tu usuario o correo";
    if (field === "password") {
      if (!value) msg = "Ingresa tu contraseña";
      else if (value.length < 6) msg = "Mínimo 6 caracteres";
    }
    setFieldErrors((p) => ({ ...p, [field]: msg }));
    return msg;
  };

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    validateField(field, field === "username" ? username : password);
  };

  const handleChange = (field: string, value: string) => {
    if (field === "username") setUsername(value);
    else setPassword(value);
    if (touched[field]) validateField(field, value);
    if (error) setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const u = validateField("username", username);
    const p = validateField("password", password);
    setTouched({ username: true, password: true });
    if (u || p) return;

    setLoading(true);
    try {
      const result = await User.login({ username: username.trim(), password });
      setSuccess("¡Bienvenido! Iniciando sesión...");
      const userData = {
        ...result.user,
        username: result.user.username || username.trim(),
      };
      if (!userData.displayName && userData.uid) {
        const docSnap = await getDoc(doc(db, "users", userData.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name || data.surname) {
            userData.displayName =
              `${data.name || ""} ${data.surname || ""}`.trim();
          } else if (data.displayName) {
            userData.displayName = data.displayName;
          }
        }
      }
      login(userData);
      setTimeout(() => navigate("/home"), 1000);
    } catch (err: any) {
      const msg = err.message || "";
      if (
        msg.toLowerCase().includes("password") ||
        msg.toLowerCase().includes("contraseña")
      ) {
        setFieldErrors((p) => ({ ...p, password: "Contraseña incorrecta" }));
      } else if (msg.toLowerCase().includes("usuario no encontrado")) {
        setFieldErrors((p) => ({ ...p, username: "Usuario no registrado" }));
      }
      setError(msg || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setSuccess("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Error con Google");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600 opacity-15 blur-[80px] -top-32 -left-32 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-violet-700 opacity-15 blur-[80px] -bottom-20 -right-20 pointer-events-none" />

      <div className="w-full max-w-[900px] flex rounded-2xl overflow-hidden border border-white/[0.07] shadow-2xl relative z-10">
        {/* Panel izquierdo */}
        <div className="flex-1 bg-gradient-to-br from-[#1e1b4b] to-[#1e1040] p-10 hidden md:flex flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <LuVideo size={18} className="text-violet-400" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">
              MeetClone
            </span>
          </div>

          <div className="flex flex-col gap-6">
            <h2 className="text-3xl font-bold text-white leading-tight tracking-tight">
              Conecta,
              <br />
              colabora,
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                crea juntos.
              </span>
            </h2>
            <p className="text-sm text-white/40 leading-relaxed max-w-[260px]">
              Videollamadas en alta definición para equipos que necesitan
              moverse rápido.
            </p>
            <div className="flex flex-col gap-2.5">
              {[
                "HD sin interrupciones",
                "Salas instantáneas",
                "Grabación en la nube",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  <span className="text-sm text-white/45">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <span className="text-xs text-white/20">© 2026 MeetClone</span>
        </div>

        {/* Panel derecho */}
        <div className="w-full md:w-[420px] bg-[#111118] p-10 flex flex-col justify-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-white/35 mt-1.5">
              ¿No tienes cuenta?{" "}
              <Link
                to="/register"
                className="text-violet-400 hover:text-violet-300 transition-colors"
              >
                Regístrate gratis
              </Link>
            </p>
          </div>

          <div className="h-px bg-white/[0.07]" />

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <LuCircleAlert size={15} className="flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              ✓ {success}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            className="flex flex-col gap-4"
            noValidate
          >
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wider font-medium text-white/45">
                Usuario o correo
              </label>
              <div className="relative">
                <LuUser
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  onBlur={() => handleBlur("username")}
                  disabled={loading || googleLoading}
                  placeholder="ej: usuario@correo.com"
                  autoComplete="username"
                  className={`w-full bg-white/[0.04] border rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/20 outline-none transition-all focus:bg-violet-500/[0.05] focus:border-violet-500/50 ${fieldErrors.username ? "border-red-500/50" : "border-white/[0.09]"}`}
                />
              </div>
              {fieldErrors.username && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <LuCircleAlert size={12} /> {fieldErrors.username}
                </span>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider font-medium text-white/45">
                  Contraseña
                </label>
                <a
                  href="#"
                  className="text-xs text-white/30 hover:text-violet-400 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div className="relative">
                <LuLock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  onBlur={() => handleBlur("password")}
                  disabled={loading || googleLoading}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full bg-white/[0.04] border rounded-xl py-2.5 pl-9 pr-11 text-sm text-white placeholder-white/20 outline-none transition-all focus:bg-violet-500/[0.05] focus:border-violet-500/50 ${fieldErrors.password ? "border-red-500/50" : "border-white/[0.09]"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                </button>
              </div>
              {fieldErrors.password && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <LuCircleAlert size={12} /> {fieldErrors.password}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-85 transition-opacity disabled:opacity-50 mt-1"
            >
              {loading ? (
                <>
                  <LuLoaderCircle className="animate-spin" size={16} />{" "}
                  Ingresando...
                </>
              ) : (
                <>
                  <LuLogIn size={16} /> Ingresar
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-xs text-white/25">o continúa con</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full py-2.5 rounded-xl border border-white/[0.09] bg-white/[0.03] text-white/65 text-sm flex items-center justify-center gap-2 hover:bg-white/[0.07] transition-colors disabled:opacity-50"
          >
            {googleLoading ? (
              <>
                <LuLoaderCircle className="animate-spin" size={16} />{" "}
                Conectando...
              </>
            ) : (
              <>
                <FcGoogle size={18} /> Continuar con Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
