import { Request, Response, NextFunction } from "express";
import { getFirebaseAuth } from "../lib/firebaseAdmin";
import { ErrorCode } from "../types/errors";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED" as ErrorCode,
        message: "Missing or malformed Authorization header.",
        requestId: req.requestId,
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED" as ErrorCode,
        message: "Empty authentication token provided.",
        requestId: req.requestId,
      },
    });
    return;
  }

  try {
    const decodedToken = await getFirebaseAuth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    next();
  } catch {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED" as ErrorCode,
        message: "Invalid or expired authentication token.",
        requestId: req.requestId,
      },
    });
    return;
  }
}
