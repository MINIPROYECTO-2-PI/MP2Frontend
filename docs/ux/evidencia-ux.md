# Evidencia UX/HCI — Sprint 1

## Decisión 1: Card de Login más grande, ancha y sin scroll

**Problema:** La pantalla de login era angosta (max-width 430px), obligaba a hacer scroll en viewports medianos, y los elementos se sentían apretados contra los bordes.

**Solución implementada:**
- Card ampliada a 960px de ancho máximo con padding interno de 56px
- Altura fija del viewport con `height: 100dvh; overflow: hidden` en el contenedor
- Centrado vertical absoluto sin estiramiento forzado
- Inputs de 54px de altura, botones de 56px, border-radius de 40px

**Principios HCI aplicados:**
| Principio | Aplicación |
|-----------|-----------|
| **Ley de Fitts** | Targets más grandes (inputs 54px, botones 56px) reducen el tiempo de interacción |
| **Proximidad** | Padding de 56px agrupa visualmente secciones sin saturar |
| **Carga cognitiva** | Sin scroll: toda la información visible de un vistazo |
| **Consistencia** | Mismo patrón visual en Login y Register |

**Captura:** (insertar screenshot de la card de login en viewport 1920×1080 mostrando la card centrada sin scroll)

---

## Decisión 2: Nombre completo del usuario desde Firestore

**Problema:** Al registrarse con email/contraseña, el dashboard mostraba "Usuario" y "sin_usuario" porque el backend no devolvía `displayName` ni `username` en la respuesta de login.

**Solución incorrecta (descartada):** Guardar `name`+`surname` en `sessionStorage` durante el registro y leerlo al hacer login.

**Solución final:** Consultar Firestore directamente desde el frontend con el `uid` del usuario para obtener los campos `name` y `surname`, construyendo el `displayName` como «Jhoan Munoz».

**Principios HCI aplicados:**
| Principio | Aplicación |
|-----------|-----------|
| **Reconocimiento sobre recuerdo** | El usuario ve su identidad real sin tener que recordar qué nombre usó |
| **Feedback** | El dashboard muestra inmediatamente el nombre completo tras el login |
| **Consistencia** | Misma fuente de datos (Firestore) para usuarios manuales y de Google |
| **Visibilidad del estado del sistema** | El nombre aparece en el navbar como confirmación de identidad |

**Captura:** (insertar screenshot del navbar mostrando "Jhoan Munoz" y "@jhoan_munoz" después de login manual)

---

## Resumen de cambios UX del Sprint

| Sprint | Cambio | Impacto UX |
|--------|--------|------------|
| C1 | Auth manual + Google con Firestore | Flujo completo sin pérdida de sesión |
| C2 | Validación de unicidad de username | Feedback inmediato, evita conflictos |
| C3 | Rutas protegidas y estados de carga/error | Dashboard inaccesible sin login, mensajes claros |
| C4 | Documentación Swagger de User API | Visibilidad del contrato API para desarrollo |
| C5 | Card login más grande y nombre desde Firestore | Menos fricción, identidad visible |
