import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import UserModel from "./user.model.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../shared/errors/types.js";
import { JWT_SECRET } from "../../configs/env.config.js";

export class UserService {
    static #issueToken(user) {
        const PAYLOAD = {
            sub: user._id,
            email: user.email
        };
        const token = jwt.sign(PAYLOAD, JWT_SECRET, { expiresIn: '30d' });

        return {
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            }
        };
    }

    static async register(name, email, password) {
        const existingUser = await UserModel.findOne({ email });

        if (existingUser) {
            throw new BadRequestError('Email is already in use');
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await UserModel.create({
            name,
            email,
            passwordHash,
            auth_provider: 'local'
        });

        return this.#issueToken(newUser);
    }

    static async login(email, password) {
        const user = await UserModel.findOne({ email });

        if (!user) {
            throw new NotFoundError('User does not exist with this email');
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
            throw new UnauthorizedError('Invalid credentials');
        }

        return this.#issueToken(user);
    }

    static async logout() {
        return { message: 'Logout successful. Delete token on client.' };
    }

    static async getById(id) {
        const user = await UserModel.findById(id).lean().select("-passwordHash");

        if (!user) {
            throw new NotFoundError('User not found');
        }

        return user;
    }
}
