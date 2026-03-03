import mongoose from 'mongoose'

const instituteSchema = new mongoose.Schema({
    regional: { type: mongoose.Schema.Types.ObjectId, ref: 'County' },
    name: { type: String }
})

export default mongoose.model('Institute', instituteSchema)