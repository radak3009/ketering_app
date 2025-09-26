/**
 * Seed script for Firebase emulator:
 * - Creates an auth user with email radakovic.mng@gmail.com and password Admin123!
 * - Creates a users/{uid} document with roles ['admin']
 *
 * Run in emulator environment with Firebase Admin SDK:
 *   node scripts/seed.js
 *
 * Note: This is a TypeScript file; transpile or use ts-node in dev environment.
 */
import * as admin from "firebase-admin";

async function run() {
  admin.initializeApp({ projectId: "ketering-app-495cd" });

  try {
    const user = await admin.auth().createUser({
      email: "radakovic.mng@gmail.com",
      emailVerified: true,
      password: "Admin123!",
      displayName: "Admin Radaković"
    });
    console.log("Created auth user:", user.uid);

    await admin.firestore().collection('users').doc(user.uid).set({
      displayName: "Admin Radaković",
      email: "radakovic.mng@gmail.com",
      roles: ['admin'],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Created users doc for admin.");
  } catch (err) {
    console.error("Seed error:", err);
  }
}

run();
