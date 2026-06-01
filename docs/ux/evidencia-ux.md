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

## Decisión 3: Contraste y microcopy en Perfil (US-04), Eliminación de Cuenta (US-05) y Salas (US-06)

**Problema:** Las páginas de perfil, eliminación de cuenta y dashboard de salas requerían decisiones de contraste visual y microcopy que mantuvieran la coherencia con el sistema de diseño oscuro existente y guiaran al usuario sin ambigüedad.

**Contexto — US-04 (Ver y Editar Perfil):**
- Los campos de solo lectura vs. editables debían diferenciarse visualmente sin romper la consistencia.
- El feedback de acción (guardar/cancelar) debía ser inmediato y claro.

**Contexto — US-05 (Eliminar Cuenta):**
- Acción irreversible: el microcopy debía comunicar claramente las consecuencias.
- Confirmación por escritura explícita («ELIMINAR») para prevenir errores fatales.
- Contraste visual agresivo (rojo) para señalizar peligro.

**Contexto — US-06 (Crear y Visualizar Salas Propias):**
- El placeholder del input de creación debía sugerir un caso de uso real.
- Las salas vacías debían tener un estado vacío motivacional, no un mensaje genérico.
- La tarjeta de sala debía presentar la información jerarquizada (nombre, ID, fecha, entrar).

**Soluciones implementadas:**

### Contraste (Sistema de color consistente)

| Elemento | Color/Fondo | Ratio de contraste aproximado |
|----------|-------------|-------------------------------|
| Fondo página | `#05051a` | — |
| Texto primario | `rgba(255,255,255,0.9)` | ~14:1 sobre fondo |
| Texto secundario (labels, metadatos) | `rgba(255,255,255,0.5)` | ~7:1 |
| Texto terciario (placeholders) | `rgba(255,255,255,0.28)` | ~4:1 (mínimo para decorativo) |
| Acento (links, badges) | `#a5b4fc` | ~9:1 |
| Éxito (alertas, botón guardar) | `#059669` → `#10b981` gradient | ~5.5:1 |
| Error/peligro (alertas, eliminar) | `#dc2626` → `#b91c1c` gradient | ~4.5:1 |
| Card glassmorphism | `rgba(15,12,32,0.55)` + `backdrop-filter: blur(32px)` | Mantiene legibilidad del texto |
| Input focus | Indigo glow `rgba(99,102,241,0.6)` | Señalización multimodal |
| Input error (US-05 modal) | Borde rojo `rgba(239,68,68,0.2)` + glow `rgba(239,68,68,0.3)` | Contraste cromático alto |

### Microcopy (Español — es-CO)

| Contexto | Texto | Principio HCI |
|----------|-------|---------------|
| Placeholder nombre | `"Tu nombre"` | **Naturalidad**: tono posesivo dueño del dato |
| Placeholder apellido | `"Tu apellido"` | **Consistencia**: mismo patrón que nombre |
| Placeholder username | `"Tu username"` | **Consistencia**: mismo patrón |
| Placeholder email | `"Tu correo"` | **Consistencia**: coloquial pero preciso |
| Placeholder crear sala | `"Nombre de la sala (ej: Estudio de Cálculo)"` | **Ejemplo contextual**: sugiere un caso de estudio real universitario |
| Botón editar | `"Editar Perfil"` | **Reconocimiento**: verbo + objeto directo |
| Botón guardar | `"Guardar Cambios"` / `"Guardando..."` | **Feedback**: estado loading con gerundio |
| Botón cancelar (edición) | `"Cancelar"` | **Consistencia**: mismo término en toda la app |
| Botón eliminar cuenta | `"Eliminar Cuenta"` | **Claridad**: sin eufemismos |
| Éxito al guardar | `"¡Perfil actualizado exitosamente!"` | **Feedback positivo**: exclamación + adverbio |
| Error al guardar | `"Error al actualizar perfil"` / mensaje del servidor | **Feedback informativo**: causa del error |
| Título modal eliminar | `"⚠️ Eliminar Cuenta"` | **Señal de peligro**: icono + texto |
| Descripción modal | `"Esta acción es permanente e irreversible. Se eliminarán todos tus datos de Firestore y tu cuenta de Firebase Auth. No podrás recuperar tu información."` | **Comunicación de riesgo**: triple énfasis (permanente, irreversible, no recuperarás) |
| Confirmación | `"Escribe ELIMINAR para confirmar:"` / placeholder `"ELIMINAR"` | **Forense**: requiere escritura activa, no solo clic |
| Botón confirmar delete | `"Sí, Eliminar mi Cuenta"` / `"Eliminando..."` | **Compromiso**: primera persona posesiva («mi Cuenta») |
| Botón cancelar (modal) | `"Cancelar"` | **Consistencia**: misma etiqueta que en otros contextos |
| Título dashboard | `"Mis Salas de Estudio"` | **Pertenencia**: posesivo «Mis» + propósito «de Estudio» |
| Subtítulo dashboard | `"Crea y administra tus espacios de estudio colaborativo"` | **Propósito**: explica el valor del producto |
| Estado vacío título | `"No tienes salas aún"` | **Neutral positivo**: sin culpa, «aún» implica posibilidad |
| Estado vacío descripción | `"¡Crea tu primera sala de estudio y comienza a colaborar con otros estudiantes!"` | **Llamado a la acción**: tono entusiasta, especifica el beneficio social |
| Botón empty state | `"Crear mi primera sala"` | **Personalizado**: «mi primera» → owned action |
| Crear sala exitoso | `` `¡Sala "${room.name}" creada exitosamente!` `` | **Feedback nominal**: incluye el nombre de la sala creada |
| Badge rol sala | `"Administrador"` | **Identidad de rol**: indica propiedad |
| Botón entrar sala | `"Entrar a la sala"` | **Acción clara**: verbo de movimiento |
| Label contador crear sala | `"{n}/50"` | **Restricción visible**: indica límite de caracteres en tiempo real |
| Loading perfil | `"Cargando perfil..."` | **Feedback**: estado de carga descriptivo |
| Loading salas | `"Cargando tus salas..."` | **Feedback**: estado de carga con posesivo |
| Error al crear sala | `"El nombre de la sala es requerido"` | **Prevención de error**: validación inmediata |

### Principios HCI aplicados

| Principio | Aplicación en US-04 | Aplicación en US-05 | Aplicación en US-06 |
|-----------|---------------------|---------------------|---------------------|
| **Prevención de errores** | Cancel edit descarta cambios sin confirmación | Modal + escritura «ELIMINAR» evita eliminación accidental | Validación `!roomName.trim()` antes de enviar |
| **Visibilidad del estado del sistema** | Labels muestran modo edición/lectura, alertas de éxito/error | Pulsing icon (`LuShieldAlert`), botón disabled hasta escribir «ELIMINAR» | Counter `{n}/50`, loading spinner + texto, alertas |
| **Consistencia y estándares** | Mismos patrones glassmorphism, inputs, botones que Login/Register | Botón delete usa rojo consistente con logout y otros destructivos | Mismo sistema de alertas que Profile (`.profile-alert`) |
| **Control y libertad del usuario** | Cancelar edición restaura valores originales | Cancelar modal cierra sin eliminar | Cancelar creación descarta formulario |
| **Reconocimiento sobre recuerdo** | Placeholders recuerdan qué escribir en cada campo | «ELIMINAR» visible en placeholder — el usuario no necesita memorizar | Empty state motiva acción sin tener que recordar dónde crear |
| **Flexibilidad y eficiencia** | Edición inline sin navegar a otra página | — | Crear sala desde el mismo dashboard sin cambiar de ruta |
| **Diseño estético y minimalista** | Glassmorphism, espaciado generoso (padding 36-40px), jerarquía visual clara | Modal centrado, icono pulsante, sin ruido visual | Grid responsive, tarjetas con info jerárquica, hover states sutiles |
| **Ayuda a los usuarios** | Alertas con color coding (verde=éxito, rojo=error) | Descripción explícita de irreversibilidad | Placeholder con ejemplo concreto de uso |

**Capturas:** (insertar screenshots de perfil en edición, modal de eliminar con texto escrito, dashboard con salas listadas y empty state)

---

## Resumen de cambios UX del Sprint

| Sprint | Cambio | Impacto UX |
|--------|--------|------------|
| C1 | Auth manual + Google con Firestore | Flujo completo sin pérdida de sesión |
| C2 | Validación de unicidad de username | Feedback inmediato, evita conflictos |
| C3 | Rutas protegidas y estados de carga/error | Dashboard inaccesible sin login, mensajes claros |
| C4 | Documentación Swagger de User API | Visibilidad del contrato API para desarrollo |
| C5 | Card login más grande y nombre desde Firestore | Menos fricción, identidad visible |
| **C6** | **Perfil de usuario (US-04) — ver, editar, guardar** | **Control de identidad, feedback inmediato, modo edición/lectura claro** |
| **C7** | **Eliminar cuenta (US-05) — modal con confirmación escrita** | **Prevención de error fatal, microcopy de riesgo, contraste rojo señalizador** |
| **C8** | **Crear y listar salas (US-06) — dashboard + empty state** | **Gestión visual de espacios, jerarquía de información, microcopy motivacional** |
