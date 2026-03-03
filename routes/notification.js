import { Router } from 'express'
import { httpNotification } from '../controllers/notification.js'

const routerNotification = Router()

routerNotification.post('/', httpNotification.create)
routerNotification.get('/user/:userId', httpNotification.getByUser)
routerNotification.put('/read/:id', httpNotification.markAsRead)
routerNotification.put('/read-all/:userId', httpNotification.markAllAsRead)
routerNotification.get('/unread/:userId', httpNotification.unreadCount)

export { routerNotification }
