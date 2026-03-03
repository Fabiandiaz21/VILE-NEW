import Server from './server.js'
import cloudinary from 'cloudinary'
import 'dotenv/config'

// ✅ Configurar Cloudinary ANTES de iniciar el servidor
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
  secure: true
})

// 👇 Verifica la configuración
console.log('☁️ Cloudinary configurado:', {
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY ? '✅ Existe' : '❌ Falta',
  api_secret: process.env.CLOUDINARY_SECRET ? '✅ Existe' : '❌ Falta'
});

const server = new Server()
server.listen()