
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  initializeApp,
  getApps,
  cert
} from "firebase-admin/app";

import { getFirestore } from "firebase-admin/firestore";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

function loadServiceAccount() {
  const envCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (envCredentials) {
    try {
      return JSON.parse(envCredentials);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON."
      );
    }
  }

  const serviceAccountPath = path.resolve(
    currentDir,
    "../private/serviceAccountKey.json"
  );

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      "Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON " +
      "or add backend/private/serviceAccountKey.json."
    );
  }

  return JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );
}

const existingApps = getApps();

const app =
  existingApps.length > 0
    ? existingApps[0]
    : initializeApp({
        credential: cert(loadServiceAccount())
      });

export const db = getFirestore(app);
export { app };
