import Schedule from '../models/schedule.js'

import User from '../models/user.js'

import sendEmail from "../middlewares/sendEmail.js"

import fs from 'fs'

import path from 'path'

import mongoose from 'mongoose'

import { ioInstance } from '../server.js'



const httpSchedule = {

    postSchedule: async (req, res) => {
        const schedule = new Schedule(req.body)

        try {

            const existingSchedule = await Schedule.findOne({
                userId: req.body.userId,
                $or: [
                    {
                        tripStart: { $gte: req.body.tripStart, $lte: req.body.tripEnd },
                        tripEnd: { $gte: req.body.tripEnd, $lte: req.body.tripEnd }
                    }
                ],
            })

            if (existingSchedule) {
                return res.status(400).json({ msg: 'Usted ya tiene una agenda con exactamente las mismas fechas' });
            }

            await schedule.save()

            // ✅ Obtener usuario ANTES de usarlo
            const user = await User.findById(req.body.userId)
                .populate('supervisor');

            if (!user) {
                return res.status(404).json({ msg: 'Usuario no encontrado' });
            }

            // 🔔 Emitir evento Socket.io a todos los clientes conectados
            if (ioInstance) {
                ioInstance.emit('nueva-solicitud', {
                    scheduleId: schedule._id,
                    userName: user.name,
                    role: user.role.data,
                    staffType: user.staffType.data
                })
                console.log('✅ Evento "nueva-solicitud" emitido')
            }

            const link = process.env.CLIENT_URL

            // CONTRATISTA CREA AGENDA
            if (user.role.data === "user" && user.staffType.data === "contractor") {
                // Obtener el correo del supervisor

                const supervisorEmail = user.supervisor.mail;

                let mailOptions = {
                    from: process.env.MAIL_ADDRESS,
                    to: supervisorEmail,
                    subject: 'Creación de agenda',
                    html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                    <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                    <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                    <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                    </div><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">NUEVA AGENDA CREADA</p>
                    <img src="cid:nuevo" alt="Nueva Agenda" style="display: block; margin: 0 auto; max-width: 20%; height: auto;">
                    <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${user.supervisor.name},</p>
                    <p style="font-size: 16px; color: #333;">El contratista <strong>${user.name}</strong> ha creado una nueva agenda. Por favor, revísela para aprobarla o rechazarla.</p>
                    <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                    <span>*Este correo es generado automáticamente, por favor no responder</span>
                </div>
                `,
                    attachments: [
                        {
                            filename: 'nuevo.png',
                            path: './images/nuevo.png',
                            cid: 'nuevo'
                        },
                        {
                            filename: 'logo-sena-blanco.png',
                            path: './images/logo-sena-blanco.png',
                            cid: 'logo_sena'
                        }
                    ]
                }
                sendEmail.sendMail(mailOptions, function (error) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Correo de creación de agenda enviado a supervisor');
                    }
                });
            }

            return res.status(200).json({ msg: 'Agenda creada' })
        } catch (error) {
            console.log(error);
            res.status(500).json({ msg: "Error al crear la agenda" });
        }

    },

    getSchedule: async (req, res) => {
        try {
            const query = {}

            if (req.query.minStatusIndex) {
                query['status.index'] = { $gte: Number(req.query.minStatusIndex) }
            }

            if (req.query.maxStatusIndex) {
                query['status.index'] = {
                    ...(query['status.index'] || {}),
                    $lte: Number(req.query.maxStatusIndex)
                }
            }

            if (req.query.supervisor) {
                query['supervisor.id'] = new mongoose.Types.ObjectId(req.query.supervisor)
            }

            if (req.query.contractor) {
                query['contractor'] = new mongoose.Types.ObjectId(req.query.contractor)
            }

            if (req.query.legalization) {
                if (req.query.role === 'administrator') {
                    query['status.index'] = { $in: [3] }
                } else if (req.query.role === 'supervisor') {
                    query['status.index'] = { $in: [0, 1] } // ✅ pendientes de firma
                } else {
                    query['status.index'] = { $in: [5, 6] }
                }
            }

            const schedules = await Schedule
                .find(query)
                .select('+infoClassification')
                .sort({ createdAt: -1 })

            return res.status(200).json(schedules)

        } catch (error) {
            console.error('❌ Error en getSchedule:', error)
            return res.status(500).json({ msg: 'Error al obtener las agendas' })
        }
    },


    getScheduleParams: async (req, res) => {
        try {
            const { id } = req.params
            const role = req.query.role // ← viene del frontend
            let query = {}

            // 🔹 FILTROS POR ROL
            if (req.query.contractor) {
                query.contractor = id
            }

            if (req.query.publicWorker) {
                query.publicWorker = id
            }

            if (req.query.supervisor) {
                query['supervisor.id'] = id
            }

            // 🔹 FILTROS DE ESTADO
            if (req.query.legalization) {

                // 🧠 ADMIN: solicitudes (NO status 6)
                if (role === 'administrator') {
                    query['status.index'] = { $lt: 6 }
                }

                // 🧠 SUPERVISOR: solo pendientes por firmar
                else if (role === 'supervisor') {
                    query['status.index'] = 5
                }

                // 🧠 CONTRATISTA
                else {
                    query['status.index'] = { $in: [4, 5] }
                }

            }
            else if (req.query.historical) {
                query['status.index'] = { $gte: 6 }
            }
            else {
                query['status.index'] = { $in: [0, null] }
            }

            const schedules = await Schedule
                .find(query)
                .select('+infoClassification')
                .sort({ createdAt: -1 })

            return res.status(200).json(schedules)

        } catch (error) {
            console.error('❌ Error en getScheduleParams:', error)
            return res.status(500).json({ msg: 'Error al obtener agendas' })
        }
    },

    // En tu controllers/schedule.js

    getScheduleById: async (req, res) => {
        try {
            const { id } = req.params

            const schedule = await Schedule
                .findById(id)
                .select('+infoClassification')

            if (!schedule) {
                return res.status(404).json({ msg: 'Agenda no encontrada' })
            }

            return res.status(200).json(schedule) // 👈 Retorna objeto directo

        } catch (error) {
            console.error('❌ Error en getScheduleById:', error)
            return res.status(500).json({ msg: 'Error al obtener la agenda' })
        }
    },

    putSchedule: async (req, res) => {
        const { id } = req.params

        // Se envia el nuevo estado de la agenda en req.body.status
        const schedule = await Schedule.findByIdAndUpdate(id, req.body, { new: true });

        // 🔔 Emitir evento de actualización de agenda
        if (ioInstance) {
            ioInstance.emit('agenda-modificada', {
                scheduleId: schedule._id,
                status: schedule.status.data,
                updatedBy: req.body.userId
            });
            console.log('✅ Evento "agenda-modificada" emitido')
        }


        // Obtener el usuario que creó la agenda
        const creator = await User.findOne({ mail: schedule.contract.mail }).populate('supervisor');

        const link = process.env.CLIENT_URL

        if (req.body?.status?.data === "Agenda rechazada") {
            // Obtener el usuario que modificó la agenda
            const modUser = await User.findById(req.body.userId)

            if (modUser.role.data === "supervisor") {
                // SUPERVISOR RECHAZA AGENDA

                let SupervisorMailOptions = {
                    from: process.env.MAIL_ADDRESS,
                    to: creator.mail,
                    subject: 'Agenda Rechazada',
                    html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                         <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                         <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                         <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                         </div><br />
                         <p style="font-size: 16px; color: #333;font-weight:bold">AGENDA RECHAZADA</p>
                         <img src="cid:rechazar" alt="Rechazar" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
                         <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${creator.name},</p>
                         <p style="font-size: 16px; color: #333;">Su supervisor de contrato <strong>${modUser.name}</strong> ha rechazado su agenda con la siguiente justificacion: <strong>${schedule.status.justification}</strong></p>
                         <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                         <span>*Este correo es generado automáticamente, por favor no responder</span>
                     </div>
                     `,
                    attachments: [{
                        filename: 'logo-sena-blanco.png',
                        path: './images/logo-sena-blanco.png',
                        cid: 'logo_sena'
                    },
                    {
                        filename: 'rechazar.png',
                        path: './images/rechazar.png',
                        cid: 'rechazar'
                    }]
                }
                sendEmail.sendMail(SupervisorMailOptions, function (error) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Correo enviado a contratista');
                    }
                });

            }

        } else if (req.body.status.data === 'Agenda firmada por Contratista') {
            // CUANDO EL CONTRATISTA MODIFICA AGENDA, NOTIFICAR AL SUPERVISOR

            // NOTIFICAR AL SUPERVISOR
            let creatorMailOptions = {
                from: process.env.MAIL_ADDRESS,
                to: creator.supervisor.mail,
                subject: 'Agenda Modificada',
                html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                    <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                    <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                    <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                    </div><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">AGENDA MODIFICADA</p>
                    <img src="cid:editar" alt="Editada" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${creator.supervisor.name},</p>
                    <p style="font-size: 16px; color: #333;">El contratista <strong>${creator.name}</strong> ha modificado una agenda creada. Queda pendiente por su aprobación
                    o rechazo.</p>
                    <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                    <span>*Este correo es generado automáticamente, por favor no responder</span>
                </div>
                `,
                attachments: [{
                    filename: 'logo-sena-blanco.png',
                    path: './images/logo-sena-blanco.png',
                    cid: 'logo_sena'
                },
                {
                    filename: 'editar.png',
                    path: './images/editar.png',
                    cid: 'editar'
                }]
            };

            sendEmail.sendMail(creatorMailOptions, function (error) {
                if (error) {
                    console.log('Error al enviar correo al supervisor:', error);
                } else {
                    console.log('Correo al supervisor enviado correctamente');
                }
            });


        } else if (req.body.status.data === 'Agenda firmada por Funcionario') {
            // CUANDO EL FUNCIONARIO MODIFICA AGENDA (sin notificación al ordenador)
            let creatorMailOptions = {
                from: process.env.MAIL_ADDRESS,
                to: creator.mail,
                subject: 'Agenda Modificada',
                html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                    <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                    <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                    <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                    </div><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">AGENDA MODIFICADA</p>
                    <img src="cid:editar" alt="Editada" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${creator.name},</p>
                    <p style="font-size: 16px; color: #333;">Tu agenda ha sido modificada.</p>
                    <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                    <span>*Este correo es generado automáticamente, por favor no responder</span>
                </div>
                `,
                attachments: [{
                    filename: 'logo-sena-blanco.png',
                    path: './images/logo-sena-blanco.png',
                    cid: 'logo_sena'
                },
                {
                    filename: 'editar.png',
                    path: './images/editar.png',
                    cid: 'editar'
                }]
            };

            sendEmail.sendMail(creatorMailOptions, function (error) {
                if (error) {
                    console.log('Error al enviar correo al supervisor:', error);
                } else {
                    console.log('Correo al ordenador enviado correctamente');
                }
            });


        } else if (req.body.status.data === "Agenda firmada por Supervisor") {

            // CUANDO EL SUPERVISOR FIRMA AGENDA, NOTIFICAR AL CONTRATISTA Y ORDENADOR

            // Obtener el supervisor que modificó la agenda
            const supervisor = await User.findById(req.body.userId)

            // NOTIFICAR AL CONTRATISTA
            let creatorMailOptions = {
                from: process.env.MAIL_ADDRESS,
                to: creator.mail,
                subject: 'Agenda Aprobada y Firmada',
                html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                    <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                    <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                    <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                    </div><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">AGENDA FIRMADA</p>
                    <img src="cid:aceptar" alt="Aceptación" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${creator.name},</p>
                    <p style="font-size: 16px; color: #333;">Su supervisor de contrato <strong>${supervisor.name}</strong> ha aprobado y firmado su agenda.</p>
                    <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                    <span>*Este correo es generado automáticamente, por favor no responder</span>
                </div>
                `,
                attachments: [{
                    filename: 'logo-sena-blanco.png',
                    path: './images/logo-sena-blanco.png',
                    cid: 'logo_sena'
                },
                {
                    filename: 'aceptar.png',
                    path: './images/aceptar.png',
                    cid: 'aceptar'
                }]
            };

            // Envío de correo al creador
            sendEmail.sendMail(creatorMailOptions, function (error) {
                if (error) {
                    console.log('Error al enviar correo al creador:', error);
                } else {
                    console.log('Correo al creador enviado correctamente');
                }
            });

        } else if (req.body.status.data === 'Agenda en Proceso de Legalización') {
            // Obtener el admin que modificó la agenda
            const admin = await User.findById(req.body.userId)

            // NOTIFICAR AL CREADOR

            let mailOptions = {
                from: process.env.MAIL_ADDRESS,
                to: creator.mail,
                subject: 'Proceso de Legalización',
                html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                    <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                    <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                    <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                    </div><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">LEGALIZACIÓN CREADA</p>
                    <img src="cid:aceptar" alt="Aceptación" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
                    <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${creator.name},</p>
                    <p style="font-size: 16px; color: #333;"><strong>${admin.name}</strong> ha creado la legalización de su agenda con
                    número de orden de viaje <strong>${schedule.tripOrder}</strong>. Queda pendiente por que usted agregue las evidencias y/o soportes y conclusiones y que la firme</p>
                    <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                    <span>*Este correo es generado automáticamente, por favor no responder</span>
                </div>
                `,
                attachments: [{
                    filename: 'logo-sena-blanco.png',
                    path: './images/logo-sena-blanco.png',
                    cid: 'logo_sena'
                },
                {
                    filename: 'aceptar.png',
                    path: './images/aceptar.png',
                    cid: 'aceptar'
                }]

            };

            sendEmail.sendMail(mailOptions, function (error) {
                if (error) {
                    console.log('Error al enviar correo de legalización...', error);
                } else {
                    console.log('Correo de legalización enviado correctamente');
                }
            });
        }

        return res.status(200).json({ msg: 'Agenda modificada' })
    },

    postLegalizacion: async (req, res) => {
        try {
            const { id } = req.params;
            console.log('req.files:', req.files)
            console.log('req.body.collections:', req.body.collections)

            const schedule = await Schedule.findById(id);
            if (!schedule) {
                return res.status(404).json({ msg: 'Schedule no encontrado' });
            }

            // ================================
            // ASEGURAR ESTRUCTURA LEGALIZATION
            // ================================
            if (!schedule.legalization) {
                schedule.legalization = {
                    createdAt: new Date(),
                    signature: {},
                    documents: {}
                };
            }

            if (!schedule.legalization.documents) {
                schedule.legalization.documents = {};
            }

            // ================================
            // PROCESAR ARCHIVOS
            // ================================
            const files = req.files || [];

            const dynamicCollections = {}; // { 0: [files], 1: [files] }
            const uploadedDocuments = {};

            for (const file of files) {
                const field = file.fieldname;

                const fileData = {
                    url: `/uploads/${file.filename}`,
                    public_id: file.filename,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadedAt: new Date()
                };

                // 🔵 ARCHIVOS DINÁMICOS (file_0_0)
                if (field.startsWith('file_')) {
                    const parts = field.split('_'); // ["file","0","0"]
                    const collectionIndex = parts[1];

                    if (!dynamicCollections[collectionIndex]) {
                        dynamicCollections[collectionIndex] = [];
                    }

                    dynamicCollections[collectionIndex].push(fileData);
                }

                // 🟢 SOPORTES FIJOS
                else {
                    if (!schedule.legalization.documents[field]) {
                        schedule.legalization.documents[field] = [];
                    }

                    schedule.legalization.documents[field].push(fileData);

                    if (!uploadedDocuments[field]) {
                        uploadedDocuments[field] = [];
                    }

                    uploadedDocuments[field].push(fileData);
                }
            }

            // ================================
            // PROCESAR COLLECTIONS DINÁMICAS
            // ================================
            if (req.body.collections) {
                const collectionsFromFrontend = JSON.parse(req.body.collections);
                console.log('collectionsFromFrontend:', JSON.stringify(collectionsFromFrontend))
                console.log('dynamicCollections:', JSON.stringify(dynamicCollections))

                collectionsFromFrontend.forEach((col, index) => {

                    // Si no existe la colección en ese índice, crearla
                    if (!schedule.collections[index]) {
                        schedule.collections.push({
                            name: col.name,
                            items: []
                        });
                    }

                    // Asegurar que exista items
                    if (!schedule.collections[index].items) {
                        schedule.collections[index].items = [];
                    }

                    // Agregar archivos si existen
                    if (dynamicCollections[index]) {
                        dynamicCollections[index].forEach(file => {
                            schedule.collections[index].items.push({
                                url: file.url,
                                public_id: file.public_id
                            });
                        });
                    }

                });

            }

            // ================================
            // MARCAR MODIFICADOS
            // ================================
            schedule.markModified('legalization');
            schedule.markModified('collections');

            await schedule.save();

            return res.status(200).json({
                msg: 'Documentos guardados correctamente',
                legalizationDocuments: schedule.legalization.documents,
                collections: schedule.collections
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ msg: 'Error al subir documentos' });
        }
    },


    putLegalization: async (req, res) => {
        const { id } = req.params
        const { collections, status, legalization } = req.body

        const data = {
            results: req.body.results,
            conclusions: req.body.conclusions,
            tripOrder: req.body.tripOrder, // ✅ agregar esto 
            legalization: { signature: {} }
        }

        const schedule = await Schedule.findOne({ _id: id })

        if (schedule.legalization) {
            data.legalization = schedule.legalization

            if (legalization.documents) {
                data.legalization.documents = legalization.documents
            }
        }

        if (legalization.signature.supervisor) {
            data.legalization.signature.supervisor = legalization.signature.supervisor
        }
        // ... resto igual

        schedule.status.index = status.index
        schedule.status.data = status.data
        schedule.status.justification = status.justification ? status.justification : null
        data.status = schedule.status

        console.log(legalization)

        if (legalization.signature.supervisor) {
            data.legalization.signature.supervisor = legalization.signature.supervisor
        }

        if (legalization.signature.contractor) {
            data.legalization.signature.contractor = legalization.signature.contractor
        }

        if (legalization.signature.publicWorker) {
            data.legalization.signature.publicWorker = legalization.signature.publicWorker
        }

        if (legalization.createdAt) {
            data.legalization.createdAt = legalization.createdAt
        }

        if (status.index == 4) {
            data.legalization = legalization
        }

        console.log(data)



        data.tempUrl = []

        // 🔒 NO TOCAR collections EN EL PUT
        await Schedule.findByIdAndUpdate(id, {
            $set: {
                results: data.results,
                conclusions: data.conclusions,
                tripOrder: data.tripOrder,
                legalization: data.legalization,
                status: data.status,
                tempUrl: []
            }
        })


        const creator = await User.findById(req.body.userId).populate('supervisor')
        const sup = await User.findById(req.body.userId)

        const link = process.env.CLIENT_URL

        // 🔔 EMITIR EVENTOS SEGÚN EL ESTADO
        if (req.body.status.data === 'Legalización firmada por Contratista') {

            let mailOptions = {
                from: process.env.MAIL_ADDRESS,
                to: creator.supervisor.mail,
                subject: 'Legalización Firmada',
                html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                </div><br />
                <p style="font-size: 16px; color: #333;font-weight:bold">LEGALIZACIÓN FIRMADA</p>
                <img src="cid:aceptar" alt="Aceptación" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
                <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${creator.supervisor.name},</p>
                <p style="font-size: 16px; color: #333;">El contratista <strong>${creator.name}</strong> ha firmado una legalización. Queda pendiente por su
                firma o rechazo.</p>
                <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                <span>*Este correo es generado automáticamente, por favor no responder</span>
            </div>
            `,
                attachments: [{
                    filename: 'logo-sena-blanco.png',
                    path: './images/logo-sena-blanco.png',
                    cid: 'logo_sena'
                },
                {
                    filename: 'aceptar.png',
                    path: './images/aceptar.png',
                    cid: 'aceptar'
                }]
            };

            sendEmail.sendMail(mailOptions, function (error) {
                if (error) {
                    console.log('Error al enviar correo de legalizacion firmada al supervisor:', error);
                } else {
                    console.log('Correo de legalización al supervisor enviado correctamente');
                }
            });

            // ✅ CAMBIO AQUÍ - Evento para index 5
            if (ioInstance) {
                ioInstance.emit('agenda-legalizada', {
                    scheduleId: id,
                    statusIndex: 5,
                    contractorId: schedule.contractor,
                    supervisorId: schedule.supervisor?.id,
                    userId: req.body.userId
                });
                console.log('✅ Evento "agenda-legalizada" emitido (index 5)');
            }

        } else if (req.body.status.data === 'Legalización Rechazada') {

            let SupervisorMailOptions = {
                from: process.env.MAIL_ADDRESS,
                to: schedule.contract.mail,
                subject: 'Agenda Rechazada',
                html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                     <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                     <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                     <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                     </div><br />
                     <p style="font-size: 16px; color: #333;font-weight:bold">LEGALIZACIÓN RECHAZADA</p>
                     <img src="cid:rechazar" alt="Rechazar" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
                     <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${schedule.contract.contractorName},</p>
                     <p style="font-size: 16px; color: #333;">Su supervisor de contrato <strong>${sup.name}</strong> ha rechazado su legalización con la 
                     siguiente justificacion: <strong>${schedule.status.justification}</strong></p>
                     <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                     <span>*Este correo es generado automáticamente, por favor no responder</span>
                 </div>
                 `,
                attachments: [{
                    filename: 'logo-sena-blanco.png',
                    path: './images/logo-sena-blanco.png',
                    cid: 'logo_sena'
                },
                {
                    filename: 'rechazar.png',
                    path: './images/rechazar.png',
                    cid: 'rechazar'
                }]
            }

            sendEmail.sendMail(SupervisorMailOptions, function (error) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Correo de rechazo de legalización enviado a contratista');
                }
            });

            // Mantener este evento (está bien)
            if (ioInstance) {
ioInstance.emit('agenda-legalizada', {
    scheduleId: id,
    statusIndex: 4,
    statusNumber: 3,
    contractorId: schedule.contractor,
    supervisorId: req.body.userId,
    justification: schedule.status.justification
});
                console.log('✅ Evento "legalizacion-rechazada" emitido');
            }

        } else if (req.body.status.data === 'Legalización firmada por Supervisor') {

            let mailOptions = {
                from: process.env.MAIL_ADDRESS,
                to: schedule.contract.mail,
                subject: 'Legalización aprobada y firmada',
                html: `<div style="border: 1px solid #ccc; padding: 20px; max-width: 600px; margin: 0 auto;text-align:center">
                <div style="background-color: #39a900; text-align: center; line-height: 50px;padding:10px">
                <img src="cid:logo_sena" alt="Logo del Sena" style="vertical-align: middle; width: 50px; height: 50px;">
                <h1 style="color:white; display: inline-block; margin-left:10px; line-height: normal;">VILE</h1>
                </div><br />
                <p style="font-size: 16px; color: #333;font-weight:bold">LEGALIZACIÓN FIRMADA</p>
                <img src="cid:aceptar" alt="Aceptación" style="display: block; margin: 0 auto; max-width: 20%; height: auto;"><br />
                <p style="font-size: 16px; color: #333;font-weight:bold">Hola ${schedule.contract.contractorName},</p>
                <p style="font-size: 16px; color: #333;">Su supervisor de contrato <strong>${schedule.supervisor.name}</strong> ha aprobado y firmado su legalización.</p>
                <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #39a900; color: #fff; text-decoration: none; border-radius: 5px; text-align: center; margin: 20px auto;">IR A VILE</a><br />
                <span>*Este correo es generado automáticamente, por favor no responder</span>
            </div>
            `,
                attachments: [{
                    filename: 'logo-sena-blanco.png',
                    path: './images/logo-sena-blanco.png',
                    cid: 'logo_sena'
                },
                {
                    filename: 'aceptar.png',
                    path: './images/aceptar.png',
                    cid: 'aceptar'
                }]
            };

            sendEmail.sendMail(mailOptions, function (error) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Correo de aprobación de legalización enviado a contratista');
                }
            });

            // ✅ CAMBIO AQUÍ - Evento para index 6
            if (ioInstance) {
                ioInstance.emit('agenda-legalizada', {
                    scheduleId: id,
                    statusIndex: 6,
                    supervisorId: req.body.userId,
                    contractorId: schedule.contractor
                });
                console.log('✅ Evento "agenda-legalizada" emitido (index 6)');
            }
        }

        return res.status(200).json({ msg: 'Legalización actualizada' })
    },


    // 📁 controllers/schedule.js
    // ...

    uploadDocument: async (req, res) => {
        try {
            if (!req.file)
                return res.status(400).json({ msg: 'Archivo no proporcionado' })

            const { scheduleId } = req.body
            if (!scheduleId)
                return res.status(400).json({ msg: 'scheduleId requerido' })

            const schedule = await Schedule.findById(scheduleId)
            if (!schedule)
                return res.status(404).json({ msg: 'Agenda no encontrada' })

            // ✅ URL completa para que Vue pueda mostrar la imagen
            const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`

            schedule.documents.push({
                name: req.file.originalname,
                url: fileUrl,
                publicId: req.file.filename,
                uploadedBy: req.user?.id || null
            })

            await schedule.save()

            res.json({
                msg: 'Documento subido correctamente',
                document: fileUrl
            })

        } catch (error) {
            console.error(error)
            res.status(500).json({ msg: 'Error subiendo archivo' })
        }
    },


    deleteDocument: async (req, res) => {
        try {
            const { scheduleId, documentId } = req.params

            const schedule = await Schedule.findById(scheduleId)
            if (!schedule)
                return res.status(404).json({ msg: 'Agenda no encontrada' })

            const document = schedule.documents.id(documentId)
            if (!document)
                return res.status(404).json({ msg: 'Documento no encontrado' })

            // Eliminar archivo físico
            const fullPath = path.join(process.cwd(), 'uploads', document.publicId)

            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath)
            }

            // Eliminar del array
            document.deleteOne()

            await schedule.save()

            res.json({ msg: 'Documento eliminado correctamente' })

        } catch (error) {
            console.error(error)
            res.status(500).json({ msg: 'Error eliminando documento' })
        }
    },


    getDocuments: async (req, res) => {
        try {
            const { id } = req.params

            const schedule = await Schedule.findById(id)

            if (!schedule)
                return res.status(404).json({ msg: 'Agenda no encontrada' })

            res.json(schedule.documents || [])

        } catch (err) {
            console.error(err)
            res.status(500).json({ msg: 'Error obteniendo documentos' })
        }
    },


    markAsSigned: async (req, res) => {
        try {
            const { scheduleId } = req.params;
            const { userId, documentUrl, publicId } = req.body;

            if (!scheduleId || !documentUrl) {
                return res.status(400).json({ msg: 'Faltan datos requeridos' });
            }

            const schedule = await Schedule.findById(scheduleId).populate('contractor');
            if (!schedule) return res.status(404).json({ msg: 'Agenda no encontrada' });

            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });

            // ✅ DETERMINAR QUÉ ESTÁ FIRMANDO
            const currentIndex = schedule.status.index;
            let newStatus = {};

            // ✅ Lógica basada en el estado actual y el rol del usuario
            if (currentIndex === 1 && user.role.data === 'supervisor') {
                // Supervisor firma la agenda inicial
                newStatus = {
                    index: 2,
                    data: 'Agenda firmada por Supervisor',
                    number: (schedule.status.number || 0) + 1
                };

                // 🔔 Emitir evento
                if (ioInstance) {
                    ioInstance.emit('agenda-firmada', {
                        scheduleId: schedule._id,
                        statusIndex: 2,
                        supervisorId: userId,
                        contractorId: schedule.contractor._id || schedule.contractor,
                        updatedBy: userId
                    });
                    console.log('✅ Evento "agenda-firmada" emitido (index 2)');
                }

            } else if (currentIndex === 4 && (user.role.data === 'contractor' || user.role.data === 'public_official')) {
                // Contratista/Funcionario firma la legalización
                newStatus = {
                    index: 5,
                    data: 'Legalización firmada por Contratista',
                    number: (schedule.status.number || 0) + 1
                };

                // 🔔 Emitir evento
                if (ioInstance) {
                    ioInstance.emit('agenda-legalizada', {
                        scheduleId: schedule._id,
                        statusIndex: 5,
                        contractorId: schedule.contractor._id || schedule.contractor,
                        supervisorId: schedule.supervisor?.id,
                        userId: userId

                    });
                    console.log('✅ Evento "agenda-legalizada" emitido (index 5)');
                }

            } else if (currentIndex === 5 && user.role.data === 'supervisor') {
                // Supervisor firma la legalización
                newStatus = {
                    index: 6,
                    data: 'Legalización firmada por Supervisor',
                    number: (schedule.status.number || 0) + 1
                };

                // 🔔 Emitir evento
                if (ioInstance) {
                    ioInstance.emit('agenda-legalizada', {
                        scheduleId: schedule._id,
                        statusIndex: 6,
                        supervisorId: userId,
                        contractorId: schedule.contractor._id || schedule.contractor
                    });
                    console.log('✅ Evento "agenda-legalizada" emitido (index 6)');
                }

            } else {
                return res.status(400).json({
                    msg: 'No se puede firmar en este estado',
                    currentIndex,
                    userRole: user.role.data
                });
            }

            // Actualizar la agenda
            schedule.attachedDocumentUrl = documentUrl;
            schedule.attachedDocumentPublicId = publicId || null;
            schedule.status = newStatus;

            // Guardar firma según el rol
            if (user.role.data === 'supervisor') {
                schedule.signature.supervisor = userId;
            } else if (user.role.data === 'contractor' || user.role.data === 'public_official') {
                schedule.signature.contractor = userId;
            }

            await schedule.save();

            res.json({ success: true, schedule });

        } catch (error) {
            console.error('Error marcando agenda como firmada:', error);
            res.status(500).json({ msg: 'Error interno del servidor' });
        }
    },


    serveSignedPdf: async (req, res) => {
        try {
            let { publicId } = req.params

            if (!publicId) {
                return res.status(400).json({ msg: 'publicId es requerido' })
            }

            publicId = decodeURIComponent(publicId)

            const filePath = path.join(process.cwd(), 'uploads', publicId)

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ msg: 'Archivo no encontrado' })
            }

            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${path.basename(filePath)}"`
            )

            return res.sendFile(filePath)

        } catch (error) {
            console.error('❌ Error sirviendo PDF:', error)
            res.status(500).json({ msg: 'Error interno' })
        }
    },

    downloadSignedPdf: async (req, res) => {
        try {
            let { publicId } = req.params

            if (!publicId) {
                return res.status(400).json({ msg: 'publicId es requerido' })
            }

            publicId = decodeURIComponent(publicId)

            const filePath = path.join(process.cwd(), 'uploads', publicId)

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ msg: 'Archivo no encontrado' })
            }

            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${path.basename(filePath)}"`
            )

            return res.sendFile(filePath)

        } catch (error) {
            console.error('❌ Error descargando PDF:', error)
            res.status(500).json({ msg: 'Error interno' })
        }
    },

    reviewDocument: async (req, res) => {
        try {
            const { scheduleId, documentId } = req.params
            const { status, comment } = req.body

            const schedule = await Schedule.findById(scheduleId)

            if (!schedule) {
                return res.status(404).json({ msg: 'Agenda no encontrada' })
            }

            const document = schedule.documents.id(documentId)

            if (!document) {
                return res.status(404).json({ msg: 'Documento no encontrado' })
            }

            document.review = {
                status,
                comment: comment || '',
                reviewedAt: new Date(),
                reviewedBy: req.user?.id
            }

            await schedule.save()

            res.status(200).json({ msg: 'Documento revisado correctamente' })

        } catch (error) {
            console.error(error)
            res.status(500).json({ msg: 'Error interno' })
        }
    },



    addRadication: async (req, res) => {
        try {
            const { scheduleId } = req.params
            const { status, radicationNumber } = req.body

            if (!radicationNumber) {
                return res.status(400).json({
                    message: 'El número de radicación es obligatorio'
                })
            }

            const schedule = await Schedule.findById(scheduleId)

            if (!schedule) {
                return res.status(404).json({
                    message: 'Agenda no encontrada'
                })
            }

            // ✅ AGREGAR RADICACIÓN
            schedule.radications.push({
                status: status || 'RADICADO',
                radicationNumber,
                user: req.user?._id // opcional si usas auth
            })

            // (opcional) actualizar estado general
            schedule.status = {
                ...schedule.status,
                data: 'RADICADO',
                index: 5
            }

            await schedule.save()

            return res.status(201).json(schedule)

        } catch (error) {
            console.error('❌ Error addRadication:', error)
            return res.status(500).json({
                message: 'Error al agregar radicación'
            })
        }
    },




}



export { httpSchedule }