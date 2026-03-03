import mongoose from 'mongoose'

const AmountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    type: {
      type: String,
      required: true,
      enum: ['aerea', 'terrestres', 'cdp']
    },

    dependency: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model('Amount', AmountSchema)

