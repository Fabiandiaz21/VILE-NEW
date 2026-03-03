import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const sendEmail = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true para 465, false para 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // 👈 importante
  },
});

// verificar conexión
sendEmail.verify((error, success) => {
  if (error) {
    console.error("❌ Error en conexión SMTP:", error);
  } else {
    console.log("✅ Servidor SMTP listo para enviar correos");
  }
});

export default sendEmail;
