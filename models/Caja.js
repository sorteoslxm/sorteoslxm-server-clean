import mongoose from "mongoose";

const PremioSchema = new mongoose.Schema(
  {
    nombre: String,
    monto: Number,
    cantidadTotal: Number,
    desbloqueoPorVentas: Number,
    desbloqueado: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
  },
  { _id: false }
);

const CajaSchema = new mongoose.Schema(
  {
    titulo: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    precioCaja: { type: Number, required: true },
    totalCajas: { type: Number, required: true },

    cajasVendidas: { type: Number, default: 0 },
    estado: { type: String, enum: ["activa", "cerrada"], default: "activa" },

    premios: [PremioSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Caja", CajaSchema);
