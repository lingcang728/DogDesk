import { defineConfig } from 'vite';

export default defineConfig({
    clearScreen: false,
    server: {
        strictPort: true,
        port: 5173,
    },
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        target: 'esnext',
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
        rollupOptions: {
            input: {
                main: 'index.html',
                translation: 'translation.html',
            },
        },
    },
});
