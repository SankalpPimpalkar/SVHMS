import { OBDController } from "./obd.controller.js";
import { Router } from "express";

const obdRouter = Router({ mergeParams: true })

obdRouter.post('/', OBDController.createBulk)
obdRouter.get('/', OBDController.getRecords)
obdRouter.delete('/', OBDController.deleteOld)

export default obdRouter