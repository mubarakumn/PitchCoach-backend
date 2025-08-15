// src/routes/authRoutes.js
import express from "express";
import {
  signupEmail,
  loginEmail,
  googleSignIn,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

// Email
router.post("/signup", signupEmail);
router.post("/login", loginEmail);

// Google
router.post("/google", googleSignIn);

// Token refresh & logout
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);

// Password reset
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);

export default router;
