import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
export default defineConfig({
    plugins: [
        react(),
        electron([
            {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        minify: false
                    }
                }
            },
            {
                entry: 'electron/preload.ts',
                onstart: function (options) {
                    options.reload();
                },
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        minify: false
                    }
                }
            }
        ]),
        renderer()
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src')
        }
    }
});
