import mongoose from 'mongoose'

const schemaShedule = new mongoose.Schema({
    contractor: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },

    publicWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'staff' },

    supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    contract: {
        mail: { type: String },
        number: { type: String },
        date: {
            start: { type: Date },
            end: { type: Date }
        },
        contractorName: { type: String },
        publicName: { type: String },
        publicBranch: { type: String },
        object: { type: String },
        regional: { type: String },
        institute: { type: String }
    },

    typeSchedule: { type: String, default: 'contractor' }, // contractor - commission

    supervisor: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String },
        position: { type: String }
    },

    paymaster: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String },
        position: { type: String }
    },

    route: {
        go: [{ data: { type: String } }],
        return: [{ data: { type: String } }]
    },

    meanstransport: {
        go: [{ data: { type: String } }],
        return: [{ data: { type: String } }]
    },

    regional: { type: String },
    institute: { type: String },

    institutes: [{ data: { type: String } }],
    places: [{ data: { type: String } }],

    place: { type: String },
    company: { type: String },
    companyContact: { type: String },
    tripOrder: { type: String },
    tripStart: { type: Date },
    tripEnd: { type: Date },
    tripObjective: { type: String },
    duties: [{ data: { type: String } }],
    observations: [
        {
            key: String,
            text: String,
            amount: Number,      
            cdp: Number,        
            cdpName: String      
        }
    ],

    // 🔹 Actividades con hora de inicio y fin
    activities: [
        {
            date: { type: String },
            items: [
                {
                    data: String,
                    startTime: { type: String }, // hora de inicio
                    endTime: { type: String } // hora de fin
                }
            ]
        }
    ],

    // 🔹 Clasificación de la información
    infoClassification: {
        type: String,
        default: 'Pública',
        select: false

    },

    signature: {
        contractor: { type: String },
        publicWorker: { type: String },
        supervisor: { type: String },
        paymaster: { type: String }
    },

    createdAt: { type: Date, default: Date.now },

    status: {
        number: { type: Number, default: 1 },
        data: { type: String },
        index: { type: Number },
        justification: { type: String }
    },

    attachedDocumentUrl: { type: String },
    attachedDocumentPublicId: { type: String }, 

    // 🔹 Documentos enviados por contratista para radicar
documents: [
  {
    name: { type: String },
    url: { type: String },
    publicId: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // 🔹 NUEVO: estado de revisión
    review: {
      status: {
        type: String,
        enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO'],
        default: 'PENDIENTE'
      },
      comment: { type: String },
      reviewedAt: { type: Date },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  }
],
legalization: {
    createdAt: { type: Date, default: Date.now },

    signature: {
        contractor: { type: String },
        publicWorker: { type: String },
        supervisor: { type: String }
    },

documents: {
  compromisoPresupuestal: [{
    url: String,
    public_id: String
  }],
  autorizacionPago: [{
    url: String,
    public_id: String
  }],
  asistenciaFormacion: [{
    url: String,
    public_id: String
  }],
  interveredal: [{
    url: String,
    public_id: String
  }],
  tiquetes: [{
    url: String,
    public_id: String
  }],
  reintegros: [{
    url: String,
    public_id: String
  }]
}

},

    results: [{ data: { type: String } }],

    collections: [
        { name: { type: String }, items: [{ url: { type: String }, public_id: { type: String } }] }
    ],

    conclusions: [{ data: { type: String } }],

    tempUrl: [
        { url: { type: String }, folder: { type: String }, public_id: { type: String } }
    ],

    // 🔹 Historial de radicación
    radications: [
        {
            status: {
                type: String,
                enum: ['RADICADO', 'NO_RADICADO'],
                default: 'NO_RADICADO'
            },

            radicationNumber: {
                type: String,
                trim: true
            },

            date: {
                type: Date,
                default: Date.now
            },

            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        }
    ]


})

export default mongoose.model('Schedule', schemaShedule)
