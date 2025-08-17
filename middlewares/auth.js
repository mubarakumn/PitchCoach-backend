import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    // 1️⃣ Read access token from HttpOnly cookie
    const token = req.cookies?.accessToken;
    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // 3️⃣ Attach user to req
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
