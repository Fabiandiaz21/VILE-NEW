import mongoose from 'mongoose'

async function connect() {
    // 'mongodb://127.0.0.1:27017/test'
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log('conectado a mongodb!')
    } catch(error) {
        console.log(error)
    }
}

export default connect