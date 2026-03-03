import User from '../models/user.js'
import City from '../models/city.js'
import County from '../models/county.js'
import Institute from '../models/institute.js'
import cloudinary from 'cloudinary'
import fs from 'fs'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import sendEmail from "../middlewares/sendEmail.js"
import mongoose from "mongoose";


const saltRounds = 10



const removeAccents = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const httpUser = {
    getUser: async (req, res) => {
        let data = []

        const user = await User.find().populate("paymaster").populate("supervisor").populate("regional").populate("institute")

        for (let index = 0; index < user.length; index++) {
            if (req.query.user) {
                if (user[index].role.data == 'user') {
                    data.push(user[index])
                }
            }

            if (req.query.supervisor) {
                if (user[index].role.data == 'supervisor') {
                    data.push(user[index])
                }
            }

            if (req.query.paymaster) {
                if (user[index].role.data == 'paymaster') {
                    data.push(user[index])
                }
            }
        }

        if (data.length == 0 && user.length !== 0) {
            data = user
        }

        return res.status(200).json(data)
    },

    getUserParams: async (req, res) => {
        const user = await User.findOne({ _id: req.params.id }).populate('institute').populate('regional').populate('supervisor').populate('paymaster')

        return res.status(200).json(user)
    },

    postUser: async (req, res) => {
        // ✳️ Limpiar espacios
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });

const data = {
    name: req.body.name,
    mail: req.body.mail,
    identification: req.body.identification,
    role: req.body.role,
    position: req.body.position,
    branch: req.body.branch,
    paymaster: req.body.paymaster,
    staffType: req.body.staffType,

    budget: {
        amount: Number(req.body.budget?.amount) || 0
    },

    // ✅ VIÁTICO DIARIO
    dailyAllowance: {
        amount: Number(req.body.dailyAllowance?.amount) || 0
    },

    // ✅ HONORARIOS MENSUALES
    monthlyFee: {
        amount: Number(req.body.monthlyFee?.amount) || 0
    }
};


        if (data.role.data == 'user' && data.staffType.index == 0) {
            data.contract = req.body.contract;
            data.object = req.body.object;
            data.supervisor = req.body.supervisor;
            data.regional = req.body.regional;
            data.institute = req.body.institute;
        }
        // NOTA: 'object' no se usa después, asumo que es parte de 'date' o se debe mapear.

        try {
            data.password = await bcrypt.hash(req.body.password, saltRounds);
        } catch (error) {
            console.log(error);
            return res.status(400).json({ msg: 'Error, Usuario no creado' });
        }

        // 🔹 CONVERSIÓN AUTOMÁTICA DE NOMBRES A OBJECTID 🔹
        try {

            // 🚨 FUNCIÓN AUXILIAR CORREGIDA CON MANEJO DE ACENTOS

            const mapReference = async (value, Model, fieldName) => {
                if (!value) return null;

                // 🟢 Si ya es un ObjectId → validar que exista y devolverlo
                if (mongoose.Types.ObjectId.isValid(value)) {
                    const exists = await Model.exists({ _id: value });
                    if (!exists) {
                        console.warn(`ID no existe para ${fieldName}: ${value}`);
                        return null;
                    }
                    return value;
                }

                // 🟡 Si viene como texto → buscar por nombre (Excel)
                if (typeof value === "string") {
                    const clean = removeAccents(value.trim());

                    const doc = await Model.findOne({
                        name: { $regex: new RegExp(`^${clean}$`, "i") }
                    });

                    if (!doc) {
                        console.warn(`Referencia no encontrada para ${fieldName}: "${value}"`);
                        return null;
                    }

                    return doc._id;
                }

                return null;
            };

            // --- PROCESAMIENTO DE REFERENCIAS ---

            // 1. REGIONAL
            if (data.regional) {
                const id = await mapReference(data.regional, County, 'regional');
                if (id) {
                    data.regional = id;
                } else {
                    delete data.regional; // 💥 Eliminar si no se encontró (o si era "")
                }
            }

            // 2. SUPERVISOR
            if (data.supervisor) {
                const id = await mapReference(data.supervisor, User, 'supervisor');
                if (id) {
                    data.supervisor = id;
                } else {
                    delete data.supervisor; // 💥 Eliminar si no se encontró
                }
            }

            // 3. PAYMASTER
            if (data.paymaster) {
                const id = await mapReference(data.paymaster, User, 'pagador (paymaster)');
                if (id) {
                    data.paymaster = id;
                } else {
                    delete data.paymaster; // 💥 Eliminar si no se encontró
                }
            }

            // 4. INSTITUTE
            if (data.institute) {
                const id = await mapReference(data.institute, Institute, 'centro');
                if (id) {
                    data.institute = id; 
                } else {
                    delete data.institute; // 💥 Eliminar si no se encontró
                }
            }

            // Ahora, si una referencia no se encuentra, simplemente se omite del objeto 'data'.

        } catch (error) {
            // Este bloque ahora solo captura errores de BBDD o errores de código (no errores de 'Referencia no encontrada')
            console.log('❌ Error interno al procesar referencias:', error);
            return res.status(500).json({ msg: 'Error interno del servidor al procesar referencias.' });
        }

        // 🔸 Validaciones de duplicados (se mantienen)
        const buscarCedula = await User.findOne({ identification: req.body.identification });
        const buscarCorreo = await User.findOne({ mail: req.body.mail });

        if (buscarCorreo) {
            return res.status(400).json({ msg: "Ya existe un usuario con ese correo" });
        } else if (buscarCedula) {
            return res.status(400).json({ msg: "Ya existe un usuario con esa cédula" });
        }

        // 🔹 Crear usuario
        const user = new User(data);
        await user.save();

        // 🔸 Enviar correo
        const link = process.env.CLIENT_URL;
        let mailOptions = {
            from: process.env.MAIL_ADDRESS,
            to: user.mail,
            subject: 'Bienvenido a VILE',
            html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
          <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
            <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
            <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
          </div><br />
          <p style="font-size: 16px; font-weight:bold;color: #333">BIENVENIDO(A) A VILE</p>
          <img src="cid:bienvenida" alt="Bienvenida" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
          <p style="font-size: 16px; font-weight:bold;color: #333">Hola ${user.name},</p>
          <p style="font-size: 16px; color: #333;">Ha sido registrado(a) en la plataforma VILE (Viajes y Legalizaciones) del Centro Agroturístico. Estas son sus
          credenciales de acceso:</p>
          <p style="font-size:16px;color: #333;"><strong>No. de documento: </strong>${user.identification}</p>
          <p style="font-size:16px;color: #333;"><strong>Contraseña: </strong>${req.body.password}</strong></p>
          <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a>
          <p style="font-size: 16px; color: #333; font-weight:bold">POR SU SEGURIDAD, NO COMPARTA ESTA INFORMACIÓN CON NADIE</p>
          <span>*Este correo es generado automáticamente, por favor no responder</span>
        </div>`,
            attachments: [
                { filename: 'bienvenido.png', path: './images/bienvenido.png', cid: 'bienvenida' },
                { filename: 'logo-sena-blanco.png', path: './images/logo-sena-blanco.png', cid: 'logo_sena' }
            ],
        };

        sendEmail.sendMail(mailOptions, function (error) {
            if (error) console.log(error);
            else console.log('Correo enviado a usuario creado');
        });

        return res.status(200).json({ msg: 'Usuario creado correctamente' });
    },

    // ... el resto de la función putUser, etc.

    putUser: async (req, res) => {
        const userId = req.params.id;

        try {
            const buscarCedula = await User.findOne({ identification: req.body.identification });
            const buscarCorreo = await User.findOne({ mail: req.body.mail });
            /* const buscarNumContrato = await User.findOne({
                $and: [
                    { 'staffType.data': 'contractor' },
                    { 'contract.number': req.body.contract.number },
                ]
            }); */

            if (buscarCorreo && buscarCorreo._id.toString() !== userId) {
                return res
                    .status(400)
                    .json({ msg: "Ya existe un usuario con ese correo", buscarCorreo });
            } else if (buscarCedula && buscarCedula._id.toString() !== userId) {
                return res
                    .status(400)
                    .json({ msg: "Ya existe un usuario con ese número de cédula", buscarCedula });
            } /* else if (buscarNumContrato && buscarNumContrato._id.toString() !== userId) {
                return res
                    .status(400)
                    .json({ msg: "Ya existe un contratista con ese número de contrato", buscarNumContrato });
            } */ else {

                Object.keys(req.body).forEach(key => {
                    if (typeof req.body[key] === 'string') {
                        req.body[key] = req.body[key].trim();
                    }
                });

                const updatedUser = await User.findOneAndUpdate(
                    { _id: userId },
                    {
                        $set: req.body,
                    },
                    { new: true }
                );

                res.status(200).json({
                    msg: "Usuario modificado exitosamente",
                    user: updatedUser,
                });
            }
        } catch (error) {
            console.log(error);
            res.status(500).json({ msg: "Error al editar usuario" });
        }

    },

putSign: async (req, res) => {
    const { id } = req.params

    try {
        const user = await User.findOne({ _id: id })

        if (!req.file) {
            return res.status(400).json({ msg: 'No se recibió archivo' })
        }

        // Si ya tenía firma, eliminar el archivo anterior
        if (user.sign?.localPath) {
            fs.unlink(user.sign.localPath, (err) => {
                if (err) console.log('No se pudo eliminar firma anterior:', err)
            })
        }

        // Multer ya guardó el archivo, solo tomamos la info
        const data = {
            sign: {
                localPath: req.file.path,
                url: `/uploads/${req.file.filename}`
            }
        }

        await User.findByIdAndUpdate(id, data)

        return res.status(200).json({ msg: 'Firma modificada' })

    } catch (error) {
        console.error(error)
        return res.status(400).json({ msg: 'Error, Firma no modificada' })
    }
},

    postLogin: async (req, res) => {
        const { identification, password } = req.body

        const user = await User.findOne({ identification: identification })

        if (!user) {
            return res.status(400).json({ msg: 'Credenciales inválidas' })
        } else if (user.status === 0) {
            return res.status(400).json({ msg: 'Usuario inactivo' })
        } else {
            bcrypt.compare(password, user.password, async function (err, result) {
                if (result == true) {
                    jwt.sign({ mail: user.mail, identification: user.identification, id: user._id, role: user.role, staffType: user.staffType }, process.env.PRIVATE_KEY, function (err, token) {
                        // console.log(token)
                        return res.status(200).json({ msg: 'Inicio de sesión exitoso', token })
                    })
                } else {
                    return res.status(400).json({ msg: 'Credenciales inválidas' })
                }
            })
        }
    },

    patchUser: async (req, res) => {
        const id = req.params.id;
        const { status } = req.body;
        try {
            const usuario = await User.findById(id);
            if (usuario) {
                usuario.status = status;
                await usuario.save();
                res.json({ msg: 'Estado cambiado con éxito', usuario });
            } else {
                res
                    .status(404)
                    .json({ mensaje: `usuario con id: ${id} no encontrado` });
            }
        } catch (error) {
            console.log(`Error al actualizar el usuario: ${error}`);
            res.status(500).json({ error: "Error interno del servidor" });
        }
    },

    envioEmail: async (req, res) => {
        try {

            const { mail } = req.body;

            /* if (typeof mail === 'string') {
                mail.trim();
            } */

            const usuario = await User.findOne({ mail: mail })

            if (!usuario) {
                return res.status(404).json(`El correo proporcionado no se encuentra registrado`);
            }

            let msg = "Por favor consulte su correo electrónico (incluida su bandeja de spam / correo no deseado)";
            const token = jwt.sign({ id: usuario.id },
                process.env.PRIVATE_KEY_MAIL,
                { expiresIn: '20m' }
            );
            const link = `${process.env.CLIENT_URL}/#/nueva/contrasena?reset=${token}`;
            usuario.recuperacion = token;
            await usuario.save();
            try {
                await sendEmail.sendMail({
                    from: process.env.MAIL_ADDRESS,
                    to: usuario.mail,
                    subject: "Restablecimiento de contraseña",
                    html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                    <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                    <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                    <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                    </div><br />
                    <p style="font-size: 16px; font-weight:bold;color: #333">RECUPERACIÓN DE CONTRASEÑA</p>
                    <img src="cid:restablecer" alt="Restablecer contraseña" style="display: block; margin: 0 auto; max-width: 20%; height: auto;">
                    <p style="font-size: 16px; font-weight:bold; color:#333">Hola ${usuario.name},</p>
                    <p style="font-size: 16px; color: #333;">Se ha recibido una solicitud para restablecer su contraseña. Por favor, haga clic en el botón para comenzar:</p>
                    <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">RESTABLECER CONTRASEÑA</a>
                    <p style="font-size: 16px; color: #333; font-weight:bold">SI NO SOLICITÓ ESTE SERVICIO, PUEDE IGNORAR ESTE CORREO.</p>
                    <span>*Tiene 15 minutos para restablecer la contraseña, pasado este tiempo deberá generar un nuevo enlace</span><br />
                    <span>*Este correo es generado automáticamente, por favor no responder</span>
                </div>
                `,
                    attachments: [{
                        filename: 'restablecer-la-contrasena.png',
                        path: './images/restablecer-la-contrasena.png',
                        cid: 'restablecer'
                    },
                    {
                        filename: 'logo-sena-blanco.png',
                        path: './images/logo-sena-blanco.png',
                        cid: 'logo_sena'
                    }]
                })
                console.log(link);
            } catch (error) {
                console.log('error al enviar correo de restablecimiento', error);
                return res.status(400).json({ msg: 'Ha ocurrido un error' })
            }
            return res.status(202).json({ msg, link, token })
        } catch (error) {
            console.log('ERROR 1', error);
            return res.status(500).json({ msg: 'Ha ocurrido un error' })
        }
    },

    nuevaContrasena: async (req, res) => {
        const { nuevaContrasena } = req.body;
        const recuperacion = req.headers.reset;
        if (!recuperacion || !nuevaContrasena) {
            return res.status(404).json({ msg: "Campos requerido o invalidos" });
        }
        try {
            const usuario = await User.findOne({ recuperacion: recuperacion });
            if (!usuario) {
                return res.status(404).json({ msg: 'Token inválido' })
            };

            const jtoken = jwt.verify(recuperacion, process.env.PRIVATE_KEY_MAIL);
            console.log(jtoken);
            if (!jtoken) {
                return res.status(400).json({ msg: 'Token inválido' })
            }

            if (typeof nuevaContrasena !== 'string') {
                return res.status(400).json({ msg: 'La nueva contraseña no es valida' })
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(nuevaContrasena, salt);
            usuario.password = hashedPassword
            usuario.recuperacion = null;
            await usuario.save();

            return res.status(200).json({ msg: 'Contraseña restablecida con éxito', nuevaContrasena })
        } catch (error) {
            console.log(error);
            return res.status(400).json({ msg: 'Token de restablecimiento expirado' })
        }
    },

addNotification:async (req, res) => {
  try {
    const { userId, type, message } = req.body

    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

    user.notifications.push({
      type,
      message,
      time: new Date(),
      read: false
    })

    await user.save()

    res.json({ message: 'Notificación agregada', notifications: user.notifications })

  } catch (error) {
    console.error("Error al agregar notificación:", error)
    res.status(500).json({ message: 'Error interno', error })
  }
}

}

export {
    httpUser
}