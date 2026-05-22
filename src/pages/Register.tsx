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
import {
  LuLoaderCircle,
  LuUserPlus,
  LuEye,
  LuEyeOff,
  LuCircleAlert,
} from "react-icons/lu";

interface FieldErrors {
  username?: string;
  name?: string;
  surname?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

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

  // Estado para los errores de cada campo individual
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const updateField = (field: string, value: string) => {
    let formattedValue = value;

    // Auto-formatear nombre de usuario (quitar espacios, convertir a minúsculas)
    if (field === "username") {
      formattedValue = value.toLowerCase().replace(/\s+/g, "");
    }

    setForm((prev) => ({ ...prev, [field]: formattedValue }));

    // Validar en tiempo real si el campo ya ha sido tocado
    if (touched[field]) {
      validateSingleField(field, formattedValue);
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateSingleField(field, form[field as keyof typeof form]);
  };

  const validateSingleField = (field: string, value: string): string => {
    let errMessage = "";

    switch (field) {
      case "username":
        if (!value.trim()) {
          errMessage = "El nombre de usuario es requerido";
        } else if (value.trim().length < 3) {
          errMessage = "Debe tener al menos 3 caracteres";
        } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          errMessage = "Solo se permiten letras, números y guión bajo (_)";
        }
        break;
      case "name":
        if (!value.trim()) {
          errMessage = "El nombre es requerido";
        } else if (/\d/.test(value)) {
          errMessage = "El nombre no puede contener números";
        }
        break;
      case "surname":
        if (!value.trim()) {
          errMessage = "El apellido es requerido";
        } else if (/\d/.test(value)) {
          errMessage = "El apellido no puede contener números";
        }
        break;
      case "email":
        if (!value.trim()) {
          errMessage = "El correo electrónico es requerido";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errMessage = "Ingresa un formato de correo electrónico válido";
        } else if (
          !value.toLowerCase().endsWith(".edu.co") &&
          !value.toLowerCase().endsWith(".edu")
        ) {
          // Advierte/valida que sea un correo institucional
          errMessage =
            "Se sugiere ingresar un correo institucional (.edu.co / .edu)";
        }
        break;
      case "password":
        if (!value) {
          errMessage = "La contraseña es requerida";
        } else if (value.length < 6) {
          errMessage = "Debe tener al menos 6 caracteres";
        }
        break;
      case "confirmPassword":
        if (!value) {
          errMessage = "Confirma tu contraseña";
        } else if (value !== form.password) {
          errMessage = "Las contraseñas no coinciden";
        }
        break;
    }

    setFieldErrors((prev) => ({ ...prev, [field]: errMessage }));
    return errMessage;
  };

  const validateAll = (): boolean => {
    const errors: FieldErrors = {};
    let isValid = true;

    // Forzar marcado de todos los campos como tocados
    const allTouched: Record<string, boolean> = {};

    Object.keys(form).forEach((key) => {
      allTouched[key] = true;
      const fieldError = validateSingleField(
        key,
        form[key as keyof typeof form],
      );

      // Considerar error real si bloquea el flujo
      // El correo institucional puede ser sugerencia, pero si está mal el formato general, bloquea.
      if (
        fieldError &&
        (key !== "email" ||
          !form.email.includes("@") ||
          fieldError.includes("formato"))
      ) {
        errors[key as keyof FieldErrors] = fieldError;
        isValid = false;
      }
    });

    setTouched(allTouched);
    return isValid;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const isValid = validateAll();
    if (!isValid) {
      setError("Por favor corrige los campos indicados antes de continuar");
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
      setSuccess("¡Cuenta creada con éxito! Redirigiendo al login...");
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      if (err.message.toLowerCase().includes("usuario")) {
        setFieldErrors((prev) => ({ ...prev, username: err.message }));
        setError("El nombre de usuario ya está ocupado");
      } else if (
        err.message.toLowerCase().includes("correo") ||
        err.message.toLowerCase().includes("email")
      ) {
        setFieldErrors((prev) => ({ ...prev, email: err.message }));
        setError("El correo electrónico ya está registrado");
      } else {
        setError(err.message || "Error al registrar usuario");
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

  const isDisabled = loading || googleLoading;

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
            <LuUserPlus size={28} />
          </div>
          <h1 className="auth-brand-title">MeetClone</h1>
          <p className="auth-brand-subtitle">Crea tu cuenta y empieza</p>
        </div>

        <Card className="auth-card">
          <CardHeader>
            <CardTitle className="text-lg">Crear una cuenta</CardTitle>
            <CardDescription>
              Completa los datos para registrar tu perfil
            </CardDescription>
            <CardAction>
              <Link to="/" className="auth-link">
                Ya tengo cuenta
              </Link>
            </CardAction>
          </CardHeader>

          <CardContent>
            <form id="register-form" onSubmit={handleRegister} noValidate>
              <div className="flex flex-col gap-4">
                {/* Mensaje de error general */}
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

                {/* Input Username */}
                <div className="grid gap-1">
                  <Label htmlFor="register-username">
                    Nombre de Usuario Único
                  </Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="ej: jhoan_munoz"
                    required
                    value={form.username}
                    onChange={(e) => updateField("username", e.target.value)}
                    onBlur={() => handleBlur("username")}
                    disabled={isDisabled}
                    className={
                      fieldErrors.username
                        ? "border-red-500 focus:ring-red-200"
                        : ""
                    }
                    autoComplete="username"
                  />
                  {fieldErrors.username && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5 animate-fadeIn">
                      <LuCircleAlert size={12} /> {fieldErrors.username}
                    </span>
                  )}
                </div>

                {/* Inputs Nombres y Apellidos */}
                <div className="auth-row">
                  <div className="grid gap-1 flex-1">
                    <Label htmlFor="register-name">Nombres</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Juan"
                      required
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      onBlur={() => handleBlur("name")}
                      disabled={isDisabled}
                      className={
                        fieldErrors.name
                          ? "border-red-500 focus:ring-red-200"
                          : ""
                      }
                      autoComplete="given-name"
                    />
                    {fieldErrors.name && (
                      <span className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5 animate-fadeIn">
                        <LuCircleAlert size={12} /> {fieldErrors.name}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-1 flex-1">
                    <Label htmlFor="register-surname">Apellidos</Label>
                    <Input
                      id="register-surname"
                      type="text"
                      placeholder="Pérez"
                      required
                      value={form.surname}
                      onChange={(e) => updateField("surname", e.target.value)}
                      onBlur={() => handleBlur("surname")}
                      disabled={isDisabled}
                      className={
                        fieldErrors.surname
                          ? "border-red-500 focus:ring-red-200"
                          : ""
                      }
                      autoComplete="family-name"
                    />
                    {fieldErrors.surname && (
                      <span className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5 animate-fadeIn">
                        <LuCircleAlert size={12} /> {fieldErrors.surname}
                      </span>
                    )}
                  </div>
                </div>

                {/* Input Correo */}
                <div className="grid gap-1">
                  <Label htmlFor="register-email">Correo Institucional</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="estudiante@universidad.edu.co"
                    required
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    disabled={isDisabled}
                    className={
                      fieldErrors.email
                        ? fieldErrors.email.includes("Se sugiere")
                          ? "border-amber-500 focus:ring-amber-200"
                          : "border-red-500 focus:ring-red-200"
                        : ""
                    }
                    autoComplete="email"
                  />
                  {fieldErrors.email && (
                    <span
                      className={`text-[11px] flex items-center gap-1 mt-0.5 animate-fadeIn ${
                        fieldErrors.email.includes("Se sugiere")
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      <LuCircleAlert size={12} /> {fieldErrors.email}
                    </span>
                  )}
                </div>

                {/* Input Contraseña */}
                <div className="grid gap-1">
                  <Label htmlFor="register-password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={form.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      onBlur={() => handleBlur("password")}
                      disabled={isDisabled}
                      className={
                        fieldErrors.password ? "border-red-500 pr-10" : "pr-10"
                      }
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="auth-toggle-pw"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar" : "Mostrar"}
                    >
                      {showPassword ? (
                        <LuEyeOff size={16} />
                      ) : (
                        <LuEye size={16} />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5 animate-fadeIn">
                      <LuCircleAlert size={12} /> {fieldErrors.password}
                    </span>
                  )}
                </div>

                {/* Input Confirmar Contraseña */}
                <div className="grid gap-1">
                  <Label htmlFor="register-confirm-password">
                    Confirmar Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="register-confirm-password"
                      type={showConfirm ? "text" : "password"}
                      required
                      placeholder="Repite tu contraseña"
                      value={form.confirmPassword}
                      onChange={(e) =>
                        updateField("confirmPassword", e.target.value)
                      }
                      onBlur={() => handleBlur("confirmPassword")}
                      disabled={isDisabled}
                      className={
                        fieldErrors.confirmPassword
                          ? "border-red-500 pr-10"
                          : "pr-10"
                      }
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="auth-toggle-pw"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                      aria-label={showConfirm ? "Ocultar" : "Mostrar"}
                    >
                      {showConfirm ? (
                        <LuEyeOff size={16} />
                      ) : (
                        <LuEye size={16} />
                      )}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5 animate-fadeIn">
                      <LuCircleAlert size={12} /> {fieldErrors.confirmPassword}
                    </span>
                  )}
                </div>
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-2">
            <Button
              type="submit"
              form="register-form"
              className="w-full auth-btn-primary"
              disabled={isDisabled}
            >
              {loading ? (
                <>
                  <LuLoaderCircle className="animate-spin" size={16} />
                  Registrando...
                </>
              ) : (
                "Crear cuenta"
              )}
            </Button>

            <div className="auth-separator">
              <span>o registrate con</span>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isDisabled}
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

export default Register;
