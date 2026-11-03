import { fileURLToPath } from 'node:url'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { getApiUrls } from './src/api/base-url.ts'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, 'VITE_')
  const { rootUrl: apiTarget } = getApiUrls(env.VITE_PUBLIC_BASE_URL || '')

  return {
    resolve: { tsconfigPaths: true },
    envDir: workspaceRoot,
    server: {
      fs: {
        allow: [workspaceRoot],
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})
