import { defineConfig, devices } from '@playwright/test'

/**
 * Configuración de Playwright para tests e2e.
 *
 * Ejecutar:
 *   npx playwright install        # instalar navegadores
 *   npx playwright test           # correr tests
 *   npx playwright test --ui      # modo interactivo
 *   npx playwright show-report    # ver reporte
 *
 * Requiere: dev server corriendo en http://localhost:3000
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
