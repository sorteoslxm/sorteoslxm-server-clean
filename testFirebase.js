import { db } from "./firebase.js";

(async () => {
  try {
    const snapshot = await db.collection("sorteos").get();
    console.log("✅ Conectado correctamente a Firestore. Documentos encontrados:", snapshot.size);
    snapshot.forEach(doc => {
      console.log("📄", doc.id, "=>", doc.data());
    });
  } catch (err) {
    console.error("❌ Error conectando a Firestore:", err);
  }
})();
