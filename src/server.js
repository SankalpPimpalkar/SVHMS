import app from "./app.js";
import { dbconnect } from "./configs/db.config.js";
import { PORT } from "./configs/env.config.js";

dbconnect().then(() => {
    app.listen(PORT, () => {
        console.log("🚗 OBD AI backend running on port", PORT)
    })
}).catch((err) => {
    console.log("❌ Failed to start server", err)
    process.exit(1)
})