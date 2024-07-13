//libraries
import sharp from "sharp";

//utils
import { convertImageToData, filterIcons } from "./index.js";

//constants
import {
  PNG_FILTER_LIMIT,
  COLOUR_DIFF_THRESHOLD,
  OPTIMISED_SIZE,
} from "../constants.js";

export async function handlePNG(req, res) {
  const { userInput } = req.body;
  try {
    let t1 = Date.now();
    const basePNGBuffer = getBufferFromPNG(userInput);
    const basePNGData = await processImage(basePNGBuffer);
    let sortedRes = await filterIcons(basePNGData, PNG_FILTER_LIMIT);
    let t2 = Date.now();
    res.status(200).json({ sortedRes, time: t2 - t1 });
  } catch (error) {
    console.error(`Error with API call: `, error);
    res.status(500).json({
      message: "An error occurred while processing your request.",
      error: error.message,
    });
  }
}

function getBufferFromPNG(file) {
  const base64Data = file.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

async function boundingBox(image) {
  const { data, info } = await sharp(image)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  const black = Buffer.from([0x0f, 0x0f, 0x0f, 0xff]);
  const lightBlack = Buffer.from([0x0a, 0x0a, 0x14, 0xff]); //spaceweb darkmode black
  const white = Buffer.from([0xf5, 0xf5, 0xf5, 0xff]);

  const backgroundColour = data.subarray(0, channels); //assume top-left pixel is the background
  let x1 = width,
    y1 = height,
    x2 = 0,
    y2 = 0;
  let modifiedData = Buffer.alloc(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      const pixel = data.subarray(offset, offset + channels);
      
      //if my current pixel is not part of the background, the bounding box needs to be tightened
      if (!equalPixels(pixel, backgroundColour, channels)) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;

        //if background colour is black (i.e. darkmode screenshot) 
        if (
          equalPixels(black, backgroundColour, channels) &&
          equalPixels(pixel, white, channels)
        ) {
          for (let c = 0; c < channels; c++) {
            modifiedData[offset + c] = lightBlack[c];
          }
        } else {
          data.copy(modifiedData, offset, offset, offset + channels);
        }
      } else {
        for (let c = 0; c < channels; c++) {
          modifiedData[offset + c] = 0xff;
        }
      }
    }
  }

  return {
    x1,
    y1,
    x2,
    y2,
    image_width: width,
    image_height: height,
    channels,
    data: modifiedData,
  };
}

function equalPixels(pixel1, pixel2, channels) {
  for (let c = 0; c < channels - 1; c++) {
    if (Math.abs(pixel1[c] - pixel2[c]) >= COLOUR_DIFF_THRESHOLD) {
      return false;
    }
  }
  return true;
}

async function processImage(image) {
  const bbox = await boundingBox(image);

  if (!bbox) {
    console.log("error");
    return;
  }

  let { x1, y1, x2, y2, image_width, image_height, channels, data } = bbox;

  if (x1 > x2 || y1 > y2) {
    return convertImageToData(image);
  }
  
  let width = x2 - x1;
  let height = y2 - y1;
  const diff = Math.abs(width - height);
  const backgroundRemovedBuffer = await sharp(data, {
    raw: {
      width: image_width,
      height: image_height,
      channels,
    },
  })
    .png()
    .toBuffer();

  const extractedBuffer = await sharp(backgroundRemovedBuffer)
    .extract({
      left: x1,
      top: y1,
      width: width,
      height: height,
    })
    .extend({
      top: height < width ? Math.round(diff / 2) : 0,
      bottom: height < width ? Math.round(diff / 2) : 0,
      left: height > width ? Math.round(diff / 2) : 0,
      right: height > width ? Math.round(diff / 2) : 0,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .toBuffer();

  const { data: retData } = await sharp(extractedBuffer)
    .resize(OPTIMISED_SIZE, OPTIMISED_SIZE, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return retData;
}
