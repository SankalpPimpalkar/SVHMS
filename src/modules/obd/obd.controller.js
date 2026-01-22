import { BadRequestError } from "../../shared/errors/types.js";
import { OBDService } from "./obd.service.js";

export class OBDController {
    static async createBulk(req, res, next) {
        try {
            const userId = req.user;
            const { vehicleId } = req.params;
            const obdRecords = req.body;

            const result = await OBDService.createOBDRecordsBulk(
                userId,
                vehicleId,
                obdRecords
            );

            return res.status(201).json({
                success: true,
                message: "OBD records ingested",
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    static async getRecords(req, res, next) {
        try {
            const userId = req.user;
            const { vehicleId } = req.params;

            const options = {
                startDate: req.query.startDate
                    ? new Date(req.query.startDate)
                    : undefined,
                endDate: req.query.endDate
                    ? new Date(req.query.endDate)
                    : undefined,
                limit: req.query.limit
                    ? Number(req.query.limit)
                    : undefined
            };

            const records = await OBDService.getOBDRecords(
                userId,
                vehicleId,
                options
            );

            return res.status(200).json({
                success: true,
                count: records.length,
                data: records
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteOld(req, res, next) {
        try {
            const { beforeDate } = req.body;

            if (!beforeDate || typeof beforeDate !== "string") {
                throw new BadRequestError("beforeDate must be a string");
            }

            let parsedDate;

            if (/^\d+d$/.test(beforeDate)) {
                const days = Number(beforeDate.replace("d", ""));

                if (days <= 0 || days > 365) {
                    throw new BadRequestError("Days must be between 1 and 365");
                }

                parsedDate = new Date(Date.now() - days * 86400000);
            }
            else {
                parsedDate = new Date(beforeDate);

                if (isNaN(parsedDate.getTime())) {
                    throw new BadRequestError("Invalid date format");
                }
            }

            const result = await OBDService.deleteOldRecords(parsedDate);

            return res.status(200).json({
                success: true,
                cutoffDate: parsedDate,
                deletedCount: result.deletedCount
            });
        } catch (error) {
            next(error);
        }
    }
}
