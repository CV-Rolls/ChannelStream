import { Router, type IRouter } from "express";
import healthRouter from "./health";
import channelsRouter from "./channels";
import proxyRouter from "./proxy";
import epgRouter from "./epg";

const router: IRouter = Router();

router.use(healthRouter);
router.use(channelsRouter);
router.use(proxyRouter);
router.use(epgRouter);

export default router;
