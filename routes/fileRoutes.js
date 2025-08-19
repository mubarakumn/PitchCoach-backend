// routes/files.js
import express from "express";
import { protect } from "../middlewares/auth.js";
import { uploadToken, createFiles, listFiles, getOneFile, deleteFile } from "../controllers/fileController.js"
 
const router = express.Router();

/** 1) Signed upload token */
router.get("/uploadToken", protect, uploadToken);

/** 2) Create file Record */
router.post("/files", protect, createFiles);

/** 3) List files with pagination not tested */
router.get("/files", protect, listFiles);

/** 4) Get one */
router.get("/files/:id", protect, getOneFile);

/** 5) Delete: Cloudinary + DB not tested*/
router.delete("/files/:id", protect, deleteFile);

export default router;
