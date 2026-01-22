import { Router } from "express";
import authenticate from "../../shared/middlewares/authenticate.js";
import { VehicleController } from "./vehicle.controller.js";
import obdRouter from "../obd/obd.routes.js";
import diagnosticRouter from "../diagnostics/diagnostic.routes.js";

const vehicleRouter = Router();

vehicleRouter.post('/', authenticate, VehicleController.createVehicle);
vehicleRouter.get('/', authenticate, VehicleController.getVehicles);
vehicleRouter.get('/:vehicleId', authenticate, VehicleController.getVehicleById);
vehicleRouter.put('/:vehicleId', authenticate, VehicleController.updateVehicle);
vehicleRouter.delete('/:vehicleId', authenticate, VehicleController.deleteVehicle);

vehicleRouter.use('/:vehicleId/obd', authenticate, obdRouter)
vehicleRouter.use('/:vehicleId/diagnostics', authenticate, diagnosticRouter)

export default vehicleRouter;
