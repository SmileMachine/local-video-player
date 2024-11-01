export async function setupVite(app, isDev) {
  if (isDev) {
    const vite = await import('vite')
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    })
    
    app.use(viteServer.middlewares)
  } else {
    app.use(express.static(path.join(__dirname, '../../dist')))
  }
} 
