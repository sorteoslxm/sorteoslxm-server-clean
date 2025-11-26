// middleware/authMiddleware.js
import dotenv from "dotenv";
dotenv.config();

export function verificarAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  const adminToken = process.env.ADMIN_TOKEN;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "No estás autenticado" });
  }

  next();
}
