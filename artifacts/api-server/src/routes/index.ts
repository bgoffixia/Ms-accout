import { Router } from "express";
import healthRouter from "./health.js";
import enrollmentRouter from "./enrollment.js";

const router = Router();

router.use(healthRouter);
router.use(enrollmentRouter);

export default router;
