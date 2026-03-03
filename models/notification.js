import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Schedule',
      default: null
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    read: {
      type: Boolean,
      default: false
    },

    date: {
      type: String
    },

    time: {
      type: String
    },

    metadata: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
)

export const Notification = mongoose.model('Notification', notificationSchema)
