import { Router } from 'express'
import { amountController } from '../controllers/Amount.js'

const routerAmount = Router()

routerAmount.post('/', amountController.create)
routerAmount.get('/', amountController.getAll)
routerAmount.get('/:id', amountController.getById)
routerAmount.put('/:id', amountController.update)
routerAmount.delete('/:id', amountController.delete)

export  {routerAmount}
