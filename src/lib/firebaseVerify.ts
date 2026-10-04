import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * ตรวจ Firebase ID token ฝั่งเซิร์ฟเวอร์ ด้วยกุญแจสาธารณะของ Google (ไม่ต้องใช้ service account)
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

export type FirebaseUser = { uid: string; email?: string; name?: string };

export async function verifyFirebaseToken(req: Request): Promise<FirebaseUser | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!projectId || !token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) return null;
    return { uid: payload.sub, email: payload.email as string | undefined, name: payload.name as string | undefined };
  } catch {
    return null;
  }
}
