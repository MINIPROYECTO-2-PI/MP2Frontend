import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { User } from "../services/auth";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  LuLoaderCircle,
  LuEye,
  LuEyeOff,
  LuCircleAlert,
  LuVideo,
  LuUser,
  LuMail,
  LuLock,
} from "react-icons/lu";

interface FieldErrors {
  username?: string;
  name?: string;
  surname?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  icon: React.ReactNode;
  autoComplete: string;
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  disabled: boolean;
  error?: string;
}

const Field = ({
  id,
  label,
  type = "text",
  placeholder,
  icon,
  autoComplete,
  value,
  onChange,
  onBlur,
  disabled,
  error,
}: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label
      htmlFor={id}
      className="text-[11px] uppercase tracking-wider font-medium text-white/40"
    >
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
        {icon}
      </span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`w-full bg-white/[0.04] border rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/20 outline-none transition-all focus:bg-violet-500/[0.05] focus:border-violet-500/50 ${
          error ? "border-red-500/50" : "border-white/[0.09]"
        }`}
      />
    </div>
    {error && (
      <span
        className={`text-xs flex items-center gap-1 ${
          error.includes("sugiere") ? "text-amber-400" : "text-red-400"
        }`}
      >
        <LuCircleAlert size={12} /> {error}
      </span>
    )}
  </div>
);

export function Register() {
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const [form, setForm] = useState({
    username: "",
    name: "",
    surname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const updateField = (field: string, value: string) => {
    const formatted =
      field === "username" ? value.toLowerCase().replace(/\s+/g, "") : value;
    setForm((p) => ({ ...p, [field]: formatted }));
    if (touched[field]) validateSingleField(field, formatted);
  };

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    validateSingleField(field, form[field as keyof typeof form]);
  };

  const validateSingleField = (field: string, value: string): string => {
    let msg = "";
    switch (field) {
      case "username":
        if (!value.trim()) msg = "El nombre de usuario es requerido";
        else if (value.length < 3) msg = "Debe tener al menos 3 caracteres";
        else if (!/^[a-zA-Z0-9_]+$/.test(value))
          msg = "Solo letras, números y guión bajo";
        break;
      case "name":
        if (!value.trim()) msg = "El nombre es requerido";
        else if (/\d/.test(value)) msg = "No puede contener números";
        break;
      case "surname":
        if (!value.trim()) msg = "El apellido es requerido";
        else if (/\d/.test(value)) msg = "No puede contener números";
        break;
      case "email":
        if (!value.trim()) msg = "El correo es requerido";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          msg = "Formato de correo inválido";
        else if (
          !value.toLowerCase().endsWith(".edu.co") &&
          !value.toLowerCase().endsWith(".edu")
        )
          msg = "Se sugiere un correo institucional (.edu.co / .edu)";
        break;
      case "password":
        if (!value) msg = "La contraseña es requerida";
        else if (value.length < 6) msg = "Mínimo 6 caracteres";
        break;
      case "confirmPassword":
        if (!value) msg = "Confirma tu contraseña";
        else if (value !== form.password) msg = "Las contraseñas no coinciden";
        break;
    }
    setFieldErrors((p) => ({ ...p, [field]: msg }));
    return msg;
  };

  const validateAll = (): boolean => {
    const allTouched = Object.fromEntries(
      Object.keys(form).map((k) => [k, true]),
    );
    setTouched(allTouched);
    return Object.keys(form).every((key) => {
      const err = validateSingleField(key, form[key as keyof typeof form]);
      return !err || (key === "email" && err.includes("Se sugiere"));
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!validateAll()) {
      setError("Por favor corrige los campos indicados");
      return;
    }
    setLoading(true);
    try {
      await User.register({
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim(),
        name: form.name.trim(),
        surname: form.surname.trim(),
      });
      setSuccess("¡Cuenta creada! Redirigiendo...");
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("usuario"))
        setFieldErrors((p) => ({ ...p, username: msg }));
      else if (
        msg.toLowerCase().includes("correo") ||
        msg.toLowerCase().includes("email")
      )
        setFieldErrors((p) => ({ ...p, email: msg }));
      setError(msg || "Error al registrar usuario");
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
      if (err.code !== "auth/popup-closed-by-user")
        setError(err.message || "Error con Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const isDisabled = loading || googleLoading;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600 opacity-15 blur-[80px] -top-32 -left-32 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-violet-700 opacity-15 blur-[80px] -bottom-20 -right-20 pointer-events-none" />

      <div className="w-full max-w-[940px] flex rounded-2xl overflow-hidden border border-white/[0.07] shadow-2xl relative z-10">
        {/* Panel izquierdo */}
        <div className="w-[240px] flex-shrink-0 bg-gradient-to-br from-[#1e1b4b] to-[#1e1040] p-8 hidden md:flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <LuVideo size={16} className="text-violet-400" />
            </div>
            <span className="font-bold text-white text-base tracking-tight">
              MeetClone
            </span>
          </div>
          <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold text-white leading-tight tracking-tight">
              Únete y<br />
              empieza a<br />
              <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                colaborar.
              </span>
            </h2>
            <p className="text-xs text-white/40 leading-relaxed">
              Crea tu cuenta y accede a videollamadas HD, salas instantáneas y
              más.
            </p>
            <div className="flex flex-col gap-2">
              {[
                "Registro en segundos",
                "Acceso institucional",
                "Gratis para estudiantes",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  <span className="text-xs text-white/40">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <span className="text-xs text-white/20">© 2026 MeetClone</span>
        </div>

        {/* Panel derecho */}
        <div className="flex-1 bg-[#111118] p-8 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Crear una cuenta
            </h1>
            <p className="text-sm text-white/35 mt-1">
              ¿Ya tienes cuenta?{" "}
              <Link
                to="/"
                className="text-violet-400 hover:text-violet-300 transition-colors"
              >
                Inicia sesión
              </Link>
            </p>
          </div>

          <div className="h-px bg-white/[0.07]" />

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <LuCircleAlert size={13} className="flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
              ✓ {success}
            </div>
          )}

          <form
            onSubmit={handleRegister}
            className="flex flex-col gap-3.5"
            noValidate
          >
            <Field
              id="username"
              label="Nombre de usuario único"
              placeholder="ej: jhoan_munoz"
              icon={<LuUser size={14} />}
              autoComplete="username"
              value={form.username}
              onChange={(val) => updateField("username", val)}
              onBlur={() => handleBlur("username")}
              disabled={isDisabled}
              error={fieldErrors.username}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field
                id="name"
                label="Nombres"
                placeholder="Juan"
                icon={<LuUser size={14} />}
                autoComplete="given-name"
                value={form.name}
                onChange={(val) => updateField("name", val)}
                onBlur={() => handleBlur("name")}
                disabled={isDisabled}
                error={fieldErrors.name}
              />
              <Field
                id="surname"
                label="Apellidos"
                placeholder="Pérez"
                icon={<LuUser size={14} />}
                autoComplete="family-name"
                value={form.surname}
                onChange={(val) => updateField("surname", val)}
                onBlur={() => handleBlur("surname")}
                disabled={isDisabled}
                error={fieldErrors.surname}
              />
            </div>

            <Field
              id="email"
              label="Correo institucional"
              type="email"
              placeholder="estudiante@universidad.edu.co"
              icon={<LuMail size={14} />}
              autoComplete="email"
              value={form.email}
              onChange={(val) => updateField("email", val)}
              onBlur={() => handleBlur("email")}
              disabled={isDisabled}
              error={fieldErrors.email}
            />

            <div className="grid grid-cols-2 gap-3">
              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-[11px] uppercase tracking-wider font-medium text-white/40"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <LuLock
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mín. 6 caracteres"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    onBlur={() => handleBlur("password")}
                    disabled={isDisabled}
                    autoComplete="new-password"
                    className={`w-full bg-white/[0.04] border rounded-xl py-2.5 pl-9 pr-9 text-sm text-white placeholder-white/20 outline-none transition-all focus:bg-violet-500/[0.05] focus:border-violet-500/50 ${
                      fieldErrors.password
                        ? "border-red-500/50"
                        : "border-white/[0.09]"
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                  >
                    {showPassword ? (
                      <LuEyeOff size={14} />
                    ) : (
                      <LuEye size={14} />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <LuCircleAlert size={12} /> {fieldErrors.password}
                  </span>
                )}
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-[11px] uppercase tracking-wider font-medium text-white/40"
                >
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <LuLock
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
                  />
                  <input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repite tu contraseña"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      updateField("confirmPassword", e.target.value)
                    }
                    onBlur={() => handleBlur("confirmPassword")}
                    disabled={isDisabled}
                    autoComplete="new-password"
                    className={`w-full bg-white/[0.04] border rounded-xl py-2.5 pl-9 pr-9 text-sm text-white placeholder-white/20 outline-none transition-all focus:bg-violet-500/[0.05] focus:border-violet-500/50 ${
                      fieldErrors.confirmPassword
                        ? "border-red-500/50"
                        : "border-white/[0.09]"
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                  >
                    {showConfirm ? <LuEyeOff size={14} /> : <LuEye size={14} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <LuCircleAlert size={12} /> {fieldErrors.confirmPassword}
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-85 transition-opacity disabled:opacity-50 mt-1"
            >
              {loading ? (
                <>
                  <LuLoaderCircle className="animate-spin" size={15} />{" "}
                  Registrando...
                </>
              ) : (
                "Crear cuenta"
              )}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-xs text-white/25">o regístrate con</span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isDisabled}
            className="w-full py-2.5 rounded-xl border border-white/[0.09] bg-white/[0.03] text-white/60 text-sm flex items-center justify-center gap-2 hover:bg-white/[0.07] transition-colors disabled:opacity-50"
          >
            {googleLoading ? (
              <>
                <LuLoaderCircle className="animate-spin" size={15} />{" "}
                Conectando...
              </>
            ) : (
              <>
                <FcGoogle size={17} /> Continuar con Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Register;
