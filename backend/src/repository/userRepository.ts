import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import { serializeTimestamps } from "../lib/serialize";

export interface UserPreferences {
  locationEnabled: boolean;
  aiSuggestionsEnabled: boolean;
}

export interface UserDocument {
  ownerId: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  // Storage path of the uploaded profile avatar (users/{uid}/avatar/avatar).
  // Optional in the type so documents created before the field existed
  // deserialize without migration (fixing-plan: settings refactor 2026-09-07).
  avatarPath?: string | null;
  role: "user" | "admin";
  accountStatus: "active" | "suspended" | "deleted";
  preferences: UserPreferences;
  createdAt: FieldValue | string;
  updatedAt: FieldValue | string;
  lastLoginAt?: FieldValue | string;
}

export const defaultPreferences: UserPreferences = {
  locationEnabled: true,
  aiSuggestionsEnabled: true,
};

export type UserUpdatePatch = Partial<
  Omit<UserDocument, "preferences"> & {
    preferences?: Partial<UserPreferences>;
  }
>;

export class UserRepository {
  private get collection() {
    return getFirebaseFirestore().collection("users");
  }

  async findOrCreateUser(
    uid: string,
    tokenClaims: { email?: string; name?: string; picture?: string } = {}
  ): Promise<UserDocument> {
    const userRef = this.collection.doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      const newUser: UserDocument = {
        ownerId: uid,
        displayName: tokenClaims.name || tokenClaims.email?.split("@")[0] || "User",
        email: tokenClaims.email || "",
        photoURL: tokenClaims.picture || null,
        avatarPath: null,
        role: "user",
        accountStatus: "active",
        preferences: defaultPreferences,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
      };

      await userRef.set(newUser);
      const createdDoc = await userRef.get();
      return serializeTimestamps(
        createdDoc.data() as UserDocument & Record<string, unknown>
      );
    } else {
      await userRef.update({
        lastLoginAt: FieldValue.serverTimestamp(),
      });
      const updatedDoc = await userRef.get();
      return serializeTimestamps(
        updatedDoc.data() as UserDocument & Record<string, unknown>
      );
    }
  }

  async updateUserProfile(uid: string, patch: UserUpdatePatch): Promise<UserDocument> {
    const userRef = this.collection.doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      throw new Error("USER_NOT_FOUND");
    }

    const currentData = doc.data() as UserDocument;
    // Documents created before the 2026-09-12 schema change may still carry
    // the retired `theme`/`timezone` preference keys — strip them on every
    // write so stored documents converge on the current schema.
    const legacyPrefs = currentData.preferences as unknown as Record<string, unknown> | undefined;
    delete legacyPrefs?.theme;
    delete legacyPrefs?.timezone;
    const updatedPreferences = patch.preferences
      ? { ...currentData.preferences, ...patch.preferences }
      : currentData.preferences;

    const updateData: Record<string, unknown> = {
      ...patch,
      ...(patch.preferences ? { preferences: updatedPreferences } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await userRef.update(updateData);
    const updatedDoc = await userRef.get();
    return serializeTimestamps(
      updatedDoc.data() as UserDocument & Record<string, unknown>
    );
  }
}

export const userRepository = new UserRepository();
