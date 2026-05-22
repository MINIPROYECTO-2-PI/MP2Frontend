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

### Problemas conocidos / Pendientes

- El endpoint `/login` del backend no devuelve `displayName` para usuarios registrados manualmente — se consulta Firestore como workaround
- El botón "¿Olvidaste tu contraseña?" en Login no tiene funcionalidad — placeholder
- No hay endpoint para actualizar perfil de usuario (post-registro)

---

### Tiempo estimado vs real

| Actividad | Estimado | Real |
|-----------|----------|------|
| Auth manual + Google | 4h | — |
| Validaciones username | 2h | — |
| Rutas protegidas | 1.5h | — |
| Swagger docs | 2h | — |
| UX/HCI mejoras + bitácora | 2h | — |
| **Total** | **11.5h** | — |
