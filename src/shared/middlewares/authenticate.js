import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors/types.js";
import { JWT_SECRET } from "../../configs/env.config.js";

export default async function authenticate(req, res, next) {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }
    }

    if (!token) {
        return next(new UnauthorizedError("Token not found"));
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload.sub
        next();
    } catch (error) {
        return next(new UnauthorizedError("Invalid or expired token"));
    }
}
