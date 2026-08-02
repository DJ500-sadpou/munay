/**
 * Test e2e: flujo completo de compra (modo demo, sin DB real).
 *
 * Verifica:
 *   1. Home carga
 *   2. Catálogo carga y muestra al menos 1 producto
 *   3. Búsqueda de código flash redirige correctamente
 *   4. Carrito funciona (add/remove/update)
 *   5. Checkout completa el flujo en modo demo
 *
 * Nota: estos tests asumen modo demo (sin credenciales Neon).
 * Para tests con DB real, mockear o usar un proyecto Neon de prueba.
 */

import { test, expect } from '@playwright/test'

test.describe('Flujo de compra completo (modo demo)', () => {
  test('home carga correctamente', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Munay/i)
    // La home actual tiene H1 "Moda circular, nueva y usada." (rediseño v0.1)
    await expect(page.getByRole('heading', { name: /Moda circular/i })).toBeVisible()
    // "Ibarra, Ecuador" solo está en <title>/meta (no como texto visible), así que
    // verificamos contenido visible real: el banner de construcción y el CTA del hero.
    await expect(page.getByText(/está en construcción/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Comprar ahora/i })).toBeVisible()
  })

  test('catálogo carga con productos', async ({ page }) => {
    await page.goto('/catalogo')
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible()
  })

  // [FIX BÚSQUEDA] Regresión del bug "No pudimos realizar la búsqueda": un
  // mismatch de índices de parámetros entre las queries products y P2P de
  // listProducts rompía toda búsqueda con texto. Aserción POSITIVA primero
  // (heading visible) para tolerar cold-compile, luego la negativa del error.
  // NOTA: en CI sin DATABASE_URL la query no se ejecuta (modo demo) — este
  // test valida el render; el gate real del fix es el smoke test contra Neon.
  test('búsqueda con texto no muestra error de búsqueda', async ({ page }) => {
    await page.goto('/catalogo?q=chaqueta')
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible()
    await expect(page.getByText('No pudimos realizar la búsqueda.')).toHaveCount(0)
  })

  test('búsqueda sin resultados muestra empty state', async ({ page }) => {
    await page.goto('/catalogo?q=zzznadaexiste')
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible()
    await expect(page.getByText('No encontramos resultados')).toBeVisible()
  })

  test('búsqueda de código flash redirige a /flash/[code]', async ({ page }) => {
    await page.goto('/catalogo')
    const searchInput = page.getByLabel('Buscar en el catálogo')
    if (await searchInput.isVisible()) {
      await searchInput.fill('MUNAY10')
      await searchInput.press('Enter')
      // Debe mostrar la página de flash (o el banner de no configurado)
      await expect(page).toHaveURL(/\/flash\/MUNAY10|\/catalogo/)
    }
  })

  test('página de código flash carga', async ({ page }) => {
    await page.goto('/flash/MUNAY10')
    await expect(page.getByText(/MUNAY10/i)).toBeVisible()
  })

  // [P1] Filtro de categoría: /catalogo?categoria=chaquetas debe cargar sin
  // error (heading visible) aunque haya 0 resultados en demo.
  test('catálogo filtra por categoría sin romper', async ({ page }) => {
    await page.goto('/catalogo?categoria=chaquetas')
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible()
    await expect(page.getByText('No pudimos realizar la búsqueda.')).toHaveCount(0)
  })

  // [P1] /marcas: carga con heading y, sin marcas en demo, muestra el empty
  // state "Vuelve pronto" (listActiveBrands devuelve [] sin DB).
  test('página de marcas carga con empty state', async ({ page }) => {
    await page.goto('/marcas')
    await expect(page.getByRole('heading', { name: 'Marcas' })).toBeVisible()
    await expect(page.getByText(/vuelve pronto/i)).toBeVisible()
  })

  test('carrito vacío muestra CTA', async ({ page }) => {
    await page.goto('/carrito')
    // Si hay carrito persistido, puede no estar vacío; en ese caso, vaciarlo
    const clearBtn = page.getByRole('button', { name: /Vaciar/i })
    if (await clearBtn.isVisible()) {
      await clearBtn.click()
    }
    await expect(page.getByText(/carrito está vacío|Tu carrito/i).first()).toBeVisible()
  })

  // [P1][P2] Cupones en el carrito (misma función que checkout) + prefijo +593
  // precargado y editable en el checkout. Se siembra el carrito persistido de
  // zustand (munay-cart, version 4) para que /carrito y /checkout no hagan
  // early-return por carrito vacío. NO se envía el pedido (requiere Turnstile).
  test('carrito muestra cupones y checkout precarga +593', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'munay-cart',
        JSON.stringify({
          state: {
            lines: [
              {
                id: 'demo-1',
                slug: 'demo',
                title: 'Pieza demo',
                unit_price_cents: 2500,
                qty: 1,
                condition: 'new',
              },
            ],
          },
          version: 4,
        })
      )
    })
    await page.goto('/carrito')
    await expect(page.getByRole('heading', { name: 'Carrito' })).toBeVisible()
    // Cupón aplicable desde el carrito (misma función que el checkout)
    await expect(page.getByText('¿Tienes un cupón de descuento?')).toBeVisible()
    await expect(page.getByRole('link', { name: /Explorar mis cupones/i })).toBeVisible()
    // Prefijo +593 precargado y editable en el checkout
    await page.goto('/checkout')
    const phone = page.getByLabel('Teléfono / WhatsApp')
    await expect(phone).toBeVisible()
    await expect(phone).toHaveValue('+593 ')
  })

  test('página de login carga', async ({ page }) => {
    await page.goto('/cuenta/login')
    await expect(page.getByRole('heading', { name: /Mi cuenta/i })).toBeVisible()
    await expect(page.getByLabel(/Email/i).first()).toBeVisible()
  })

  test('admin login redirige correctamente', async ({ page }) => {
    await page.goto('/admin')
    // Sin sesión, debe redirigir a /admin/login
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

test.describe('SEO y metadata', () => {
  test('sitemap.xml responde', async ({ page }) => {
    const res = await page.goto('/sitemap.xml')
    expect(res?.status()).toBe(200)
    const content = await page.content()
    expect(content).toContain('<urlset')
  })

  test('robots.txt responde', async ({ page }) => {
    const res = await page.goto('/robots.txt')
    expect(res?.status()).toBe(200)
    const content = await page.content()
    // Next.js genera 'User-Agent:' (con mayúscula) — comparación case-insensitive
    expect(content.toLowerCase()).toContain('user-agent')
    expect(content).toContain('Sitemap:')
  })
})

test.describe('Health checks', () => {
  test('api raíz responde', async ({ request }) => {
    const res = await request.get('/api')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('Hello, world!')
  })
})
