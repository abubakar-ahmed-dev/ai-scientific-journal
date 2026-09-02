import { initializeApp, getApps, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { env } from "../config/env";

let app: App | null = null;

export function getFirebaseAdminApp(): App {
  if (!app) {
    const apps = getApps();
    if (apps.length > 0) {
      app = apps[0]!;
    } else {
      app = initializeApp({
        projectId: env.FIREBASE_PROJECT_ID,
      });
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}
