import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { notFound, errorHandler } from "./middlewares/error.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();

// Middlewares
const allowedOrigins = [
  "http://localhost:8080", 
  "http://localhost:5000",
  "https://pitchcoach.vercel.app",
  ];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Routes
app.use("/api/auth", authRoutes);

// Error handling 
app.use(notFound);
app.use(errorHandler);

export default app;