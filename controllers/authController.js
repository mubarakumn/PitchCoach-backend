import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import sendEmail from "../utils/sendEmail.js"; // utility to send emails
import { emailSignupSchema, emailLoginSchema, googleSchema } from "../validators/authValidators.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

 // Utility to generate access & refresh tokens and store hashed refresh token
const generateTokens = async (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
  const refreshTokenValue = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  const hashedRefreshToken = await bcrypt.hash(refreshTokenValue, 10);

  await RefreshToken.create({
    token: hashedRefreshToken,
    user: userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshTokenValue };
};

function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const signupEmail = async (req, res) => {
  const parsed = emailSignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

  const { name, email, password } = parsed.data;
  if (await User.findOne({ email })) return res.status(409).json({ message: "Email already in use" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, authProvider: "email" });

  const { accessToken, refreshTokenValue } = await generateTokens(user._id);
  setRefreshCookie(res, refreshTokenValue);

  res.status(201).json({
    token: accessToken,
    user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, provider: user.authProvider },
  });
};

export const loginEmail = async (req, res) => {
  const parsed = emailLoginSchema.safeParse(req.body);
  
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user || user.authProvider !== "email") return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password || "");
  if (!ok) return res.status(401).json({ message: "Invalid credentials" }, ok);

  const { accessToken, refreshTokenValue } = await generateTokens(user._id);
  setRefreshCookie(res, refreshTokenValue);

  res.status(200).json({ token: accessToken, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, provider: user.authProvider } });
};

export const googleSignIn = async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

  const { token } = parsed.data;
  const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();

  let user = await User.findOne({ email: payload.email });
  if (!user) {
    user = await User.create({
      name: payload.name,
      email: payload.email,
      avatar: payload.picture,
      authProvider: "google",
    });
  }

  const { accessToken, refreshTokenValue } = await generateTokens(user._id);
  setRefreshCookie(res, refreshTokenValue);

  res.json({ token: accessToken, user });
};

export const refreshAccessToken = async (req, res) => {
  const refreshTokenFromCookie = req.cookies.refreshToken;
  if (!refreshTokenFromCookie) return res.status(401).json({ message: "No refresh token provided" });

  const decoded = jwt.verify(refreshTokenFromCookie, process.env.JWT_REFRESH_SECRET);
  const storedToken = await RefreshToken.findOne({ user: decoded.id }).sort({ createdAt: -1 });
  if (!storedToken) return res.status(401).json({ message: "Refresh token not found" });

  const isMatch = await bcrypt.compare(refreshTokenFromCookie, storedToken.token);
  if (!isMatch) return res.status(403).json({ message: "Invalid refresh token" });

  const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
  res.json({ accessToken });
};

export const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

export const logout = async (req, res) => {
  const refreshTokenFromCookie = req.cookies.refreshToken;
  if (refreshTokenFromCookie) {
    await RefreshToken.deleteOne({ token: refreshTokenFromCookie });
    res.clearCookie("refreshToken");
  }
  res.json({ message: "Logged out successfully" });
};

// Forgot Password
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "No user found with that email" });

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 min
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_ORIGIN}/reset-password/${resetToken}`;
  await sendEmail(user.email, "Password Reset", `Reset your password: ${resetUrl}`);

  res.json({ message: "Password reset link sent" });
};

// Reset Password
export const resetPassword = async (req, res) => {
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: Date.now() } });
  if (!user) return res.status(400).json({ message: "Invalid or expired token" });

  const { password } = req.body;
  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({ message: "Password reset successful" });
};