# Bitácora de Sprinte — MeetClone Frontend

## Sprint 1 — Auth, Validaciones, UI/UX y Documentación

### Resumen
- **Duración:** 1 sprint
- **Objetivo:** Implementar autenticación manual y con Google, validaciones de username, rutas protegidas, documentación Swagger, y mejoras UX/HCI.
- **Rama:** `feature/swagger-docs`

---

### C1 — US-01/02/03 Auth manual y Google

**Estado: ✅ Completado**

| Tarea | Estado | Notas |
|-------|--------|-------|
| Registro manual con email, contraseña, nombre y apellido | ✅ | Endpoint POST `/register` |
| Login con username o email + contraseña | ✅ | Endpoint POST `/login` |
| Login con Google (popup OAuth) | ✅ | Firebase Auth + POST `/google-login` |
| Persistencia de sesión en localStorage | ✅ | Clave `meet_clone_user` |
| Flujo completo: registro → login → dashboard | ✅ | Sin pérdida de datos |

**Decisiones UX:**
- Descartado el uso de `sessionStorage` para pasar nombre entre registro y login — inconsistente con la fuente oficial (Firestore)
- Implementada consulta directa a Firestore desde el frontend para obtener `name` + `surname` tras el login

---

### C2 — TS-01: Validaciones Username

**Estado: ✅ Completado**

| Tarea | Estado | Notas |
|-------|--------|-------|
| Validación de longitud mínima (3 caracteres) | ✅ | Feedback en tiempo real |
| Validación de caracteres permitidos (solo alfanumérico + `_`) | ✅ | Regex `^[a-zA-Z0-9_]+$` |
| Auto-formateo: minúsculas y sin espacios | ✅ | `onChange` transforma el input |
| Bloqueo de usernames duplicados (error del backend) | ✅ | Se muestra error en el campo |
| Exigencia de username para usuarios de Google | ✅ | Pantalla intermedia `/choose-username` |

**Decisiones UX:**
- Validación en blur + en tiempo real si el campo ya fue tocado — balance entre feedback inmediato y no molestar antes de interactuar
- Error de servidor mapeado al campo específico, no solo mensaje general

---

### C3 — Rutas protegidas y Estados UI

**Estado: ✅ Completado**

| Tarea | Estado | Notas |
|-------|--------|-------|
| `ProtectedRoute` redirige a `/` si no hay sesión | ✅ | `Navigate` de react-router |
| `PublicRoute` redirige a `/home` si ya hay sesión | ✅ | Evita ver login estando autenticado |
| `UsernameRequiredRoute` para Google pendiente | ✅ | Redirige a `/choose-username` |
| Loading screen con spinner | ✅ | `LoadingScreen` con animación |
| Alertas de error y éxito animadas | ✅ | Slide-in con colores distintivos |
| Estados disabled en formularios durante carga | ✅ | Previene doble envío |

**Decisiones UX:**
- Loading screen con blur background y spinner evita parpadeo al verificar auth
- Alertas animadas con color coding (rojo = error, verde = éxito, ámbar = advertencia)

---

### C4 — API / DB Docs (Swagger)

**Estado: ✅ Completado**

| Tarea | Estado | Notas |
|-------|--------|-------|
| Instalación de `swagger-ui-react` | ✅ | v5.32.6 |
| Spec OpenAPI 3.0 para User endpoints | ✅ | 5 endpoints documentados |
| Página `/docs` con Swagger UI | ✅ | Ruta pública sin autenticación |
| Schemas: RegisterData, LoginData, User, AuthResponse | ✅ | Tipos completos |

**Archivos:**
- `src/docs/user-api.json`
- `src/pages/SwaggerDocs.tsx`
- `src/types/swagger-ui-react.d.ts`

---

### C5 — Evidencia UX/HCI + Bitácora

**Estado: ✅ Completado**

**Decisiones UX documentadas:**

| # | Decisión | Base HCI |
|---|----------|----------|
| 1 | Card de login más ancha (960px), sin scroll, padding 56px | Ley de Fitts, Carga cognitiva, Proximidad |
| 2 | Nombre completo desde Firestore en lugar de sessionStorage | Reconocimiento, Consistencia, Feedback |

**Archivos:**
- `docs/ux/evidencia-ux.md` — Documento de evidencia con principios HCI aplicados y capturas
- `docs/ux/bitacora.md` — Este archivo

---

---

## Sprint 2 — Perfil de Usuario, Eliminación de Cuenta y Gestión de Salas

### Resumen
- **Duración:** 1 sprint
- **Objetivo:** Implementar vista/edición de perfil (US-04), eliminación de cuenta con confirmación (US-05), y creación/visualización de salas propias (US-06). Enfoque en contraste visual, microcopy, y principios HCI.
- **Rama:** `feature/swagger-docs` (continuación)

---

### C6 — US-04: Ver y Editar Perfil de Usuario

**Estado: ✅ Completado**

| Tarea | Estado | Notas |
|-------|--------|-------|
| Vista de perfil con datos desde `GET /profile/:uid` | ✅ | Avatar, nombre, apellido, username, email, provider badge |
| Modo edición inline con inputs editables | ✅ | Placeholders: "Tu nombre", "Tu apellido", "Tu username", "Tu correo" |
| Guardar cambios via `PUT /profile/:uid` | ✅ | Botón "Guardar Cambios" con estado "Guardando..." |
| Cancelar edición restaura valores originales del servidor | ✅ | Sin confirmación intermedia (bajo riesgo) |
| Alertas de éxito/error animadas con auto-dismiss | ✅ | Verde éxito (4s), rojo error (5s) |
| Diferenciación visual modo lectura vs. edición | ✅ | Read: `.profile-field-value` con bg sutil; Edit: `.profile-field-input` con foco indigo |
| Loading state con spinner | ✅ | `"Cargando perfil..."` + `LuLoaderCircle` |

**Decisiones UX:**
- Modo edición inline sin cambiar de ruta — reduce fricción y mantiene contexto
- Placeholders posesivos («Tu nombre») — refuerzan pertenencia y guían entrada
- Botón "Cancelar" restaura desde el servidor, no desde estado local — evita datos obsoletos
- Provider badge (🔗 Google / 📧 Email) — visibilidad del método de autenticación

---

### C7 — US-05: Eliminar Cuenta de Usuario

**Estado: ✅ Completado**

| Tarea | Estado | Notas |
|-------|--------|-------|
| Modal de confirmación con overlay blur | ✅ | `profile-modal-overlay` con `backdrop-filter: blur(8px)` |
| Descripción del riesgo (irreversibilidad) | ✅ | Texto explícito: "permanente e irreversible" + "No podrás recuperar tu información" |
| Confirmación por escritura "ELIMINAR" | ✅ | Input con placeholder "ELIMINAR", botón disabled hasta coincidir |
| Botón destructivo con estilo rojo | ✅ | Gradient `#dc2626` → `#b91c1c` con glow rojo |
| Eliminación en backend (`DELETE /profile/:uid`) + Firebase Auth | ✅ | Doble eliminación con fallback |
| Loading state durante eliminación | ✅ | "Eliminando..." + spinner |
| Redirección al home post-eliminación | ✅ | `navigate("/", { replace: true })` |
| Icono pulsante de advertencia | ✅ | `LuShieldAlert` con animación pulse |

**Decisiones UX:**
- Modal con overlay blur aísla visualmente la acción del resto de la UI
- Confirmación por escritura — requiere acción deliberada, previene clics accidentales
- Botón "Sí, Eliminar mi Cuenta" en primera persona («mi Cuenta») — refuerza compromiso
- Descripción triplemente enfática (permanente, irreversible, no recuperarás) — asegura comprensión del riesgo
- Sin opción de "recordar elección" — cada eliminación debe ser explícita

---

### C8 — US-06: Crear y Visualizar Salas Propias

**Estado: ✅ Completado**

| Tarea | Estado | Notas |
|-------|--------|-------|
| Listado de salas desde `GET /rooms/:uid` | ✅ | Grid responsive `repeat(auto-fill, minmax(320px,1fr))` |
| Formulario inline para crear sala | ✅ | Input con counter `{n}/50`, validación de campo requerido |
| Creación via `POST /rooms` | ✅ | Botón "Crear Sala" / "Creando..." |
| Empty state motivacional | ✅ | `LuDoorOpen` icon, título "No tienes salas aún", botón "Crear mi primera sala" |
| Tarjeta de sala con nombre, ID, fecha y botón entrar | ✅ | Badge "Administrador", ID copiable, fecha en formato `es-CO` |
| Copiar ID de sala al portapapeles | ✅ | Feedback visual con `LuCheck` (2s) |
| Alerta de éxito con nombre de sala | ✅ | `¡Sala "${room.name}" creada exitosamente!` |
| Loading state con spinner | ✅ | `"Cargando tus salas..."` |
| Character counter en tiempo real | ✅ | `{roomName.length}/50` |

**Decisiones UX:**
- Creación inline en el dashboard — evita navegar a otra página para crear
- Placeholder con ejemplo contextual («ej: Estudio de Cálculo») — alinea con el dominio universitario
- Empty state usa tono positivo («No tienes salas **aún**») + CTA grande — motivación sobre advertencia
- Badge "Administrador" en cada tarjeta — identidad de rol clara
- ID de sala en monospace con botón copiar — facilita compartir
- Fecha formateada con `toLocaleDateString("es-CO")` — localización colombiana

---

### Problemas conocidos / Pendientes

- El endpoint `/login` del backend no devuelve `displayName` para usuarios registrados manualmente — se consulta Firestore como workaround
- El botón "¿Olvidaste tu contraseña?" en Login no tiene funcionalidad — placeholder
- No hay endpoint para actualizar perfil de usuario (post-registro) — resuelto en C6
- La sala interactiva (US-07) con video/chat en tiempo real está en desarrollo

---

### Tiempo estimado vs real

| Actividad | Estimado | Real |
|-----------|----------|------|
| Auth manual + Google (C1) | 4h | — |
| Validaciones username (C2) | 2h | — |
| Rutas protegidas (C3) | 1.5h | — |
| Swagger docs (C4) | 2h | — |
| UX/HCI mejoras + bitácora (C5) | 2h | — |
| Perfil de usuario (C6) | 3h | — |
| Eliminar cuenta (C7) | 2h | — |
| Crear y listar salas (C8) | 3h | — |
| **Total** | **19.5h** | — |
