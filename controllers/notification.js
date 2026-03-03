import { Notification } from '../models/notification.js'

export const httpNotification = {

  // ✅ Crear notificación
  create: async (req, res) => {
    try {
      const { userId, scheduleId, message } = req.body

      const now = new Date()

      const notification = await Notification.create({
        userId,
        scheduleId,
        message,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        read: false
      })

      res.status(201).json(notification)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  // ✅ Listar notificaciones por usuario
  getByUser: async (req, res) => {
    try {
      const { userId } = req.params

      const notifications = await Notification
        .find({ userId })
        .sort({ createdAt: -1 })
        .populate('scheduleId')

      res.json(notifications)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  // ✅ Marcar una como leída
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params

      const notification = await Notification.findByIdAndUpdate(
        id,
        { read: true },
        { new: true }
      )

      res.json(notification)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  // ✅ Marcar todas como leídas
  markAllAsRead: async (req, res) => {
    try {
      const { userId } = req.params

      await Notification.updateMany(
        { userId, read: false },
        { read: true }
      )

      res.json({ message: 'Todas marcadas como leídas' })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  },

  // ✅ Contador de no leídas
  unreadCount: async (req, res) => {
    try {
      const { userId } = req.params

      const count = await Notification.countDocuments({
        userId,
        read: false
      })

      res.json({ unread: count })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }

}
