import express from 'express'
import connect from './database/index.js'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import { fileURLToPath } from 'url'
import http from 'http'
import { Server as SocketServer } from 'socket.io'

// Routes
import { routerUser } from './routes/user.js'
import { routerSchedule } from './routes/schedule.js'
import { routerCounty } from './routes/county.js'
import { routerCity } from './routes/city.js'
import { routerInstitute } from './routes/institute.js'
import { routerAmount } from './routes/Amount.js'
import { routerNotification } from './routes/notification.js'

// 🔹 ESM: __dirname equivalente
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 🔹 Exportar instancia de io para usarla en controladores
export let ioInstance = null

class Server {
  constructor() {
    this.app = express()

    // 🔥 Crear servidor HTTP para socket.io
    this.httpServer = http.createServer(this.app)
    this.io = new SocketServer(this.httpServer, {
      cors: { origin: '*' }
    })

    // Guardar instancia global
    ioInstance = this.io

    this.connect()
    this.middlewares()
    this.routes()
    this.sockets()
  }

  async connect() {
    await connect()
  }

middlewares() {
  this.app.use(cors())
  this.app.use(express.json({ limit: '50mb' }))
  this.app.use(express.urlencoded({ extended: true, limit: '50mb' }))

  // 📁 Archivos públicos
  this.app.use(express.static('public'))

  // 🖼️ EXPONER IMÁGENES LOCALES
  this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
}



  routes() {
    this.app.use('/schedule', routerSchedule)
    this.app.use('/county', routerCounty)
    this.app.use('/city', routerCity)
    this.app.use('/institute', routerInstitute)
    this.app.use('/user', routerUser)
    this.app.use('/amount', routerAmount)
    this.app.use('/api/notifications', routerNotification) // ✅ Cambiar aquí
  }

  sockets() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Usuario conectado:', socket.id)

      socket.on('disconnect', () => {
        console.log('❌ Usuario desconectado:', socket.id)
      })
    })
  }

  listen() {
    this.httpServer.listen(process.env.PORT, () => {
      console.log(`🚀 Servidor iniciado en puerto http://localhost:${process.env.PORT}`)
    })
  }
}

export default Server
