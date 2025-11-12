// /Users/mustamusic/web/sorteoslxm-server-clean/routes/admin.js
import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import { db } from "../config/firebase.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Variables de entorno
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || "jwt_secret_seguro";

// ✅ LOGIN: POST /api/admin/login
router.post("/login", (req, res) => {
  const { password } = req.body;
  if (!password)
    return res.status(400).json({ success: false, message: "Falta contraseña" });

  if (password === ADMIN_TOKEN) {
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
    return res.json({ success: true, token });
  } else {
    return res.status(401).json({ success: false, message: "Credenciales inválidas" });
  }
});

// ✅ Verificación de token
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(403).json({ error: "Token requerido" });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Token inválido o expirado" });
    req.user = decoded;
    next();
  });
}

// ✅ Crear sorteo (protegido): POST /api/admin/sorteos
router.post("/sorteos", verificarToken, upload.single("imagen"), async (req, res) => {
  try {
    const { titulo, descripcion, precio, numerosTotales } = req.body;
    const file = req.file;

    let imagenUrl = req.body.imagenUrl || null;

    if (file) {
      // Subir imagen a Cloudinary
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "sorteos" },
        async (error, uploadResult) => {
          if (error) return res.status(500).json({ error: error.message });

          imagenUrl = uploadResult.secure_url;
          const docRef = await db.collection("sorteos").add({
            titulo,
            descripcion,
            precio: Number(precio || 0),
            numerosTotales: Number(numerosTotales || 0),
            imagenUrl,
            activo: true,
            createdAt: new Date(),
          });
          res.json({ id: docRef.id, mensaje: "Sorteo creado correctamente ✅" });
        }
      );
      uploadStream.end(file.buffer);
    } else {
      // Si no hay imagen, crear igual
      const docRef = await db.collection("sorteos").add({
        titulo,
        descripcion,
        precio: Number(precio || 0),
        numerosTotales: Number(numerosTotales || 0),
        imagenUrl,
        activo: true,
        createdAt: new Date(),
      });
      res.json({ id: docRef.id, mensaje: "Sorteo creado correctamente ✅" });
    }
  } catch (error) {
    console.error("Error crear sorteo admin:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Check rápido
router.get("/check", (req, res) => res.json({ message: "Admin API funcionando ✅" }));

export default router;
