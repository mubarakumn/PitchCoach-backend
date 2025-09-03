import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 8, select: false },
    avatar: { type: String },
    authProvider: { type: [String], enum: ["email", "google"], default: ["email"] },

    Role: { 
      type: String, 
      enum: ["user", "admin"], 
      default: "user" 
    },

    // Organization role (business/job position)
    orgRole: { type: String, trim: true },   // e.g. "Software Engineer", "Marketing Lead"
    company: { type: String, trim: true },

    // Preferences
    preferences: {
      theme: { type: String, enum: ["dark", "light", "system"], default: "dark" },
      language: { type: String, enum: ["en", "es", "fr", "de"], default: "en" },
      notifications: { type: Boolean, default: true },
      emailUpdates: { type: Boolean, default: true },
    },

    // Password reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

// Strip sensitive fields from JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  return obj;
};

export default mongoose.model("User", userSchema);
