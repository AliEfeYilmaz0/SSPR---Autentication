import { Router } from "express";
import { ssprController } from "../controllers/ssprController";

const router = Router();

router.post("/request", ssprController.requestReset);
router.get("/status/:resetRequestId", ssprController.getStatus);
router.post("/otp/verify", ssprController.verifyOtp);
router.post("/otp/resend", ssprController.resendOtp);
router.post("/reset/validate", ssprController.validateResetToken);
router.post("/reset-password", ssprController.resetPassword);

export default router;
