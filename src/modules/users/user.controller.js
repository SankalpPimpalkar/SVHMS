import { UserService } from "./user.service.js";
import { NODE_ENV } from "../../configs/env.config.js";
import { dbconnect } from "../../configs/db.config.js";

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: NODE_ENV === 'prod',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000
};

export class AuthController {
    static async register(req, res, next) {
        await dbconnect()
        try {
            const { name, email, password } = req.body;
            const result = await UserService.register(name, email, password);

            res.cookie('token', result.token, COOKIE_OPTIONS);

            return res
                .status(200)
                .json({ user: result.user });
        } catch (error) {
            next(error);
        }
    }

    static async login(req, res, next) {
        await dbconnect()
        try {
            const { email, password } = req.body;
            const { token, user } = await UserService.login(email, password);

            res.cookie('token', token, COOKIE_OPTIONS);

            return res
                .status(200)
                .json({ user, token });
        } catch (error) {
            next(error);
        }
    }

    static logout(req, res) {
        res.clearCookie('token');
        return res
            .status(200)
            .json({ message: 'Logged out successfully' });
    }

    static async getMe(req, res, next) {
        await dbconnect()
        try {
            const userId = req.user;
            const user = await UserService.getById(userId);
            return res
                .status(200)
                .json({ user });
        } catch (error) {
            next(error);
        }
    }
}
