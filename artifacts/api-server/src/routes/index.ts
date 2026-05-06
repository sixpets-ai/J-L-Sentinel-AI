import { Router, type IRouter } from "express";
import healthRouter from "./health";
import santiRouter from "./santi";
import geminiRouter from "./gemini";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/santi", santiRouter);
router.use("/gemini", geminiRouter);

export default router;
