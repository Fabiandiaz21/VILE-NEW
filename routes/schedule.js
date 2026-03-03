import { Router } from 'express'
import { httpSchedule } from '../controllers/schedule.js'
import { uploadMiddleware } from '../middlewares/upload.js';

const routerSchedule = Router()

routerSchedule.get('/', [], httpSchedule.getSchedule)

routerSchedule.get('/:id/detail', [], httpSchedule.getScheduleById)

routerSchedule.get('/:id', [], httpSchedule.getScheduleParams)

routerSchedule.post('/', [], httpSchedule.postSchedule)

routerSchedule.post(
  '/upload-document',
  uploadMiddleware.single('file'),
  httpSchedule.uploadDocument
)
routerSchedule.delete(
  '/:scheduleId/document/:documentId',
  httpSchedule.deleteDocument
)

routerSchedule.get('/:id/documents', httpSchedule.getDocuments)

routerSchedule.post('/sign/:scheduleId', httpSchedule.markAsSigned)
routerSchedule.get('/view/:publicId', httpSchedule.serveSignedPdf)
routerSchedule.get('/download/:publicId', httpSchedule.downloadSignedPdf)
routerSchedule.post(
  '/review-document/:scheduleId/:documentId',
  httpSchedule.reviewDocument
)



routerSchedule.post('/:scheduleId/radication', httpSchedule.addRadication)
routerSchedule.put('/:id', [], httpSchedule.putSchedule)
routerSchedule.post('/legalization/:id', uploadMiddleware.any(), httpSchedule.postLegalizacion)
routerSchedule.put('/legalization/:id', [], httpSchedule.putLegalization)



export { routerSchedule }