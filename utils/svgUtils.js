//utils
import { convertImageToData, filterIcons } from "./index.js";

//constants
import { SVG_FILTER_LIMIT } from "../constants.js";

export async function handleSVG(req, res) {
  const { userInput } = req.body;
  try {
    const t1 = Date.now();
    const baseSVGBuffer = Buffer.from(userInput);
    const baseSVGData = await convertImageToData(baseSVGBuffer);
    const sortedRes = await filterIcons(baseSVGData, SVG_FILTER_LIMIT);
    const t2 = Date.now();
    res.status(200).json({ sortedRes, time: t2 - t1 });
  } catch (error) {
    console.error(`Error with API call: `, error);
    res.status(500).json({
      message: "An error occurred while processing your request.",
      error: error.message,
    });
  }
}