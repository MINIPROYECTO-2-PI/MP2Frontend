import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuVideo, LuArrowLeft, LuDoorOpen, LuLoaderCircle } from "react-icons/lu";

const Join: React.FC = () => {
  const [meetingId, setMeetingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanedId = meetingId.trim();
    if (!cleanedId) {
      setErrorMsg("El ID de la reunión es requerido");
      return;
    }

    // Pattern check: 3-4-3 (e.g., abc-defg-hij)
    const pattern = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;
    if (!pattern.test(cleanedId)) {
      setErrorMsg("Formato inválido. Debe ser abc-defg-hij (3-4-3 caracteres en minúscula)");
      return;
    }

    setSubmitting(true);
    // Directly navigate to the Room. The Room component handles socket validation in real-time.
    setTimeout(() => {
      navigate(`/room/${cleanedId}`);
    }, 800);
  };

  return (
    <div className="profile-page flex items-center justify-center min-h-screen">
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
      </div>

      <div className="auth-card relative z-10 max-w-md w-full mx-4">
        <div className="auth-header">
          <div className="auth-logo">
            <LuVideo size={24} />
          </div>
          <h2 className="auth-title">Unirse a una Reunión</h2>
          <p className="auth-subtitle">Ingresa el identificador único para ingresar a la sala</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form mt-6">
          <div className="auth-input-group">
            <label htmlFor="meetingId" className="auth-label">
              ID de la Reunión
            </label>
            <input
              type="text"
              id="meetingId"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value.toLowerCase())}
              placeholder="ej: abc-defg-hij"
              className="auth-input text-center tracking-widest font-mono"
              maxLength={12}
              disabled={submitting}
              autoFocus
            />
            {errorMsg && <p className="auth-error-msg mt-1.5 text-xs text-red-400">{errorMsg}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting || !meetingId.trim()}
            className="auth-btn mt-6 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <LuLoaderCircle className="profile-btn-spinner" size={18} />
            ) : (
              <LuDoorOpen size={18} />
            )}
            {submitting ? "Accediendo..." : "Unirse a la Reunión"}
          </button>
        </form>

        <button
          onClick={() => navigate("/home")}
          disabled={submitting}
          className="mt-6 flex items-center justify-center gap-2 text-white/50 hover:text-white text-xs w-full transition-all duration-200"
        >
          <LuArrowLeft size={14} />
          <span>Volver al Inicio</span>
        </button>
      </div>
    </div>
  );
};

export default Join;