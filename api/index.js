//libraries
import express from "express";
import cors from "cors";

//utils
import { handleSVG } from "../utils/svgUtils.js";
import { handlePNG } from "../utils/pngUtils.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.post("/getFilteredIconsFromSVG", handleSVG);
app.post("/getFilteredIconsFromPNG", handlePNG);

(async () => {
  app.listen(3005, () => console.log("Server ready on port 3005."));
})();

export default app;