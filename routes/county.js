import { Router } from 'express'
import County from '../models/county.js'

const routerCounty = Router()

routerCounty.get('/', [], async (req, res) => {
    const { regional } = req.query

    const county = await County.find()

    if (!regional) {
        const index = county.findIndex(element => element.name == 'Dirección General')

        if (index !== -1) {
            county.splice(index, 1)
        }
    }

    return res.json(county)
})

routerCounty.post('/', [], async (req, res) => {
    const county = new County(req.body)

    await county.save()

    return res.json({ msg: 'departamento creado' })
})

export { routerCounty }