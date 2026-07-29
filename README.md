# Munay — Ropa nueva y de segunda (Ibarra, Ecuador)

> **Fase 5/5 · COMPLETO · Listo para producción.**
> Stack: Next.js 16 (App Router) + Neon Postgres + Clerk Auth + Brevo Emails + Vercel.

Tienda online de ropa nueva y de segunda mano. Catálogo en vivo, carrito persistente,
códigos flash, pagos con Kushki, cuentas de usuario con Clerk, historial de pedidos,
puntos de fidelidad, panel admin completo con métricas, y endurecimiento de producción:
Cloudflare Turnstile, auditoría completa, emails transaccionales via Brevo, SEO dinámico.

---

## Stack

| Capa | Tecnología | Plan |
|------|------------|------|
| Frontend / API | Next.js 16 + TypeScript + TailwindCSS + shadcn/ui | Vercel Hobby (gratis) |
| Base de datos | Neon Postgres (serverless) | Free 0.5 GB |
| Auth | Clerk (magic link + OAuth) | Free 10K MAU |
| Imágenes | UploadThing | Free 2 GB |
| DNS / SSL | Cloudflare | Free |
| Pagos | Kushki | Comisión por tx |
| Emails | Brevo (300/día) | Free |

---

## Estructura

```
src/
├── app/           # App Router pages
├── components/    # UI components (shadcn/ui)
├── lib/           # DB, auth, email, format, constants
├── store/         # Zustand (carrito)
└── types/         # TypeScript database types
```

---

## Setup local

```bash
npm install            # o: bun install
cp .env.example .env.local  # completa tus credenciales
npm run dev            # http://localhost:3000
```

---

## Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Landing + mantenimiento |
| `/catalogo` | Catálogo con filtros y búsqueda |
| `/p/[slug]` | Detalle de producto |
| `/carrito` | Carrito persistente |
| `/checkout` | Checkout + pago |
| `/cuenta` | Dashboard de usuario |
| `/admin` | Panel admin completo |
| `/flash/[code]` | Ofertas flash |
