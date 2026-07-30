# Lista Completa de Pendientes — Munay

> **Última actualización:** 30/7/2026
> **Ramas activas:** `v0/munay-expansion-clean` (producción)
> **URL:** https://munayy.vercel.app

---

## 📊 Leyenda

| Icono | Significado |
|:---:|---|
| 🔴 **Crítico** | Afecta ingresos o funcionalidad core |
| 🟡 **Medio** | Mejora importante, pero no bloqueante |
| 🟢 **Bajo** | Polish, UX, opcional |
| ⬜ **Futuro** | Post-MVP, roadmap |

---

## 🚨 1. UX/UI — Funciones mencionadas en la interfaz que NO funcionan

Estas son funcionalidades que **existen en la UI/UX** (botones, secciones, textos) pero aún no están implementadas realmente.

| # | Feature | Dónde aparece | Estado real | Prioridad |
|:---:|---|:---|:---:|:---:|
| 1.1 | **Envío a Ibarra gratis / Servientrega nacional** | Checkout: "Envíos en Ibarra y todo Ecuador" | 🟡 **Mock:** Shipping es $2.00 fijo hardcodeado. El usuario ingresa ciudad/provincia pero no afecta el cálculo. Ibarra no es gratis. | 🔴 |
| 1.2 | **Catálogo sin imágenes de producto** | `/catalogo`, `/p/[slug]` | 🟡 **Placeholder:** Muestra icono `ImageOff` o `Sparkles`. Los productos existen en DB pero sin fotos. Storage configurado pero vacío. | 🔴 |
| 1.3 | **Pago con tarjeta real** | `/checkout` | 🟡 **Modo demo:** Usa tarjeta de prueba 4111... No hay tokenización real con Kushki.js. Cualquiera puede \"pagar\" sin dinero real. | 🔴 |
| 1.4 | **Tickets de soporte** | `/soporte` | 🟡 **Parcial:** La página existe, el formulario intenta `POST /api/tickets`, pero no hay tabla `tickets` en la DB (falta ejecutar la migración SQL). El envío a WhatsApp está implementado como fallback. | 🟡 |
| 1.5 | **Botón flotante WhatsApp** | Todas las páginas (esquina inferior derecha) | ✅ **Funciona:** Abre `wa.me/+593959756845` en nueva pestaña. | ✅ |
| 1.6 | **Redes sociales en footer** | Footer: WhatsApp, Instagram, TikTok | ✅ **Funciona:** Links reales con `target="_blank" rel="noopener noreferrer"`. | ✅ |
| 1.7 | **Mystery Box** | `/catalogo` | 🟡 **Bloqueada:** Aparece en catálogo con badge "Próximamente" y botón deshabilitado. No se puede abrir ni comprar. | 🟢 |
| 1.8 | **Reordenar imágenes de producto** | Admin → Editar producto | ✅ **Funciona:** Fase 5 implementada con overlay hover (moveUp/moveDown/setAsMain/delete). | ✅ |
| 1.9 | **Cupones de fidelidad post-compra** | `/checkout/success`, `/cuenta` | 🟡 **Implementado pero sin probar:** Sistema de cupones de 1 solo uso, 20-30% desc., caducan 7 días. Se genera después del pago exitoso. No se ha verificado end-to-end. | 🟡 |
| 1.10 | **Puntos de fidelidad** | `/checkout`, `/cuenta/puntos` | ✅ **Funciona:** Ledger, redención en checkout, balance visible. | ✅ |

---

## 🔧 2. Infraestructura — Servicios externos no configurados o en modo demo

| # | Servicio | Estado actual | Lo que falta | Prioridad |
|:---:|---|:---|:---|:---:|
| 2.1 | **Cloudinary (imágenes)** | ✅ **Completo:** SDK instalado, API routes creadas, Upload Widget en admin, galería en frontend, env vars en Vercel. Column `public_id` ejecutada en Neon. | Nada — listo para subir imágenes. | ✅ |
| 2.2 | **Cloudflare Turnstile** | 🟡 **Keys de prueba:** `1x00000000000000000000AA` (test mode — no protege contra bots reales). | Crear widget en Cloudflare Dashboard y cambiar keys. | 🟡 |
| 2.3 | **Brevo (emails)** | ✅ **Configurado:** API key en `.env.local`. Módulo de email migrado de Resend a Brevo. | Verificar envío real desde producción. | 🟡 |
| 2.4 | **Kushki (pagos)** | 🟡 **Modo demo:** `PAYMENT_SANDBOX=true`. Usa tarjeta de prueba. Sin Kushki.js tokenization real. | Crear cuenta merchant, completar KYC, integrar Kushki.js embebido, cambiar a producción. | 🔴 |
| 2.5 | **Vercel Cron (expirar órdenes)** | ✅ **Configurado:** `vercel.json` con schedule, endpoint protegido con `CRON_SECRET`. | Verificar que aparece en Vercel Cron Jobs. | 🟡 |

---

## 📋 3. Features de negocio — Funcionalidades completas pendientes

| # | Feature | Descripción | Archivos necesarios | Prioridad |
|:---:|---|:---|:---|:---:|
| 3.1 | **Productos con fotos reales** | Subir imágenes de los 5 productos actuales a Cloudinary desde el admin o con el script bulk. | `scripts/migrate-images-to-cloudinary.mjs` | 🔴 |
| 3.2 | **Envío: gratis Ibarra / tarifas Servientrega** | Crear tabla `shipping_zones`, API `POST /api/shipping/calculate`, checkout dinámico. | DB migration + API + checkout UI | 🔴 |
| 3.3 | **Kushki producción (pagos reales)** | Kushki.js embebido, tokenización, webhook en producción. | `kushki-card-form.tsx`, update checkout | 🔴 |
| 3.4 | **Tabla `tickets` en DB** | Ejecutar migración SQL para `tickets` (id, name, email, message, status). | SQL en Neon Editor | 🟡 |
| 3.5 | **Turnstile a producción** | Cambiar keys de test por reales. | Cloudflare Dashboard + Vercel env | 🟡 |
| 3.6 | **Cupones de fidelidad — verificación E2E** | Probar flujo completo: compra → cupón generado → aparece en checkout → se aplica. | Testing manual | 🟡 |
| 3.7 | **Cron: verificar funcionamiento** | Confirmar que Vercel Cron ejecuta `expire-orders` cada 15 min. | Vercel Dashboard | 🟡 |

---

## 🧹 4. UX/UI — Mejoras y polish

| # | Mejora | Dónde | Descripción | Prioridad |
|:---:|---|:---|:---|:---:|
| 4.1 | **Lightbox/zoom en galería de producto** | `/p/[slug]` | Al hacer clic en la imagen principal, abrir overlay con zoom y navegación. | 🟢 |
| 4.2 | **Overlay móvil en ImageUpload** | Admin → Editar producto | Los botones de reordenar/eliminar solo aparecen en hover (no funcionan en móvil). Agregar `focus-within` o versión mobile. | 🟢 |
| 4.3 | **Confirmación antes de eliminar imagen** | Admin → Editar producto | El botón Trash2 elimina inmediatamente sin `confirm()`. Agregar diálogo de confirmación. | 🟢 |
| 4.4 | **Placeholder `ImageOff` consistente** | Catálogo, producto | El icono `Sparkles` en ProductCard es genérico. Unificar a `ImageOff` como en ProductGallery. | 🟢 |
| 4.5 | **Mensaje "Los cambios se guardan en Supabase" obsoleto** | Admin → Nuevo producto | El proyecto migró a Neon. El texto del form está desactualizado. | 🟢 |
| 4.6 | **Página de envíos dedicada** | `/info` o nueva | Detallar tarifas por provincia, tiempos de entrega, políticas. | 🟢 |

---

## 🗺️ 5. Rutas existentes y su estado

Basado en el último build (27 rutas generadas):

| Ruta | Estado | UX/UI funcional? |
|:---|---|:---:|
| `/` (landing) | ✅ Estático | Sí — diseño Munay |
| `/catalogo` | ✅ Dinámico | Sí — filtros, búsqueda, flash codes |
| `/p/[slug]` | ✅ Dinámico | Sí — galería, add-to-cart, flash descuento |
| `/carrito` | ✅ Estático | Sí — Zustand persist, flash code input |
| `/checkout` | ✅ Estático | Sí — pero pago en demo |
| `/checkout/success` | ✅ Estático | Sí — confirmación |
| `/checkout/pending` | ✅ Estático | Sí |
| `/checkout/cancelled` | ✅ Estático | Sí |
| `/flash` | ✅ Estático | Sí — entrada de código |
| `/flash/[code]` | ✅ Dinámico | Sí — oferta/desbloqueo |
| `/cuenta` | ✅ Dinámico | Sí — dashboard usuario |
| `/cuenta/login` | ✅ Dinámico | Sí — Clerk auth |
| `/cuenta/ordenes` | ✅ Dinámico | Sí — historial |
| `/cuenta/ordenes/[id]` | ✅ Dinámico | Sí — detalle |
| `/cuenta/puntos` | ✅ Dinámico | Sí — ledger |
| `/admin` | ✅ Dinámico | Sí — dashboard |
| `/admin/login` | ✅ Dinámico | Sí — Clerk admin auth |
| `/admin/products/new` | ✅ Dinámico | Sí — formulario + ImageUpload |
| `/admin/products/[id]` | ✅ Dinámico | Sí — edición + images |
| `/admin/flash-codes` | ✅ Dinámico | Sí — CRUD |
| `/admin/metrics` | ✅ Dinámico | Sí — KPIs + gráficos |
| `/admin/orders` | ✅ Dinámico | Sí — listado |
| `/soporte` | ✅ Estático | Sí — formulario (falta tabla DB) |
| `/info` | ✅ Estático | Sí — información general |
| `/sign-in`, `/sign-up` | ✅ Dinámico | Sí — Clerk |

**27/27 rutas operativas.** Ninguna ruta rota. Las que tienen limitaciones son funcionales pero con features incompletas (checkout demo, soporte sin DB).

---

## 📈 6. Priorización recomendada — Próximos pasos

### 🔴 Hacer ahora (impacto directo en ventas)

```
1. Subir fotos de productos a Cloudinary (30 min)
   → Sin fotos, el catálogo no vende. Usar panel admin o script bulk.

2. Configurar Turnstile producción (10 min)
   → Sin captcha real, los endpoints son vulnerables a bots.

3. Configurar envíos reales (2-3 sesiones)
   → Desbloquea ventas fuera de Ibarra + muestra costo real antes de pagar.

4. Kushki producción (3-4 sesiones)
   → Permite cobrar con tarjeta real. Sin esto, la tienda no genera ingresos.
```

### 🟡 Hacer después (mejoras importantes)

```
5. Ejecutar migración SQL de tickets (5 min)
6. Verificar cupones de fidelidad E2E (30 min)
7. Verificar cron job en Vercel (10 min)
```

### 🟢 Hacer cuando se pueda (polish)

```
8. Lightbox/zoom en galería
9. Fix overlay móvil en ImageUpload
10. Confirmación antes de eliminar imagen
11. Unificar placeholder a ImageOff
12. Actualizar texto "Supabase" → "Neon"
13. Página de envíos dedicada
```

---

## 📁 Archivos de referencia

| Documento | Contenido |
|:---|---|
| `docs/PLAN_CLOUDINARY.md` | Plan completo de Cloudinary (Fases 0-5) |
| `docs/PLAN_PENDIENTES.md` | Plan anterior de pendientes (tickets, envíos, fotos, Kushki) |
| `docs/PHASE1.md` a `docs/PHASE5.md` | Plan original del proyecto por fases |
| `docs/GUIA_DESPLIEGUE_v0.1.md` | Guía de deployment |
| `docs/MIGRACION_NEON_BREVO.md` | Migración de Supabase a Neon + Brevo |
