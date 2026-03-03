import { Router } from 'express'
import mongoose from 'mongoose'
import Institute from '../models/institute.js'

const routerInstitute = Router()

routerInstitute.get('/', async (req, res) => {
  const institute = await Institute.find()
  return res.json(institute)
})

routerInstitute.get('/search', async (req, res) => {
  const { regional } = req.query

  // 🛑 Si NO es ObjectId (ej: "Antioquia"), no buscar
  if (!mongoose.Types.ObjectId.isValid(regional)) {
    return res.json([])
  }

  const institute = await Institute.find({ regional })
  return res.json(institute)
})

routerInstitute.post('/', async (req, res) => {
  const institute = new Institute(req.body)
  await institute.save()
  return res.json({ msg: 'centro creado' })
})

export { routerInstitute }
