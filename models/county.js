import mongoose from 'mongoose'

const schemaCounty = new mongoose.Schema({
    name: { type: String },
})

export default mongoose.model('County', schemaCounty)