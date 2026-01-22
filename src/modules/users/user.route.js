import authenticate from "../../shared/middlewares/authenticate.js";
import { AuthController } from "./user.controller.js";
import { Router } from "express";

const userRouter = Router()

userRouter.post('/register', AuthController.register)
userRouter.post('/login', AuthController.login)
userRouter.delete('/logout', authenticate, AuthController.logout)
userRouter.get('/', authenticate, AuthController.getMe)

export default userRouter;