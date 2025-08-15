import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    token: { type: String, required: true }, // store hashed token for security
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByToken: { type: String },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true }
);

// Optional TTL index cleanup (Mongo will auto-remove past documents)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RefreshToken", refreshTokenSchema);