import jwt from "jsonwebtoken";
import crypto from "crypto";
import RefreshToken from "../models/RefreshToken.js";

export function signAccessToken(payload, opts = {}) {
  const secret = process.env.JWT_ACCESS_SECRET;
  return jwt.sign(payload, secret, { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m", ...opts });
}

export function signRefreshToken(payload, opts = {}) {
  const secret = process.env.JWT_REFRESH_SECRET;
  return jwt.sign(payload, secret, { expiresIn: process.env.REFRESH_TOKEN_TTL || "7d", ...opts });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function persistRefreshToken({ userId, refreshToken, userAgent, ip }) {
  const decoded = verifyRefreshToken(refreshToken);
  const expiresAt = new Date(decoded.exp * 1000);
  const hashed = hashToken(refreshToken);
  await RefreshToken.create({
    user: userId,
    token: hashed,
    expiresAt,
    userAgent,
    ip,
  });
}

export async function rotateRefreshToken({ userId, oldToken, newToken }) {
  const hashedOld = hashToken(oldToken);
  const hashedNew = hashToken(newToken);
  const decodedNew = verifyRefreshToken(newToken);
  const expiresAt = new Date(decodedNew.exp * 1000);

  const doc = await RefreshToken.findOne({ user: userId, token: hashedOld, revokedAt: { $exists: false } });
  if (doc) {
    doc.revokedAt = new Date();
    doc.replacedByToken = hashedNew;
    await doc.save();
  }
  await RefreshToken.create({ user: userId, token: hashedNew, expiresAt });
}

export async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}

export async function isRefreshTokenValid(userId, token) {
  try {
    const hashed = hashToken(token);
    const record = await RefreshToken.findOne({ user: userId, token: hashed, revokedAt: { $exists: false } });
    if (!record) return false;
    verifyRefreshToken(token); // throws if expired/invalid
    return true;
  } catch {
    return false;
  }
}