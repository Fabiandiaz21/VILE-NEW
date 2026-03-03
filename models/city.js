import mongoose from 'mongoose'

const schemaCity = new mongoose.Schema({
    name: { type: String },
    county: { type: mongoose.Schema.Types.ObjectId, ref: 'County'},
})

export default mongoose.model('City', schemaCity)