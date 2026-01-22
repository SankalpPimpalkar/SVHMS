import express from "express"
import morgan from "morgan";

import { errorHandler } from "./shared/errors/handler.js";
import userRouter from "./modules/users/user.route.js";
import vehicleRouter from "./modules/vehicles/vehicle.route.js";
import "./modules/diagnostics/diagnostic.listeners.js"
import cookieParser from "cookie-parser";
import cors from "cors"

const app = express()

// middlewares
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
app.use(cookieParser())

app.get('/', (req, res) => {
    return res.send('SVHMS backend is runnning')
})

app.use('/api/v1/users', userRouter)
app.use('/api/v1/vehicles', vehicleRouter)

app.use(errorHandler);

export default app;