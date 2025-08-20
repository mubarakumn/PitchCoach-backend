// routes/fileRoutes.js
import express from "express";
import { protect } from "../middlewares/auth.js";
import { 
  uploadToken, 
  createFiles, 
  listFiles, 
  getOneFile, 
  deleteFile 
} from "../controllers/fileController.js";
import { 
  getFileTranscription, 
  getFileFeedback 
} from "../controllers/transcriptionController.js";

const router = express.Router();

/** 1) Signed upload token */
router.get("/uploadToken", protect, uploadToken);

/** 2) Create file Record */
router.post("/files", protect, createFiles);

/** 3) List files */
router.get("/files", protect, listFiles);

/** 4) Get one file */
router.get("/files/:id", protect, getOneFile);

/** 5) Delete file */
router.delete("/files/:id", protect, deleteFile);

/** 6) Get transcription for a file */
router.get("/files/:id/transcription", protect, getFileTranscription);

/** 7) Get AI feedback for a file (based on its transcription) */
router.get("/files/:id/feedback", protect, getFileFeedback);

export default router;
