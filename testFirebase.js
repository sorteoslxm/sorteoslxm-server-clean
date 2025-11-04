import admin from "./config/firebase.js";

async function test() {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("sorteos").get();
    console.log("✅ Total sorteos:", snapshot.size);
    snapshot.forEach(doc => console.log(doc.id, doc.data()));
  } catch (err) {
    console.error("❌ Error Firebase:", err);
  }
}

test();
