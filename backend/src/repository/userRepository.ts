import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  timezone: string;
  locationEnabled: boolean;
  aiSuggestionsEnabled: boolean;
}

export interface UserDocument {
  ownerId: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: "user" | "admin";
  accountStatus: "active" | "suspended" | "deleted";
  preferences: UserPreferences;
  createdAt: FieldValue | string;
  updatedAt: FieldValue | string;
  lastLoginAt?: FieldValue | string;
}

export const defaultPreferences: UserPreferences = {
  theme: "system",
  timezone: "UTC",
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
        role: "user",
        accountStatus: "active",
        preferences: defaultPreferences,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
      };

      await userRef.set(newUser);
      const createdDoc = await userRef.get();
      return createdDoc.data() as UserDocument;
    } else {
      await userRef.update({
        lastLoginAt: FieldValue.serverTimestamp(),
      });
      const updatedDoc = await userRef.get();
      return updatedDoc.data() as UserDocument;
    }
  }

  async updateUserProfile(uid: string, patch: UserUpdatePatch): Promise<UserDocument> {
    const userRef = this.collection.doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      throw new Error("USER_NOT_FOUND");
    }

    const currentData = doc.data() as UserDocument;
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
    return updatedDoc.data() as UserDocument;
  }
}

export const userRepository = new UserRepository();
