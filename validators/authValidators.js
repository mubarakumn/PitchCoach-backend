import { z } from "zod";

export const emailSignupSchema = z.object({
  name: z.string().min(2).max(80), // 
  email: z.string().email(), 
  password: z.string().min(8).max(128), //not to be less than 8 characters and not more than 128 characters
});

export const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const googleSchema = z.object({
  token: z.string().min(10), // Google ID token
});