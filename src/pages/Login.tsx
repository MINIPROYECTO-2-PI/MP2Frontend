import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FcGoogle } from "react-icons/fc";
import { User } from "../services/auth";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { LuLoaderCircle, LuLogIn, LuEye, LuEyeOff, LuCircleAlert } from "react-icons/lu";

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

  // Estados de errores granulares de UI
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (field: string, value: string) => {
    let errMessage = "";
    if (field === "username") {
      if (!value.trim()) {
        errMessage = "Ingresa tu nombre de usuario o correo electrónico";
      }
    } else if (field === "password") {
      if (!value) {
        errMessage = "Ingresa tu contraseña";
      } else if (value.length < 6) {
        errMessage = "La contraseña debe tener al menos 6 caracteres";
      }
    }
    setFieldErrors((prev) => ({ ...prev, [field]: errMessage }));
    return errMessage;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "username") validateField("username", username);
    if (field === "password") validateField("password", password);
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === "username") {
      setUsername(value);
      if (touched.username) validateField("username", value);
    } else {
      setPassword(value);
      if (touched.password) validateField("password", value);
    }
    // Limpiar error general al escribir
    if (error) setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    // Forzar validación completa
    const userErr = validateField("username", username);
    const passErr = validateField("password", password);
    setTouched({ username: true, password: true });

    if (userErr || passErr) {
      setError("Por favor completa los campos requeridos correctamente");
      return;
    }

    setLoading(true);
    try {
      const result = await User.login({ username: username.trim(), password });
      setSuccess("¡Bienvenido! Iniciando sesión...");
      login(result.user);
      setTimeout(() => navigate("/home"), 1000);
    } catch (err: any) {
      const errMsg = err.message || "";
      if (errMsg.toLowerCase().includes("contraseña") || errMsg.toLowerCase().includes("password")) {
        setFieldErrors((prev) => ({ ...prev, password: "La contraseña es incorrecta" }));
        setError("Credenciales inválidas, intenta de nuevo");
      } else if (errMsg.toLowerCase().includes("usuario no encontrado") || errMsg.toLowerCase().includes("correo")) {
        setFieldErrors((prev) => ({ ...prev, username: "El usuario o correo no está registrado" }));
        setError("El usuario o correo ingresado no existe");
      } else {
        setError(errMsg || "Error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setSuccess("");
    setGoogleLoading(true);
    try {
      setSuccess("Conectando con Google...");
      await signInWithGoogle();
      setSuccess("Autenticación exitosa, cargando perfil...");
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        return;
      }
      setError(err.message || "Error al iniciar sesión con Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Fondo decorativo */}
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
        <div className="auth-blob auth-blob--3" />
      </div>

      <div className="auth-container">
        {/* Logo / Branding */}
        <div className="auth-brand">
          <div className="auth-logo">
            <LuLogIn size={28} />
          </div>
          <h1 className="auth-brand-title">MeetClone</h1>
          <p className="auth-brand-subtitle">Conecta, colabora, crea</p>
        </div>

        <Card className="auth-card">
          <CardHeader>
            <CardTitle className="text-lg">Ingresar a tu cuenta</CardTitle>
            <CardDescription>
              Ingresa tu usuario o correo electrónico para continuar
            </CardDescription>
            <CardAction>
              <Link to="/register" className="auth-link">
                Crear cuenta
              </Link>
            </CardAction>
          </CardHeader>

          <CardContent>
            <form id="login-form" onSubmit={handleLogin} noValidate>
              <div className="flex flex-col gap-4">
                {/* Mensajes de error/éxito */}
                {error && (
                  <div className="auth-alert auth-alert--error" role="alert">
                    <span className="auth-alert-icon">✕</span>
                    {error}
                  </div>
                )}
                {success && (
                  <div className="auth-alert auth-alert--success" role="alert">
                    <span className="auth-alert-icon">✓</span>
                    {success}
                  </div>
                )}

                {/* Campo Usuario/Correo */}
                <div className="grid gap-1">
                  <Label htmlFor="login-username">Usuario / Correo</Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="Tu nombre de usuario o correo"
                    required
                    value={username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    onBlur={() => handleBlur("username")}
                    disabled={loading || googleLoading}
                    className={fieldErrors.username ? "border-red-500 focus:ring-red-200" : ""}
                    autoComplete="username"
                  />
                  {fieldErrors.username && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5 animate-fadeIn">
                      <LuCircleAlert size={12} /> {fieldErrors.username}
                    </span>
                  )}
                </div>

                {/* Campo Contraseña */}
                <div className="grid gap-1">
                  <div className="flex items-center">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <a
                      href="#"
                      className="ml-auto inline-block text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      onBlur={() => handleBlur("password")}
                      disabled={loading || googleLoading}
                      className={fieldErrors.password ? "border-red-500 pr-10 focus:ring-red-200" : "pr-10"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="auth-toggle-pw"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={
                        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                    >
                      {showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5 animate-fadeIn">
                      <LuCircleAlert size={12} /> {fieldErrors.password}
                    </span>
                  )}
                </div>
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-2">
            <Button
              type="submit"
              form="login-form"
              className="w-full auth-btn-primary"
              disabled={loading || googleLoading}
            >
              {loading ? (
                <>
                  <LuLoaderCircle className="animate-spin" size={16} />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>

            <div className="auth-separator">
              <span>o continua con</span>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              type="button"
            >
              {googleLoading ? (
                <>
                  <LuLoaderCircle className="animate-spin" size={16} />
                  Conectando...
                </>
              ) : (
                <>
                  <FcGoogle size={18} />
                  Google
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default Login;
