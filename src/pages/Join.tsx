import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LuVideo,
  LuArrowLeft,
  LuDoorOpen,
  LuLoaderCircle,
  LuCircleAlert,
  LuClipboardPaste,
  LuCheck,
  LuHash,
  LuShieldCheck,
  LuUsers,
} from "react-icons/lu";

const SEGMENT_LENGTHS = [3, 4, 3]; // abc-defg-hij
const TOTAL_RAW = 10; // 3 + 4 + 3
const PATTERN = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;

/** Strip dashes and non-allowed chars, keep only lowercase alphanumerics */
const sanitize = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, TOTAL_RAW);

/** Insert dashes at correct positions: 3-4-3 */
const formatId = (clean: string): string => {
  let result = "";
  let cursor = 0;
  for (let i = 0; i < SEGMENT_LENGTHS.length; i++) {
    const seg = clean.slice(cursor, cursor + SEGMENT_LENGTHS[i]);
    if (!seg) break;
    if (i > 0) result += "-";
    result += seg;
    cursor += SEGMENT_LENGTHS[i];
  }
  return result;
};

const Join: React.FC = () => {
  const [rawInput, setRawInput] = useState(""); // only alphanumerics, no dashes
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [pasted, setPasted] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const formatted = formatId(rawInput);
  const isComplete = rawInput.length === TOTAL_RAW;
  const isValid = PATTERN.test(formatted);

  // Segment fill progress (for visual indicators)
  const segmentFills = (() => {
    let cursor = 0;
    return SEGMENT_LENGTHS.map((len) => {
      const filled = Math.min(rawInput.length - cursor, len);
      cursor += len;
      return Math.max(0, filled);
    });
  })();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = sanitize(e.target.value);
    setRawInput(clean);
    setErrorMsg("");
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const clean = sanitize(text);
      if (clean.length > 0) {
        setRawInput(clean);
        setErrorMsg("");
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
        inputRef.current?.focus();
      }
    } catch {
      // Clipboard API not available or permission denied
    }
  };

  const triggerShake = (msg: string) => {
    setErrorMsg(msg);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!rawInput) {
      triggerShake("Ingresa el ID de la reunión");
      return;
    }

    if (!isValid) {
      triggerShake(
        "Formato inválido. Debe ser 3-4-3 caracteres (ej: abc-defg-hij)"
      );
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      navigate(`/room/${formatted}`);
    }, 800);
  };

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="join-page">
      {/* Background blobs */}
      <div className="join-blob join-blob--1" />
      <div className="join-blob join-blob--2" />
      <div className="join-blob join-blob--3" />

      <div className="join-container">
        {/* ─── Left Panel ─── */}
        <div className="join-panel-left">
          <div className="join-panel-brand">
            <div className="join-panel-logo">
              <LuVideo size={18} />
            </div>
            <span className="join-panel-brand-name">MeetClone</span>
          </div>

          <div className="join-panel-content">
            <h2 className="join-panel-heading">
              Únete a una
              <br />
              reunión en
              <br />
              <span className="join-panel-heading-accent">segundos.</span>
            </h2>
            <p className="join-panel-desc">
              Ingresa el código que te compartieron y conéctate al instante con
              tu equipo de estudio.
            </p>

            <div className="join-panel-features">
              {[
                {
                  icon: <LuHash size={14} />,
                  text: "Códigos únicos de 10 caracteres",
                },
                {
                  icon: <LuShieldCheck size={14} />,
                  text: "Conexión segura y encriptada",
                },
                {
                  icon: <LuUsers size={14} />,
                  text: "Colaboración en tiempo real",
                },
              ].map((f) => (
                <div key={f.text} className="join-panel-feature">
                  <span className="join-panel-feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <span className="join-panel-footer">© 2026 MeetClone</span>
        </div>

        {/* ─── Right Panel (form) ─── */}
        <div className="join-panel-right">
          <div className="join-form-header">
            <h1 className="join-form-title">Unirse a Reunión</h1>
            <p className="join-form-subtitle">
              Pega o escribe el código de la sala para entrar
            </p>
          </div>

          <div className="join-form-divider" />

          {/* Error alert */}
          {errorMsg && (
            <div
              className={`join-alert join-alert--error ${shakeError ? "join-shake" : ""}`}
            >
              <LuCircleAlert size={15} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="join-form" noValidate>
            {/* Label */}
            <div className="join-input-group">
              <label htmlFor="meetingId" className="join-label">
                Código de la reunión
              </label>

              {/* Input with paste button */}
              <div className="join-input-row">
                <div className="join-input-wrapper">
                  <LuHash
                    size={15}
                    className="join-input-icon"
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    id="meetingId"
                    value={formatted}
                    onChange={handleChange}
                    placeholder="abc-defg-hij"
                    className={`join-input ${errorMsg ? "join-input--error" : ""} ${isValid ? "join-input--valid" : ""}`}
                    maxLength={12}
                    disabled={submitting}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {isValid && (
                    <LuCheck size={16} className="join-input-check" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="join-paste-btn"
                  title="Pegar del portapapeles"
                  disabled={submitting}
                >
                  {pasted ? <LuCheck size={16} /> : <LuClipboardPaste size={16} />}
                  <span className="join-paste-label">
                    {pasted ? "Pegado" : "Pegar"}
                  </span>
                </button>
              </div>

              {/* Segment progress indicator */}
              <div className="join-segments">
                {SEGMENT_LENGTHS.map((len, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="join-segment-dash">-</span>}
                    <div className="join-segment">
                      <div
                        className="join-segment-fill"
                        style={{
                          width: `${(segmentFills[i] / len) * 100}%`,
                        }}
                      />
                      <span className="join-segment-text">
                        {segmentFills[i]}/{len}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || !rawInput}
              className="join-submit-btn"
            >
              {submitting ? (
                <>
                  <LuLoaderCircle className="join-spinner" size={17} />
                  Accediendo a la sala…
                </>
              ) : (
                <>
                  <LuDoorOpen size={17} />
                  Unirse a la Reunión
                </>
              )}
            </button>
          </form>

          <div className="join-form-divider" />

          {/* Back link */}
          <button
            onClick={() => navigate("/home")}
            disabled={submitting}
            className="join-back-btn"
          >
            <LuArrowLeft size={14} />
            <span>Volver al Inicio</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Join;