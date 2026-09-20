import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const teamName = env.VITE_TEAM_NAME || 'BERA BERA'

  // Vite's own %VAR% index.html replacement has no fallback — it leaves the
  // literal "%VITE_TEAM_NAME%" in the output when the env var isn't set
  // anywhere, which would happen on any deployment that hasn't configured it
  // yet. This does the same substitution but with the same default as the
  // PWA manifest below.
  const injectTeamName: Plugin = {
    name: 'inject-team-name',
    transformIndexHtml(html) {
      return html.replaceAll('%VITE_TEAM_NAME%', teamName)
    },
  }

  return {
    plugins: [
      react(),
      injectTeamName,
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: `${teamName} — Estadísticas`,
          short_name: teamName,
          description: `Anotación y estadísticas de balonmano para ${teamName}`,
          theme_color: '#06070c',
          background_color: '#06070c',
          display: 'standalone',
          orientation: 'landscape',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
  }
})
