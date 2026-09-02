import { useAuth } from "../lib/firebase/authContext";

export default function LandingPage() {
  const { currentUser, loading, signInWithGoogle, signOut } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900">AI Scientific Journal</h1>
        <p className="mt-2 text-gray-600">
          Secure, authenticated scientific journaling with Gemini AI capabilities.
        </p>

        <div className="mt-6">
          {loading ? (
            <p className="text-gray-500">Resolving authentication state...</p>
          ) : currentUser ? (
            <div className="space-y-4">
              <p className="text-sm text-green-700 bg-green-50 p-2 rounded">
                Signed in as <strong>{currentUser.email || currentUser.displayName || currentUser.uid}</strong>
              </p>
              <button
                onClick={() => signOut()}
                className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
