import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This machine's fs.inotify.max_user_watches is fully consumed by desktop
// processes, so native watchers fail with ENOSPC. Fall back to polling so
// `npm run dev` still hot-reloads. `max_user_watches` needs root to change,
// so polling is the only user-level fix.
const usePolling = process.env.CHOKIDAR_USEPOLLING !== 'false'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling,
      interval: 300,
      binaryInterval: 1000,
    },
  },
})
