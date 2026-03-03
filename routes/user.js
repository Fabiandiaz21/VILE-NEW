import { Router } from 'express'

import { httpUser } from '../controllers/user.js'

import { check } from "express-validator"

import { validarCampos } from "../middlewares/validar-campos.js";

import { uploadMiddleware } from '../middlewares/upload.js'


const routerUser = Router()

routerUser.get('/', [], httpUser.getUser)

routerUser.get('/:id', [], httpUser.getUserParams)

routerUser.post('/', [], httpUser.postUser)

routerUser.post('/login', httpUser.postLogin)   


routerUser.put('/sign/:id', uploadMiddleware.single('test'), httpUser.putSign)
routerUser.patch('/:id', httpUser.patchUser)

routerUser.put('/:id', httpUser.putUser)


routerUser.put("/email/clave", [
    check("mail", "Debe proporcionar el correo").trim().not().isEmpty(),
    validarCampos
], httpUser.envioEmail)

routerUser.put("/nueva/contrasena", [
    check("nuevaContrasena", "La contraseña debe tener al menos 8 caracteres").trim().isLength({ min: 8 }),
    validarCampos
], httpUser.nuevaContrasena);

export {
    routerUser
}