import { Router } from "express";
import { authenticatorController } from "../controllers/authenticatorController";

const router = Router();

router.get("/pending", authenticatorController.getPending);
router.post("/approve", authenticatorController.approve);
router.post("/deny", authenticatorController.deny);

export default router;
