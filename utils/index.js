//libraries
import path from "path";
import sharp from "sharp";
import pixelmatch from "pixelmatch";

//constants
import {getMeta} from '../api/getMeta.js'
import {
  OPTIMISED_SIZE,
  PIXELMATCH_THRESHOLD,
  SLICE_LIMIT,
} from "../constants.js";
const metadata = getMeta();

const getFilePath = (image) => {
  const filename =
    image.name[0].toLowerCase() +
    (image.name.endsWith("Clr")
      ? image.name.replace("Clr", "_clr").slice(1)
      : image.name.slice(1)) +
    ".svg";

  return path.join(
    process.cwd(),
    "data",
    image.category,
    filename
  );
};

export async function convertImageToData(image) {
  try {
    const { data } = await sharp(image)
      .resize(OPTIMISED_SIZE, OPTIMISED_SIZE, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return data;
  } catch (error) {
    console.error(`Error converting ${image} to raw object:`, error);
  }
}

export async function filterIcons(baseData, FILTER_LIMIT) {
  const promises = metadata.map(async (image) => {
    const imagePath = getFilePath(image);
    const imageData = await convertImageToData(imagePath);

    const totalPixels = OPTIMISED_SIZE * OPTIMISED_SIZE;
    const differentPixels = pixelmatch(
      baseData,
      imageData,
      null,
      OPTIMISED_SIZE,
      OPTIMISED_SIZE,
      {
        threshold: PIXELMATCH_THRESHOLD,
        includeAA: false,
      }
    );
    const mismatchRatio = differentPixels / totalPixels;
    return {
      fullName: image.fullName,
      mismatch: mismatchRatio,
      isExactMatch: mismatchRatio === 0,
    };
  });

  const res = await Promise.all(promises);

  return res
    .filter((image) => image.mismatch < FILTER_LIMIT)
    .sort((a, b) => a.mismatch - b.mismatch)
    .slice(0, SLICE_LIMIT)
    .map((image) => ({
      fullName: image.fullName,
      isExactMatch: image.isExactMatch,
    })); // we needn't send back the actual mismatch
}
