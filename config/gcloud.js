import { Storage } from '@google-cloud/storage'

const storage = new Storage({
  keyFilename: 'config/gcloud-key.json'
})

const bucket = storage.bucket('legalizaciones-pdf')

export default bucket
