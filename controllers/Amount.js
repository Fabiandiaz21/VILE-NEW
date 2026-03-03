import Amount from '../models/Amount.js'

export const amountController = {
  /* ===============================
     CREAR REGISTRO
  ================================ */
  create: async (req, res) => {
    try {
      const { name, amount, type, dependency } = req.body

      // Validar campos obligatorios
      if (!name || !amount || !type || !dependency) {
        return res.status(400).json({
          ok: false,
          message: 'Los campos name, amount, type y dependency son obligatorios'
        })
      }

      // Crear nuevo registro
      const newAmount = await Amount.create({
        name,
        amount,
        type,
        dependency
      })

      res.status(201).json({
        ok: true,
        message: 'Registro creado correctamente',
        data: newAmount
      })
    } catch (error) {
      // Error por registro duplicado
      if (error.code === 11000) {
        return res.status(409).json({
          ok: false,
          message: 'Ya existe un registro con el mismo nombre, tipo y dependencia'
        })
      }

      res.status(500).json({
        ok: false,
        message: 'Error al crear el registro',
        error: error.message
      })
    }
  },

  /* ===============================
     LISTAR REGISTROS
     (filtro opcional por tipo y dependencia)
  ================================ */
  getAll: async (req, res) => {
    try {
      const { type, dependency } = req.query

      // Construir filtro dinámico
      const filter = {}
      if (type) filter.type = type
      if (dependency) filter.dependency = dependency

      const amounts = await Amount.find(filter).sort({ createdAt: -1 })

      res.json({
        ok: true,
        message: 'Registros obtenidos correctamente',
        data: amounts
      })
    } catch (error) {
      res.status(500).json({
        ok: false,
        message: 'Error al obtener los registros',
        error: error.message
      })
    }
  },

  /* ===============================
     OBTENER REGISTRO POR ID
  ================================ */
  getById: async (req, res) => {
    try {
      const { id } = req.params

      const amount = await Amount.findById(id)

      // Validar existencia del registro
      if (!amount) {
        return res.status(404).json({
          ok: false,
          message: 'Registro no encontrado'
        })
      }

      res.json({
        ok: true,
        message: 'Registro obtenido correctamente',
        data: amount
      })
    } catch (error) {
      res.status(500).json({
        ok: false,
        message: 'Error al obtener el registro',
        error: error.message
      })
    }
  },

  /* ===============================
     ACTUALIZAR REGISTRO
  ================================ */
  update: async (req, res) => {
    try {
      const { id } = req.params
      const { name, amount, type, dependency } = req.body

      const updated = await Amount.findByIdAndUpdate(
        id,
        { name, amount, type, dependency },
        { new: true, runValidators: true }
      )

      // Validar si el registro existe
      if (!updated) {
        return res.status(404).json({
          ok: false,
          message: 'Registro no encontrado'
        })
      }

      res.json({
        ok: true,
        message: 'Registro actualizado correctamente',
        data: updated
      })
    } catch (error) {
      res.status(500).json({
        ok: false,
        message: 'Error al actualizar el registro',
        error: error.message
      })
    }
  },

  /* ===============================
     ELIMINAR REGISTRO
  ================================ */
  delete: async (req, res) => {
    try {
      const { id } = req.params

      const deleted = await Amount.findByIdAndDelete(id)

      // Validar si el registro existe
      if (!deleted) {
        return res.status(404).json({
          ok: false,
          message: 'Registro no encontrado'
        })
      }

      res.json({
        ok: true,
        message: 'Registro eliminado correctamente'
      })
    } catch (error) {
      res.status(500).json({
        ok: false,
        message: 'Error al eliminar el registro',
        error: error.message
      })
    }
  }
}
