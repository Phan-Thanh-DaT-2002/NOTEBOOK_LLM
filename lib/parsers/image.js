import path from 'path';
import fs from 'fs';
import { createWorker } from 'tesseract.js';
import { Jimp } from 'jimp';
import { v4 as uuidv4 } from 'uuid';
import { generateVisionDescription } from '../providers/vision.js';

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    default: return 'image/png';
  }
}

/**
 * Parses an image by combining OCR text extraction and AI Vision description.
 * @param {string} filePath - Path to the image file
 * @param {object} settings - Active LLM provider settings
 * @returns {Promise<{ text: string }>}
 */
export async function parseImage(filePath, settings) {
  let ocrText = '';
  let visionDescription = '';
  const mimeType = getMimeType(filePath);

  console.log(`[Image Parser] Parsing image: ${filePath} (${mimeType})`);

  let ocrInputPath = filePath;
  let tempFilePath = null;

  // 1. Preprocess the image using Jimp (Grayscale, Invert if dark, scale up 2x)
  try {
    console.log('[Image Parser] Preprocessing image with Jimp...');
    const image = await Jimp.read(filePath);

    // Calculate average brightness
    const data = image.bitmap.data;
    const len = data.length;
    let totalBrightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < len; i += 4) {
      const r = data[i + 0];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      pixelCount++;
    }

    const avgBrightness = totalBrightness / pixelCount;
    console.log(`[Image Parser] Average brightness: ${avgBrightness.toFixed(2)}`);

    let modified = false;

    // Invert if it is dark mode
    if (avgBrightness < 125) {
      console.log('[Image Parser] Dark mode image detected. Inverting colors for OCR...');
      image.invert();
      modified = true;
    }

    // Convert to grayscale and increase contrast
    image.greyscale().contrast(0.2);
    modified = true;

    // Scale up 2x if the image is small (useful for screenshots)
    if (image.bitmap.width < 2000) {
      console.log('[Image Parser] Resizing image 2x for better OCR readability...');
      image.scale(2);
      modified = true;
    }

    if (modified) {
      const tempDir = path.join(process.cwd(), 'data', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      tempFilePath = path.join(tempDir, `temp_ocr_${uuidv4()}.png`);
      await image.write(tempFilePath);
      ocrInputPath = tempFilePath;
      console.log(`[Image Parser] Preprocessed image saved to: ${tempFilePath}`);
    }
  } catch (jimpErr) {
    console.error('[Image Parser] Jimp preprocessing failed, falling back to raw image:', jimpErr.message);
  }

  // 2. Run local OCR using Tesseract.js (Vietnamese + English) with local models
  try {
    console.log('[Image Parser] Initializing Tesseract.js worker with local traineddata...');
    const worker = await createWorker('eng+vie', 1, {
      langPath: process.cwd(),
      gzip: false,
      cacheMethod: 'none',
    });
    
    console.log('[Image Parser] Performing OCR on:', ocrInputPath);
    const { data } = await worker.recognize(ocrInputPath);
    ocrText = data.text || '';
    
    console.log('[Image Parser] OCR complete. Characters read:', ocrText.length);
    await worker.terminate();
  } catch (err) {
    console.error('[Image Parser] OCR failed:', err.message);
  }

  // Clean up temporary preprocessed file if created
  if (tempFilePath && fs.existsSync(tempFilePath)) {
    try {
      fs.unlinkSync(tempFilePath);
      console.log('[Image Parser] Temporary preprocessed image deleted.');
    } catch (cleanupErr) {
      console.warn('[Image Parser] Failed to delete temporary image:', cleanupErr.message);
    }
  }

  // 3. Run Multimodal Vision description using active LLM settings
  try {
    console.log('[Image Parser] Generating AI Vision description...');
    const description = await generateVisionDescription(filePath, mimeType, settings);
    visionDescription = description || '';
    console.log('[Image Parser] AI Vision description complete. Length:', visionDescription.length);
  } catch (err) {
    console.warn('[Image Parser] AI Vision description skipped/failed:', err.message);
  }

  // 4. Combine results
  let combinedText = '';
  
  if (ocrText.trim()) {
    combinedText += `[Nội dung văn bản nhận diện bằng OCR]:\n${ocrText.trim()}\n\n`;
  }
  
  if (visionDescription.trim()) {
    combinedText += `[Mô tả chi tiết hình ảnh bằng AI]:\n${visionDescription.trim()}`;
  }

  if (!combinedText.trim()) {
    combinedText = '[Hình ảnh rỗng hoặc không thể nhận diện được nội dung chữ/hình ảnh.]';
  }

  return { text: combinedText };
}
