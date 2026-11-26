import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Limit sharp to single thread to avoid memory/CPU thread starvation in sandboxed containers
sharp.concurrency(1);

// --- PATH & PIPELINE CONFIGURATION ---
const INPUT_DIR = path.resolve(process.cwd(), 'src/img');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/img');
const MANIFEST_PATH = path.resolve(process.cwd(), '.optimize-manifest.json');

const TARGET_WIDTHS = [640, 800, 1200];
const AVIF_QUALITY = 42;
const AVIF_EFFORT = 6;
const WEBP_QUALITY = 75;
const VALID_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff']);
const FORCE = process.argv.includes('--force');

// Optional aspect-ratio overrides (images not listed here use their natural ratio)
const ASPECT_RATIOS = {
  'tree-removal-services-macomb-county': 16 / 9,
  'emergency-storm-damage-cleanup': 16 / 9,
  'stump-grinding-and-root-removal': 16 / 9,

  // Gallery images - mixed aspect ratios for Masonry stagger
  'large-tree-removal-ira-township-mi': 3 / 4, // Portrait
  'lexington-mi-tree-removal': 1 / 1, // Square
  'commercial-tree-trimming-new-baltimore-mi': 2 / 3, // Tall Portrait
  'emergency-storm-damage-tree-removal-royal-oak-mi': 4 / 3, // Landscape
  'hollow-tree-removal-berlin-mi': 3 / 4, // Portrait
  'technical-tree-removal-shelby-twp-mi': 2 / 3, // Tall Portrait
  'professional-arborist-climbing-tree-removal-macomb-county': 4 / 5, // About section team photo
};

async function loadManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    return { exists: true, data: JSON.parse(raw) };
  } catch {
    return { exists: false, data: {} };
  }
}

async function allFilesExist(filenames) {
  for (const name of filenames) {
    try {
      await fs.access(path.join(OUTPUT_DIR, name));
    } catch {
      return false;
    }
  }
  return true;
}

async function resolveAspectRatio(filename, sourceBuffer) {
  if (ASPECT_RATIOS[filename]) {
    return ASPECT_RATIOS[filename];
  }

  const meta = await sharp(sourceBuffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Unable to read image dimensions for ${filename}`);
  }

  // Account for EXIF rotation orientations (5-8 swap width and height)
  const swapped = meta.orientation && meta.orientation >= 5 && meta.orientation <= 8;
  const width = swapped ? meta.height : meta.width;
  const height = swapped ? meta.width : meta.height;
  return width / height;
}

function computeHash(sourceBuffer, outputs) {
  return crypto
    .createHash('sha256')
    .update(sourceBuffer)
    .update(
      JSON.stringify({
        widths: TARGET_WIDTHS,
        avifQuality: AVIF_QUALITY,
        avifEffort: AVIF_EFFORT,
        webpQuality: WEBP_QUALITY,
        outputs,
      })
    )
    .digest('hex');
}

async function processImage(fileEntry, prevEntry, manifestExists) {
  const ext = path.extname(fileEntry.name);
  const filename = path.basename(fileEntry.name, ext);
  const inputPath = path.join(INPUT_DIR, fileEntry.name);

  const sourceBuffer = await fs.readFile(inputPath);
  const aspectRatio = await resolveAspectRatio(filename, sourceBuffer);

  const variants = TARGET_WIDTHS.map((width) => {
    const height = Math.round(width / aspectRatio);
    const baseOutputName = `${filename}-${width}w-${height}h`;
    return {
      width,
      height,
      baseOutputName,
      avifFile: `${baseOutputName}.avif`,
      webpFile: `${baseOutputName}.webp`,
    };
  });

  const expectedOutputs = variants.flatMap((v) => [v.avifFile, v.webpFile]);
  const hash = computeHash(sourceBuffer, expectedOutputs);
  const outputsExist = await allFilesExist(expectedOutputs);

  if (!FORCE && outputsExist && prevEntry?.hash === hash) {
    console.log(`  └─ ⏭️  Skipping (unchanged): ${filename}`);
    return { filename, entry: { hash, outputs: expectedOutputs } };
  }

  if (!FORCE && !manifestExists && outputsExist) {
    console.log(`  └─ 📌 Indexed existing outputs: ${filename}`);
    return { filename, entry: { hash, outputs: expectedOutputs } };
  }

  // Clean up stale dimension variants if aspect ratio changed for this source image
  if (prevEntry?.outputs) {
    const expectedSet = new Set(expectedOutputs);
    for (const staleFile of prevEntry.outputs) {
      if (!expectedSet.has(staleFile)) {
        await fs.rm(path.join(OUTPUT_DIR, staleFile), { force: true });
        console.log(`  └─ 🧹 Removed stale variant: ${staleFile}`);
      }
    }
  }

  const baseImage = sharp(sourceBuffer).rotate();

  const tasks = variants.flatMap(({ width, height, baseOutputName, avifFile, webpFile }) => [
    baseImage
      .clone()
      .resize({
        width,
        height,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      })
      .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT, chromaSubsampling: '4:2:0' })
      .toFile(path.join(OUTPUT_DIR, avifFile))
      .then(() => console.log(`  └─ ✅ AVIF generated: ${baseOutputName}`)),

    baseImage
      .clone()
      .resize({
        width,
        height,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, smartSubsample: true })
      .toFile(path.join(OUTPUT_DIR, webpFile))
      .then(() => console.log(`  └─ ✅ WebP generated: ${baseOutputName}`)),
  ]);

  await Promise.all(tasks);
  return { filename, entry: { hash, outputs: expectedOutputs } };
}

async function optimize() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(
      FORCE
        ? '🚀 Force-rebuilding all assets in src/img...\n'
        : '🚀 Scanning src/img for new or modified assets...\n'
    );

    const { exists: manifestExists, data: prevManifest } = await loadManifest();
    const entries = await fs.readdir(INPUT_DIR, { withFileTypes: true });
    const imageFiles = entries
      .filter((entry) => entry.isFile() && VALID_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));

    const results = [];
    for (const fileEntry of imageFiles) {
      const filename = path.basename(fileEntry.name, path.extname(fileEntry.name));
      const result = await processImage(fileEntry, prevManifest[filename], manifestExists);
      results.push(result);
    }

    const nextManifest = {};
    for (const { filename, entry } of results) {
      nextManifest[filename] = entry;
    }

    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
    console.log('\n✨ Optimization complete. Manifest saved to .optimize-manifest.json.');
  } catch (error) {
    console.error('❌ Pipeline failure:', error);
    process.exit(1);
  }
}

optimize();