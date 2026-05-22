import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import { LuLoaderCircle, LuUserCheck, LuArrowLeft } from "react-icons/lu";

export function ChooseUsername() {
  const { tempGoogleUser, completeGoogleProfile, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username.trim()) {
      setError("El nombre de usuario es obligatorio");
      return;
    }

    if (username.trim().length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres");
      return;
    }

    setLoading(true);
    try {
      await completeGoogleProfile(username.trim());
      setSuccess("¡Perfil completado exitosamente! Redirigiendo...");
    } catch (err: any) {
      setError(err.message || "Error al completar tu perfil");
    } finally {
      setLoading(false);
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
            <LuUserCheck size={28} />
          </div>
          <h1 className="auth-brand-title">MeetClone</h1>
          <p className="auth-brand-subtitle">Solo un paso más, {tempGoogleUser?.displayName || "Estudiante"}</p>
        </div>

        <Card className="auth-card">
          <CardHeader>
            <CardTitle className="text-lg">Elige tu Nombre de Usuario</CardTitle>
            <CardDescription>
              Para completar tu registro con Google, debes elegir un nombre de usuario único en la plataforma.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form id="choose-username-form" onSubmit={handleSubmit}>
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

                <div className="grid gap-2">
                  <Label htmlFor="choose-username">Nombre de Usuario</Label>
                  <Input
                    id="choose-username"
                    type="text"
                    placeholder="ej: mi_usuario_unico"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    disabled={loading}
                    autoFocus
                    minLength={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Solo letras, números y guiones bajos. Mínimo 3 caracteres.
                  </p>
                </div>
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-2">
            <Button
              type="submit"
              form="choose-username-form"
              className="w-full auth-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LuLoaderCircle className="animate-spin" size={16} />
                  Guardando perfil...
                </>
              ) : (
                "Completar Registro"
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={logout}
              disabled={loading}
              type="button"
            >
              <LuArrowLeft size={16} className="mr-2" />
              Cancelar y Salir
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default ChooseUsername;
