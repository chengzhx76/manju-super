import path from 'path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'http'
import { createNewApiProxyHandler } from './server/newApiProxyCore.mjs'

const createDevMediaProxyPlugin = (): Plugin => ({
  name: 'dev-media-proxy',
  configureServer(server) {
    const mediaGetHandler = async (
      req: IncomingMessage,
      res: ServerResponse
    ) => {
      try {
        const requestUrl = new URL(req.url || '', 'http://localhost')
        const target = requestUrl.searchParams.get('url')

        if (!target) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Missing url query parameter.' }))
          return
        }

        let targetUrl: URL
        const rawTarget = String(target).trim()
        try {
          targetUrl = new URL(rawTarget)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Invalid url value.' }))
          return
        }

        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({ error: 'Only http/https URLs are allowed.' })
          )
          return
        }

        // Keep the original signed URL bytes to avoid signature invalidation.
        const upstream = await fetch(rawTarget, {
          method: 'GET',
          headers: req.headers.range
            ? { range: String(req.headers.range) }
            : undefined,
          redirect: 'follow'
        })

        res.statusCode = upstream.status
        const passthroughHeaders = [
          'content-type',
          'content-range',
          'accept-ranges',
          'cache-control',
          'etag',
          'last-modified',
          'expires'
        ]

        passthroughHeaders.forEach((key) => {
          const value = upstream.headers.get(key)
          if (value) {
            res.setHeader(key, value)
          }
        })

        const buffer = Buffer.from(await upstream.arrayBuffer())
        res.end(buffer)
      } catch (error: unknown) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            error: 'Media proxy failed.',
            detail: error instanceof Error ? error.message : String(error)
          })
        )
      }
    }

    const imagePostHandler = async (
      req: IncomingMessage,
      res: ServerResponse
    ) => {
      try {
        const requestUrl = new URL(req.url || '', 'http://localhost')
        const target = requestUrl.searchParams.get('url')

        if (!target) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Missing url query parameter.' }))
          return
        }

        let targetUrl: URL
        const rawTarget = String(target).trim()
        try {
          targetUrl = new URL(rawTarget)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Invalid url value.' }))
          return
        }

        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({ error: 'Only http/https URLs are allowed.' })
          )
          return
        }

        const method = String(req.method || 'POST').toUpperCase()
        if (!['POST', 'PUT', 'PATCH', 'DELETE', 'GET'].includes(method)) {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Method not allowed.' }))
          return
        }

        const passHeaders: Record<string, string> = {}
        const headerAllowList = ['authorization', 'content-type', 'accept']
        headerAllowList.forEach((headerName) => {
          const value = req.headers?.[headerName]
          if (!value) return
          passHeaders[headerName] = Array.isArray(value)
            ? value.join(', ')
            : String(value)
        })

        // Keep the original signed URL bytes to avoid signature invalidation.
        const upstream = await fetch(rawTarget, {
          method,
          headers: passHeaders,
          body: ['GET', 'HEAD'].includes(method) ? undefined : req,
          // Required when using Node stream as request body.
          duplex: ['GET', 'HEAD'].includes(method) ? undefined : 'half',
          redirect: 'follow'
        })

        res.statusCode = upstream.status
        const passthroughHeaders = [
          'content-type',
          'cache-control',
          'etag',
          'last-modified',
          'expires'
        ]

        passthroughHeaders.forEach((key) => {
          const value = upstream.headers.get(key)
          if (value) {
            res.setHeader(key, value)
          }
        })

        const buffer = Buffer.from(await upstream.arrayBuffer())
        res.end(buffer)
      } catch (error: unknown) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            error: 'Image proxy failed.',
            detail: error instanceof Error ? error.message : String(error)
          })
        )
      }
    }

    server.middlewares.use('/api/media-proxy', mediaGetHandler)
    server.middlewares.use('/api/image-proxy', imagePostHandler)
  }
})

const createDevNewApiProxyPlugin = (): Plugin => ({
  name: 'dev-new-api-proxy',
  configureServer(server) {
    const handler = createNewApiProxyHandler()
    server.middlewares.use(
      handler as unknown as Parameters<typeof server.middlewares.use>[0]
    )
  }
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    server: {
      port: 3000,
      host: '0.0.0.0'
    },
    plugins: [
      react(),
      createDevMediaProxyPlugin(),
      createDevNewApiProxyPlugin()
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.ANTSK_API_KEY),
      'process.env.ANTSK_API_KEY': JSON.stringify(env.ANTSK_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    },
    build: {
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            icons: ['lucide-react'],
            zip: ['jszip']
          }
        }
      }
    }
  }
})
