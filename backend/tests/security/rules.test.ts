import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import { USER_A, USER_B } from "../fixtures/userFixtures";

const PROJECT_ID = "demo-test";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8082";

let testEnv: RulesTestEnvironment | null = null;
let isEmulatorAvailable = false;

function checkEmulatorAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

describe("Firestore Security Rules", () => {
  beforeAll(async () => {
    const rulesPath = path.resolve(__dirname, "../../../firebase/firestore.rules");
    const rules = fs.readFileSync(rulesPath, "utf8");

    const [host, portStr] = EMULATOR_HOST.split(":");
    const port = parseInt(portStr || "8082", 10);
    const hostName = host || "localhost";

    isEmulatorAvailable = await checkEmulatorAvailable(hostName, port);

    if (isEmulatorAvailable) {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          host: hostName,
          port,
          rules,
        },
      });
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it("unauthenticated requests are denied everywhere", async () => {
    if (!testEnv) {
      console.warn("Skipping rules test: Firestore emulator is not running at " + EMULATOR_HOST);
      return;
    }
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthDb.doc(`users/${USER_A.uid}`).get());
    await assertFails(
      unauthDb.doc(`users/${USER_A.uid}/observations/obs-1`).get()
    );
  });

  it("User A can create, read, update, and delete their own user document with valid schema", async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext(USER_A.uid).firestore();
    const userRef = aliceDb.doc(`users/${USER_A.uid}`);

    // Create
    await assertSucceeds(
      userRef.set({
        ownerId: USER_A.uid,
        displayName: USER_A.displayName,
        email: USER_A.email,
        role: "user",
        accountStatus: "active",
        createdAt: new Date(),
      })
    );

    // Read
    await assertSucceeds(userRef.get());

    // Update (valid)
    await assertSucceeds(
      userRef.update({
        displayName: "Updated Alice",
      })
    );

    // Delete
    await assertSucceeds(userRef.delete());
  });

  it("User A cannot create user document with role admin or accountStatus suspended", async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext(USER_A.uid).firestore();
    const userRef = aliceDb.doc(`users/${USER_A.uid}`);

    await assertFails(
      userRef.set({
        ownerId: USER_A.uid,
        displayName: USER_A.displayName,
        email: USER_A.email,
        role: "admin",
        accountStatus: "active",
      })
    );

    await assertFails(
      userRef.set({
        ownerId: USER_A.uid,
        displayName: USER_A.displayName,
        email: USER_A.email,
        role: "user",
        accountStatus: "suspended",
      })
    );
  });

  it("User A cannot alter role, accountStatus, or ownerId on update", async () => {
    if (!testEnv) return;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`users/${USER_A.uid}`).set({
        ownerId: USER_A.uid,
        role: "user",
        accountStatus: "active",
        createdAt: "2026-01-01T00:00:00Z",
      });
    });

    const aliceDb = testEnv.authenticatedContext(USER_A.uid).firestore();
    const userRef = aliceDb.doc(`users/${USER_A.uid}`);

    await assertFails(userRef.update({ role: "admin" }));
    await assertFails(userRef.update({ accountStatus: "suspended" }));
    await assertFails(userRef.update({ ownerId: USER_B.uid }));
  });

  it("User A can manage projects and observations; client cannot write versions or analyses", async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext(USER_A.uid).firestore();

    // Create project
    const projRef = aliceDb.doc(`users/${USER_A.uid}/projects/proj-1`);
    await assertSucceeds(
      projRef.set({
        ownerId: USER_A.uid,
        title: "Alice Study",
      })
    );

    // Create observation with valid project reference
    const obsRef = aliceDb.doc(`users/${USER_A.uid}/observations/obs-1`);
    await assertSucceeds(
      obsRef.set({
        ownerId: USER_A.uid,
        projectId: "proj-1",
        title: "Obs 1",
      })
    );

    // Client write to versions subcollection is prohibited
    const verRef = aliceDb.doc(
      `users/${USER_A.uid}/observations/obs-1/versions/v1`
    );
    await assertFails(
      verRef.set({
        title: "Version 1",
      })
    );

    // Client write to analyses collection is prohibited
    const anaRef = aliceDb.doc(`users/${USER_A.uid}/analyses/ana-1`);
    await assertFails(
      anaRef.set({
        ownerId: USER_A.uid,
        type: "summary",
      })
    );
  });

  it("User B cannot access or modify User A's data", async () => {
    if (!testEnv) return;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`users/${USER_A.uid}`).set({
        ownerId: USER_A.uid,
        role: "user",
        accountStatus: "active",
      });
      await context
        .firestore()
        .doc(`users/${USER_A.uid}/observations/obs-1`)
        .set({
          ownerId: USER_A.uid,
          title: "Alice Private Note",
        });
    });

    const bobDb = testEnv.authenticatedContext(USER_B.uid).firestore();

    await assertFails(bobDb.doc(`users/${USER_A.uid}`).get());
    await assertFails(
      bobDb.doc(`users/${USER_A.uid}/observations/obs-1`).get()
    );
    await assertFails(
      bobDb.doc(`users/${USER_A.uid}/observations/obs-1`).delete()
    );
  });

  it("projectId integrity: observation referencing foreign project is denied", async () => {
    if (!testEnv) return;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`users/${USER_B.uid}/projects/proj-b`).set({
        ownerId: USER_B.uid,
        title: "Bob Project",
      });
    });

    const aliceDb = testEnv.authenticatedContext(USER_A.uid).firestore();
    const obsRef = aliceDb.doc(`users/${USER_A.uid}/observations/obs-foreign`);

    // Reference Bob's project -> denied
    await assertFails(
      obsRef.set({
        ownerId: USER_A.uid,
        projectId: "proj-b",
        title: "Invalid Ref",
      })
    );
  });
});
