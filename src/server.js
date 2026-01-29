import app from "./app.js";
import { PORT } from "./configs/env.config.js";

app.listen(PORT, () => {
    console.log("🚗 OBD AI backend running on port", PORT)
})