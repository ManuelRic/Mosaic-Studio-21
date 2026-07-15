"use strict";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_CANVAS_EDGE = 3600;
const VALID_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const elements = {
  heroUploadButton: document.querySelector("#heroUploadButton"),
  heroTextButton: document.querySelector("#heroTextButton"),
  fileInput: document.querySelector("#imageUpload"),
  sourceModeInputs: [...document.querySelectorAll('input[name="sourceMode"]')],
  sourceHeading: document.querySelector("#sourceHeading"),
  sourceHeadingMeta: document.querySelector("#sourceHeadingMeta"),
  imageSourcePanel: document.querySelector("#imageSourcePanel"),
  textSourcePanel: document.querySelector("#textSourcePanel"),
  textSource: document.querySelector("#textSource"),
  textCount: document.querySelector("#textCount"),
  dropZone: document.querySelector("#dropZone"),
  dropEmpty: document.querySelector("#dropEmpty"),
  dropPreview: document.querySelector("#dropPreview"),
  uploadThumbnail: document.querySelector("#uploadThumbnail"),
  fileName: document.querySelector("#fileName"),
  fileDetails: document.querySelector("#fileDetails"),
  uploadError: document.querySelector("#uploadError"),
  budgetRange: document.querySelector("#dominoBudget"),
  budgetNumber: document.querySelector("#budgetNumber"),
  cropMode: document.querySelector("#cropMode"),
  gapSize: document.querySelector("#gapSize"),
  contrast: document.querySelector("#contrast"),
  contrastValue: document.querySelector("#contrastValue"),
  ditherToggle: document.querySelector("#ditherToggle"),
  invertToggle: document.querySelector("#invertToggle"),
  generateButton: document.querySelector("#generateButton"),
  resetButton: document.querySelector("#resetButton"),
  downloadButton: document.querySelector("#downloadButton"),
  resultStatusDot: document.querySelector("#resultStatusDot"),
  resultState: document.querySelector("#resultState"),
  previewStage: document.querySelector("#previewStage"),
  previewEmpty: document.querySelector("#previewEmpty"),
  previewPanes: document.querySelector("#previewPanes"),
  sourcePreview: document.querySelector("#sourcePreview"),
  canvas: document.querySelector("#mosaicCanvas"),
  viewButtons: [...document.querySelectorAll(".view-switcher button[data-view]")],
  horizontalRuler: document.querySelector("#horizontalRuler span"),
  verticalRuler: document.querySelector("#verticalRuler span"),
  usedStat: document.querySelector("#usedStat"),
  budgetStat: document.querySelector("#budgetStat"),
  acrossStat: document.querySelector("#acrossStat"),
  downStat: document.querySelector("#downStat"),
  footprintStat: document.querySelector("#footprintStat"),
  buildFormula: document.querySelector("#buildFormula"),
  inventoryPanel: document.querySelector("#inventoryPanel"),
  inventorySummary: document.querySelector("#inventorySummary"),
  inventoryNote: document.querySelector("#inventoryNote"),
  inventoryGrid: document.querySelector("#inventoryGrid"),
  liveStatus: document.querySelector("#liveStatus"),
};

const state = {
  sourceMode: "image",
  image: null,
  imageUrl: "",
  file: null,
  loadToken: 0,
  scrollAfterUpload: false,
  textTimer: null,
  renderTimer: null,
  renderToken: 0,
  result: null,
};

const PIP_POSITIONS = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.23], [0.73, 0.23], [0.27, 0.5], [0.73, 0.5], [0.27, 0.77], [0.73, 0.77]],
};

initialize();

function initialize() {
  renderToneScale();
  updateRangeProgress(elements.budgetRange);
  updateRangeProgress(elements.contrast);
  setSourceMode("image", { focus: false });
  bindEvents();
  bindHeroArtParallax();
}

function bindHeroArtParallax() {
  const heroArt = document.querySelector(".hero-art");
  if (!heroArt) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pieces = [
    { element: heroArt.querySelector(".domino-a"), move: 8, tilt: 3.5, lift: 15 },
    { element: heroArt.querySelector(".domino-b"), move: 14, tilt: 5.5, lift: 27 },
    { element: heroArt.querySelector(".domino-c"), move: 10, tilt: 4.3, lift: 19 },
  ].filter((piece) => piece.element);
  let animationFrame = 0;
  let previousTime = 0;
  let latestPointer = null;
  const motion = {
    x: 0,
    y: 0,
    depth: 0,
    targetX: 0,
    targetY: 0,
    targetDepth: 0,
  };

  const paint = (x, y, depth) => {
    pieces.forEach(({ element, move, tilt, lift }) => {
      element.style.setProperty("--move-x", `${(x * move).toFixed(2)}px`);
      element.style.setProperty("--move-y", `${(y * move * 0.72).toFixed(2)}px`);
      element.style.setProperty("--hover-scale", `${(1 + (lift / 900) * depth).toFixed(5)}`);
      element.style.setProperty("--hover-rotation", `${((x - y * 0.35) * tilt * 0.25).toFixed(2)}deg`);
    });
  };

  const animate = (time) => {
    animationFrame = 0;
    if (reduceMotion.matches) return;

    if (latestPointer) {
      const bounds = heroArt.getBoundingClientRect();
      motion.targetX = clamp(((latestPointer.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
      motion.targetY = clamp(((latestPointer.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
      latestPointer = null;
    }

    const elapsed = previousTime ? Math.min(time - previousTime, 64) : 16;
    const response = motion.targetDepth ? 38 : 105;
    const blend = 1 - Math.exp(-elapsed / response);
    previousTime = time;

    motion.x += (motion.targetX - motion.x) * blend;
    motion.y += (motion.targetY - motion.y) * blend;
    motion.depth += (motion.targetDepth - motion.depth) * blend;

    const isSettled =
      Math.abs(motion.targetX - motion.x) < 0.0005 &&
      Math.abs(motion.targetY - motion.y) < 0.0005 &&
      Math.abs(motion.targetDepth - motion.depth) < 0.0005;

    if (isSettled) {
      motion.x = motion.targetX;
      motion.y = motion.targetY;
      motion.depth = motion.targetDepth;
      previousTime = 0;
    }

    paint(motion.x, motion.y, motion.depth);
    if (!isSettled) animationFrame = requestAnimationFrame(animate);
  };

  const requestPaint = () => {
    if (!animationFrame) animationFrame = requestAnimationFrame(animate);
  };

  const resetMotion = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    previousTime = 0;
    latestPointer = null;
    motion.x = 0;
    motion.y = 0;
    motion.depth = 0;
    motion.targetX = 0;
    motion.targetY = 0;
    motion.targetDepth = 0;
    paint(0, 0, 0);
  };

  heroArt.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || reduceMotion.matches) return;

    latestPointer = { clientX: event.clientX, clientY: event.clientY };
    motion.targetDepth = 1;
    requestPaint();
  });

  heroArt.addEventListener("pointerleave", () => {
    latestPointer = null;
    motion.targetX = 0;
    motion.targetY = 0;
    motion.targetDepth = 0;
    requestPaint();
  });

  reduceMotion.addEventListener("change", resetMotion);
}

function bindEvents() {
  elements.heroUploadButton.addEventListener("click", () => {
    if (state.sourceMode !== "image") setSourceMode("image", { focus: false });
    state.scrollAfterUpload = true;
    elements.fileInput.click();
  });

  elements.heroTextButton.addEventListener("click", () => {
    setSourceMode("text", { focus: false });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector("#studio").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => elements.textSource.focus(), reduceMotion ? 0 : 450);
  });

  elements.sourceModeInputs.forEach((input) => {
    input.addEventListener("change", () => setSourceMode(input.value));
  });

  elements.textSource.addEventListener("input", () => {
    const text = elements.textSource.value;
    elements.textCount.textContent = `${text.length} / 60`;
    if (state.sourceMode !== "text") return;

    window.clearTimeout(state.textTimer);
    if (!text.trim()) {
      resetImage({ focus: false, clearText: false, announce: false });
      return;
    }

    elements.generateButton.disabled = true;
    elements.downloadButton.disabled = true;
    elements.resetButton.disabled = false;
    setResultStatus("working", "Typesetting text…");
    state.textTimer = window.setTimeout(() => loadTextSource(text), 280);
  });

  elements.fileInput.addEventListener("cancel", () => {
    state.scrollAfterUpload = false;
  });

  elements.dropZone.addEventListener("pointerdown", () => {
    state.scrollAfterUpload = false;
  });

  elements.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) loadFile(file);
  });

  elements.fileInput.addEventListener("click", () => {
    elements.fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      elements.dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, () => {
      elements.dropZone.classList.remove("drag-over");
    });
  });

  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    state.scrollAfterUpload = false;
    elements.dropZone.classList.remove("drag-over");
    const [file] = event.dataTransfer?.files || [];
    if (file) loadFile(file);
  });

  elements.budgetRange.addEventListener("input", () => {
    elements.budgetNumber.value = elements.budgetRange.value;
    updateRangeProgress(elements.budgetRange);
    scheduleRender();
  });

  elements.budgetNumber.addEventListener("input", () => {
    const value = Number(elements.budgetNumber.value);
    const min = Number(elements.budgetRange.min);
    const max = Number(elements.budgetRange.max);
    if (Number.isFinite(value) && value >= min && value <= max) {
      elements.budgetRange.value = String(value);
      updateRangeProgress(elements.budgetRange);
      scheduleRender();
    }
  });

  elements.budgetNumber.addEventListener("change", () => {
    const value = clamp(
      Number(elements.budgetNumber.value) || Number(elements.budgetRange.value),
      Number(elements.budgetRange.min),
      Number(elements.budgetRange.max),
    );
    const stepped = Math.round(value / 10) * 10;
    elements.budgetNumber.value = String(stepped);
    elements.budgetRange.value = String(stepped);
    updateRangeProgress(elements.budgetRange);
    scheduleRender();
  });

  elements.contrast.addEventListener("input", () => {
    elements.contrastValue.value = `${elements.contrast.value}%`;
    elements.contrastValue.textContent = `${elements.contrast.value}%`;
    updateRangeProgress(elements.contrast);
    scheduleRender();
  });

  document.querySelectorAll('input[name="orientation"], input[name="palette"]').forEach((input) => {
    input.addEventListener("change", scheduleRender);
  });

  [elements.cropMode, elements.gapSize, elements.ditherToggle, elements.invertToggle].forEach((input) => {
    input.addEventListener("change", scheduleRender);
  });

  elements.generateButton.addEventListener("click", () => generateMosaic(true));
  elements.resetButton.addEventListener("click", () => resetImage());
  elements.downloadButton.addEventListener("click", downloadMosaic);

  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

async function loadFile(file) {
  const loadToken = ++state.loadToken;
  hideUploadError();

  const hasSupportedExtension = /\.(?:jpe?g|png|webp)$/i.test(file.name);
  if (!VALID_IMAGE_TYPES.has(file.type) && !(file.type === "" && hasSupportedExtension)) {
    showUploadError("Please choose a JPG, PNG, or WebP image.");
    elements.fileInput.value = "";
    revealStudioAfterHeroUpload();
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showUploadError("That image is larger than 20 MB. Choose a smaller file and try again.");
    elements.fileInput.value = "";
    revealStudioAfterHeroUpload();
    return;
  }

  const newUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = newUrl;

  setResultStatus("working", "Reading image…");

  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(newUrl);
    if (loadToken !== state.loadToken) return;
    showUploadError("We could not read that image. It may be damaged or use an unsupported format.");
    setResultStatus(state.result ? "ready" : "idle", state.result ? "Mosaic ready" : "Waiting for a source");
    elements.fileInput.value = "";
    revealStudioAfterHeroUpload();
    return;
  }

  if (loadToken !== state.loadToken) {
    URL.revokeObjectURL(newUrl);
    return;
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    URL.revokeObjectURL(newUrl);
    showUploadError("This image has no readable dimensions. Please choose another file.");
    setResultStatus(state.result ? "ready" : "idle", state.result ? "Mosaic ready" : "Waiting for a source");
    revealStudioAfterHeroUpload();
    return;
  }

  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);

  state.image = image;
  state.sourceMode = "image";
  state.imageUrl = newUrl;
  state.file = file;
  state.result = null;

  elements.sourcePreview.src = newUrl;
  elements.sourcePreview.alt = `Original uploaded image: ${file.name}`;
  elements.uploadThumbnail.src = newUrl;
  elements.uploadThumbnail.alt = "";
  elements.fileName.textContent = file.name;
  elements.fileDetails.textContent = `${formatNumber(image.naturalWidth)} × ${formatNumber(image.naturalHeight)} · ${formatBytes(file.size)}`;
  elements.dropEmpty.hidden = true;
  elements.dropPreview.hidden = false;
  elements.generateButton.disabled = false;
  elements.resetButton.disabled = false;

  await generateMosaic(true);
  revealStudioAfterHeroUpload();
}

async function loadTextSource(rawText) {
  const text = rawText.trim();
  if (!text || state.sourceMode !== "text") return;

  const loadToken = ++state.loadToken;
  hideUploadError();
  setResultStatus("working", "Typesetting text…");

  const sourceCanvas = renderTextSource(text);
  const dataUrl = sourceCanvas.toDataURL("image/png");
  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;

  try {
    await image.decode();
  } catch (error) {
    if (loadToken !== state.loadToken) return;
    setResultStatus("idle", "Could not create text source");
    elements.liveStatus.textContent = "The text source could not be created. Try a shorter phrase.";
    elements.generateButton.disabled = true;
    return;
  }

  if (loadToken !== state.loadToken || state.sourceMode !== "text") return;
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);

  const slug = text
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "text";

  state.image = image;
  state.imageUrl = "";
  state.file = { name: `${slug}.png` };
  state.result = null;

  elements.sourcePreview.src = dataUrl;
  elements.sourcePreview.alt = `Text source reading: ${text}`;
  elements.generateButton.disabled = false;
  elements.resetButton.disabled = false;

  await generateMosaic(true);
}

function renderTextSource(rawText) {
  const canvas = document.createElement("canvas");
  const text = balanceTextForMosaic(rawText.toUpperCase());
  const intendedLineCount = text.split(/\r?\n/).length;
  canvas.width = 1400;
  canvas.height = intendedLineCount === 1 ? 500 : intendedLineCount === 2 ? 800 : 950;
  const context = canvas.getContext("2d");
  const maxWidth = 1160;
  const maxHeight = canvas.height - (intendedLineCount === 1 ? 120 : 180);
  let fontSize = 600;
  let lines = [];
  let lineHeight = 0;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#11110f";
  context.strokeStyle = "#11110f";
  context.textAlign = "center";
  context.textBaseline = "middle";

  while (fontSize >= 28) {
    context.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
    lines = wrapTextLines(context, text, maxWidth);
    lineHeight = fontSize * 0.92;
    const widestLine = Math.max(...lines.map((line) => context.measureText(trackTextLine(line) || " ").width));
    if (widestLine <= maxWidth && lines.length * lineHeight <= maxHeight) break;
    fontSize -= 8;
  }

  const totalHeight = lines.length * lineHeight;
  const startY = canvas.height / 2 - totalHeight / 2 + lineHeight / 2;
  context.lineJoin = "round";
  context.lineWidth = Math.max(10, fontSize * 0.055);
  lines.forEach((line, index) => {
    const trackedLine = trackTextLine(line);
    context.strokeText(trackedLine, canvas.width / 2, startY + index * lineHeight, maxWidth);
    context.fillText(trackedLine, canvas.width / 2, startY + index * lineHeight, maxWidth);
  });

  return canvas;
}

function balanceTextForMosaic(text) {
  if (/\r?\n/.test(text)) return text;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const characterCount = words.join("").length;
  if (words.length < 2 || characterCount <= 7) return words.join(" ");

  const lineCount = characterCount > 22 && words.length >= 3 ? 3 : 2;
  const lines = [];
  let wordIndex = 0;

  for (let lineIndex = 0; lineIndex < lineCount && wordIndex < words.length; lineIndex += 1) {
    const remainingWords = words.slice(wordIndex);
    const remainingLines = lineCount - lineIndex;
    const remainingCharacters = remainingWords.reduce((sum, word) => sum + word.length, 0);
    const targetLength = Math.ceil(remainingCharacters / remainingLines);
    let line = "";

    while (wordIndex < words.length) {
      const candidate = line ? `${line} ${words[wordIndex]}` : words[wordIndex];
      const wordsAfterCandidate = words.length - wordIndex - 1;
      if (line && candidate.length > targetLength && wordsAfterCandidate >= remainingLines - 1) break;
      line = candidate;
      wordIndex += 1;
      if (line.length >= targetLength && words.length - wordIndex >= remainingLines - 1) break;
    }
    lines.push(line);
  }

  if (wordIndex < words.length) lines[lines.length - 1] += ` ${words.slice(wordIndex).join(" ")}`;
  return lines.join("\n");
}

function trackTextLine(line) {
  return Array.from(line)
    .map((character) => character === " " ? "\u2003" : character)
    .join("\u2009");
}

function wrapTextLines(context, text, maxWidth) {
  const lines = [];
  const paragraphs = text.split(/\r?\n/);

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    let currentLine = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const candidate = `${currentLine} ${words[index]}`;
      if (context.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[index];
      }
    }
    lines.push(currentLine);
  });

  return lines;
}

function setSourceMode(mode, { focus = true } = {}) {
  if (mode !== "image" && mode !== "text") return;
  const changed = state.sourceMode !== mode;
  state.sourceMode = mode;
  elements.sourceModeInputs.forEach((input) => { input.checked = input.value === mode; });
  elements.imageSourcePanel.hidden = mode !== "image";
  elements.textSourcePanel.hidden = mode !== "text";
  elements.sourceHeading.textContent = mode === "image" ? "Source image" : "Source text";
  elements.sourceHeadingMeta.textContent = mode === "image"
    ? "JPG, PNG or WebP · max 20 MB"
    : "Up to 60 characters · line breaks supported";
  elements.resetButton.textContent = mode === "image" ? "Reset image" : "Clear text";

  if (changed) {
    resetImage({ focus: false, clearText: false, announce: false });
    if (mode === "text" && elements.textSource.value.trim()) {
      state.textTimer = window.setTimeout(() => loadTextSource(elements.textSource.value), 0);
    }
  }

  if (focus) {
    (mode === "image" ? elements.fileInput : elements.textSource).focus();
  }
}

function scheduleRender() {
  if (!state.image) return;
  window.clearTimeout(state.renderTimer);
  state.renderTimer = window.setTimeout(() => generateMosaic(false), 120);
}

async function generateMosaic(announceStart = false) {
  if (!state.image) return;

  window.clearTimeout(state.renderTimer);
  const token = ++state.renderToken;
  const settings = readSettings();
  setResultStatus("working", announceStart ? "Generating mosaic…" : "Updating preview…");
  elements.downloadButton.disabled = true;

  await nextFrame();
  if (token !== state.renderToken) return;

  try {
    const imageAspect = state.image.naturalWidth / state.image.naturalHeight;
    const orientation = settings.orientation === "auto"
      ? (imageAspect > 1.12 ? "horizontal" : "vertical")
      : settings.orientation;
    const layout = findBestGrid(settings.budget, imageAspect, orientation);
    const sampled = sampleImage(state.image, layout, orientation, settings);
    const faces = quantizeFaces(sampled, settings);
    const inventory = renderDominoCanvas(faces, layout, orientation, settings);

    if (token !== state.renderToken) return;

    state.result = {
      ...layout,
      orientation,
      inventory,
      settings,
    };

    updateResultUI(state.result);
    elements.generateButton.disabled = false;
    elements.downloadButton.disabled = false;
    setResultStatus("ready", "Mosaic ready");

    const message = `Generated ${formatNumber(layout.used)} dominoes: ${layout.cols} across by ${layout.rows} down.`;
    elements.liveStatus.textContent = message;
  } catch (error) {
    if (token !== state.renderToken) return;
    state.result = null;
    elements.generateButton.disabled = false;
    elements.downloadButton.disabled = true;
    setResultStatus("idle", "Could not generate preview");
    elements.liveStatus.textContent = "The mosaic could not be generated with these settings. Try a smaller domino count or another image.";
  }
}

function revealStudioAfterHeroUpload() {
  if (!state.scrollAfterUpload) return;
  state.scrollAfterUpload = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelector("#studio").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

function readSettings() {
  return {
    budget: clamp(Number(elements.budgetRange.value), 20, 3000),
    orientation: document.querySelector('input[name="orientation"]:checked').value,
    palette: document.querySelector('input[name="palette"]:checked').value,
    crop: elements.cropMode.value,
    gap: Number(elements.gapSize.value),
    contrast: Number(elements.contrast.value) / 100,
    dither: elements.ditherToggle.checked,
    invert: elements.invertToggle.checked,
    sourceMode: state.sourceMode,
  };
}

function findBestGrid(budget, imageAspect, orientation) {
  const tileAspect = orientation === "vertical" ? 0.5 : 2;
  const minimumUse = budget * 0.95;
  let best = null;

  for (let rows = 1; rows <= budget; rows += 1) {
    const maximumColumns = Math.floor(budget / rows);
    const minimumColumns = Math.max(1, Math.ceil(minimumUse / rows));
    if (maximumColumns < 1) break;
    if (minimumColumns > maximumColumns) continue;

    for (let cols = minimumColumns; cols <= maximumColumns; cols += 1) {
      const used = cols * rows;
      const gridAspect = (cols / rows) * tileAspect;
      const aspectError = Math.abs(Math.log(gridAspect / imageAspect));
      const unusedRatio = (budget - used) / budget;
      const score = aspectError * 1.8 + unusedRatio * 0.38;

      if (!best || score < best.score || (Math.abs(score - best.score) < 1e-8 && used > best.used)) {
        best = { cols, rows, used, gridAspect, score };
      }
    }
  }

  if (!best) {
    const rows = Math.max(1, Math.round(Math.sqrt(budget * tileAspect / imageAspect)));
    const cols = Math.max(1, Math.floor(budget / rows));
    best = {
      cols,
      rows,
      used: cols * rows,
      gridAspect: (cols / rows) * tileAspect,
      score: 0,
    };
  }

  return best;
}

function sampleImage(image, layout, orientation, settings) {
  const width = orientation === "vertical" ? layout.cols : layout.cols * 2;
  const height = orientation === "vertical" ? layout.rows * 2 : layout.rows;
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = width / height;

  if (settings.crop === "contain") {
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    context.drawImage(image, x, y, drawWidth, drawHeight);
  } else if (sourceAspect > targetAspect) {
    const cropWidth = sourceHeight * targetAspect;
    const sourceX = (sourceWidth - cropWidth) / 2;
    context.drawImage(image, sourceX, 0, cropWidth, sourceHeight, 0, 0, width, height);
  } else {
    const cropHeight = sourceWidth / targetAspect;
    const sourceY = (sourceHeight - cropHeight) / 2;
    context.drawImage(image, 0, sourceY, sourceWidth, cropHeight, 0, 0, width, height);
  }

  return {
    width,
    height,
    data: context.getImageData(0, 0, width, height).data,
  };
}

function quantizeFaces(sampled, settings) {
  const count = sampled.width * sampled.height;
  const tones = new Float32Array(count);
  const colors = new Uint8ClampedArray(count * 3);

  for (let index = 0; index < count; index += 1) {
    const pixelIndex = index * 4;
    const r = sampled.data[pixelIndex];
    const g = sampled.data[pixelIndex + 1];
    const b = sampled.data[pixelIndex + 2];
    let luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    luminance = clamp((luminance - 0.5) * settings.contrast + 0.5, 0, 1);
    if (settings.invert) luminance = 1 - luminance;
    tones[index] = luminance;
    colors[index * 3] = r;
    colors[index * 3 + 1] = g;
    colors[index * 3 + 2] = b;
  }

  const isTextSource = settings.sourceMode === "text";
  const quantized = isTextSource
    ? tones.map((tone) => tone < 0.58 ? 0 : 1)
    : settings.dither
      ? floydSteinberg(tones, sampled.width, sampled.height)
      : tones.map((tone) => Math.round(tone * 6) / 6);

  const faces = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const tone = clamp(quantized[index], 0, 1);
    const pipValue = isTextSource
      ? (tone < 0.5 ? 1 : 0)
      : settings.palette === "obsidian"
        ? Math.round(tone * 6)
        : Math.round((1 - tone) * 6);
    faces[index] = {
      value: clamp(pipValue, 0, 6),
      r: colors[index * 3],
      g: colors[index * 3 + 1],
      b: colors[index * 3 + 2],
      luminance: (0.2126 * colors[index * 3] + 0.7152 * colors[index * 3 + 1] + 0.0722 * colors[index * 3 + 2]) / 255,
    };
  }

  return { width: sampled.width, height: sampled.height, faces };
}

function floydSteinberg(input, width, height) {
  const values = new Float32Array(input);
  const output = new Float32Array(input.length);

  for (let y = 0; y < height; y += 1) {
    const leftToRight = y % 2 === 0;
    const start = leftToRight ? 0 : width - 1;
    const end = leftToRight ? width : -1;
    const direction = leftToRight ? 1 : -1;

    for (let x = start; x !== end; x += direction) {
      const index = y * width + x;
      const oldValue = clamp(values[index], 0, 1);
      const newValue = Math.round(oldValue * 6) / 6;
      output[index] = newValue;
      const error = oldValue - newValue;

      spreadError(values, width, height, x + direction, y, error * 7 / 16);
      spreadError(values, width, height, x - direction, y + 1, error * 3 / 16);
      spreadError(values, width, height, x, y + 1, error * 5 / 16);
      spreadError(values, width, height, x + direction, y + 1, error / 16);
    }
  }

  return output;
}

function spreadError(values, width, height, x, y, amount) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  values[y * width + x] += amount;
}

function renderDominoCanvas(sampled, layout, orientation, settings) {
  const faceColumns = orientation === "vertical" ? layout.cols : layout.cols * 2;
  const faceRows = orientation === "vertical" ? layout.rows * 2 : layout.rows;
  const unit = Math.min(28, MAX_CANVAS_EDGE / Math.max(faceColumns, faceRows));
  const width = Math.min(MAX_CANVAS_EDGE, Math.max(1, Math.ceil(faceColumns * unit)));
  const height = Math.min(MAX_CANVAS_EDGE, Math.max(1, Math.ceil(faceRows * unit)));
  const canvas = elements.canvas;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  const stageColor = settings.palette === "obsidian" ? "#e8e1d5" : "#22221f";
  context.fillStyle = stageColor;
  context.fillRect(0, 0, width, height);

  const tileWidth = orientation === "vertical" ? unit : unit * 2;
  const tileHeight = orientation === "vertical" ? unit * 2 : unit;
  const gapFactor = { 1: 0.045, 2: 0.075, 3: 0.12 }[settings.gap] || 0.075;
  const gap = Math.max(0.04, unit * gapFactor);
  const inventory = new Map();

  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const firstIndex = orientation === "vertical"
        ? (row * 2) * sampled.width + col
        : row * sampled.width + col * 2;
      const secondIndex = orientation === "vertical"
        ? (row * 2 + 1) * sampled.width + col
        : row * sampled.width + col * 2 + 1;
      const firstFace = sampled.faces[firstIndex];
      const secondFace = sampled.faces[secondIndex];

      drawDomino(
        context,
        col * tileWidth,
        row * tileHeight,
        tileWidth,
        tileHeight,
        unit,
        gap,
        orientation,
        firstFace,
        secondFace,
        settings.palette,
        settings.sourceMode === "text",
      );

      const low = Math.min(firstFace.value, secondFace.value);
      const high = Math.max(firstFace.value, secondFace.value);
      const key = `${low}-${high}`;
      inventory.set(key, (inventory.get(key) || 0) + 1);
    }
  }

  return inventory;
}

function drawDomino(context, x, y, width, height, unit, gap, orientation, firstFace, secondFace, palette, textMode) {
  const inset = gap / 2;
  const bodyX = x + inset;
  const bodyY = y + inset;
  const bodyWidth = width - gap;
  const bodyHeight = height - gap;
  const radius = Math.max(0.08, unit * 0.13);

  context.save();
  roundedRectPath(context, bodyX, bodyY, bodyWidth, bodyHeight, radius);
  context.clip();

  if (palette === "color" || textMode) {
    context.fillStyle = textMode ? colorForTextFace(firstFace, palette) : colorForFace(firstFace);
    if (orientation === "vertical") {
      context.fillRect(bodyX, bodyY, bodyWidth, bodyHeight / 2);
      context.fillStyle = textMode ? colorForTextFace(secondFace, palette) : colorForFace(secondFace);
      context.fillRect(bodyX, bodyY + bodyHeight / 2, bodyWidth, bodyHeight / 2);
    } else {
      context.fillRect(bodyX, bodyY, bodyWidth / 2, bodyHeight);
      context.fillStyle = textMode ? colorForTextFace(secondFace, palette) : colorForFace(secondFace);
      context.fillRect(bodyX + bodyWidth / 2, bodyY, bodyWidth / 2, bodyHeight);
    }
  } else {
    context.fillStyle = palette === "obsidian" ? "#1b1c19" : "#f2e8d4";
    context.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);

    const shine = context.createLinearGradient(bodyX, bodyY, bodyX + bodyWidth, bodyY + bodyHeight);
    shine.addColorStop(0, palette === "obsidian" ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.34)");
    shine.addColorStop(0.55, "rgba(255,255,255,0)");
    shine.addColorStop(1, palette === "obsidian" ? "rgba(0,0,0,.18)" : "rgba(99,76,40,.08)");
    context.fillStyle = shine;
    context.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
  }

  context.restore();

  roundedRectPath(context, bodyX, bodyY, bodyWidth, bodyHeight, radius);
  context.strokeStyle = palette === "obsidian" ? "rgba(0,0,0,.85)" : "rgba(25,24,20,.7)";
  context.lineWidth = Math.max(0.05, unit * 0.035);
  context.stroke();

  context.beginPath();
  if (orientation === "vertical") {
    context.moveTo(bodyX + unit * 0.14, y + unit);
    context.lineTo(bodyX + bodyWidth - unit * 0.14, y + unit);
  } else {
    context.moveTo(x + unit, bodyY + unit * 0.14);
    context.lineTo(x + unit, bodyY + bodyHeight - unit * 0.14);
  }
  context.strokeStyle = palette === "obsidian" ? "rgba(244,239,224,.25)" : "rgba(22,21,18,.36)";
  context.lineWidth = Math.max(0.04, unit * 0.028);
  context.stroke();

  const faceOneX = x;
  const faceOneY = y;
  const faceTwoX = orientation === "vertical" ? x : x + unit;
  const faceTwoY = orientation === "vertical" ? y + unit : y;
  drawPips(context, firstFace.value, faceOneX, faceOneY, unit, firstFace, palette, textMode);
  drawPips(context, secondFace.value, faceTwoX, faceTwoY, unit, secondFace, palette, textMode);
}

function drawPips(context, value, x, y, size, face, palette, textMode) {
  const positions = PIP_POSITIONS[value] || [];
  const radius = Math.max(0.04, size * 0.086);
  let pipColor = "#24231f";

  if (palette === "obsidian") pipColor = "#f3ebda";
  if (palette === "color") pipColor = face.luminance > 0.54 ? "rgba(20,20,18,.82)" : "rgba(255,252,241,.9)";
  if (textMode) {
    if (palette === "ivory") pipColor = "#f3ebda";
    if (palette === "obsidian" || palette === "color") pipColor = "#20201d";
  }

  context.fillStyle = pipColor;
  for (const [px, py] of positions) {
    context.beginPath();
    context.arc(x + px * size, y + py * size, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function colorForTextFace(face, palette) {
  const isLetter = face.value > 0;
  if (palette === "obsidian") return isLetter ? "#f2e8d4" : "#1b1c19";
  if (palette === "color") return isLetter ? "#ff6542" : "#f2e8d4";
  return isLetter ? "#1b1c19" : "#f2e8d4";
}

function colorForFace(face) {
  const saturationBoost = 1.07;
  const average = (face.r + face.g + face.b) / 3;
  const r = clamp(Math.round(average + (face.r - average) * saturationBoost), 0, 255);
  const g = clamp(Math.round(average + (face.g - average) * saturationBoost), 0, 255);
  const b = clamp(Math.round(average + (face.b - average) * saturationBoost), 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function updateResultUI(result) {
  const { cols, rows, used, orientation, inventory, settings } = result;
  const setsNeeded = Math.max(...inventory.values());
  const budgetDifference = settings.budget - used;

  elements.previewEmpty.hidden = true;
  elements.previewPanes.hidden = false;
  elements.viewButtons.forEach((button) => { button.disabled = false; });
  elements.horizontalRuler.textContent = `${formatNumber(cols)} dominoes across`;
  elements.verticalRuler.textContent = `${formatNumber(rows)} dominoes down`;
  elements.usedStat.textContent = formatNumber(used);
  elements.budgetStat.textContent = budgetDifference === 0
    ? `Exact match to your ${formatNumber(settings.budget)} piece budget`
    : `${formatNumber(budgetDifference)} below your ${formatNumber(settings.budget)} piece budget`;
  elements.acrossStat.textContent = formatNumber(cols);
  elements.downStat.textContent = formatNumber(rows);
  elements.footprintStat.textContent = formatFootprint(cols, rows, orientation);
  elements.buildFormula.textContent = `${formatNumber(cols)} across × ${formatNumber(rows)} down = ${formatNumber(used)} dominoes`;
  elements.canvas.setAttribute(
    "aria-label",
    `Domino mosaic made from ${formatNumber(used)} pieces, arranged ${cols} across by ${rows} down, using ${orientation} dominoes.`,
  );
  elements.inventoryPanel.removeAttribute("disabled");
  elements.inventoryPanel.removeAttribute("inert");
  elements.inventoryPanel.setAttribute("aria-disabled", "false");
  elements.inventorySummary.textContent = `${formatNumber(setsNeeded)} double-six sets minimum · ${formatNumber(used)} pieces`;
  elements.inventoryNote.textContent = settings.palette === "color"
    ? "Pairs are grouped regardless of direction. The photo-color finish assumes the faces will be painted or printed."
    : "Pairs are grouped regardless of direction. One standard double-six set contains one of each pair.";
  renderInventory(inventory);
}

function renderInventory(inventory) {
  const fragment = document.createDocumentFragment();
  elements.inventoryGrid.replaceChildren();

  for (let low = 0; low <= 6; low += 1) {
    for (let high = low; high <= 6; high += 1) {
      const count = inventory.get(`${low}-${high}`) || 0;
      const item = document.createElement("div");
      item.className = "inventory-item";
      if (!count) item.style.opacity = "0.45";

      const pair = document.createElement("span");
      pair.textContent = `${low} — ${high}`;
      const amount = document.createElement("strong");
      amount.textContent = `×${formatNumber(count)}`;
      item.append(pair, amount);
      fragment.append(item);
    }
  }

  elements.inventoryGrid.append(fragment);
}

function setView(view) {
  if (!state.result) return;
  elements.previewStage.dataset.view = view;
  elements.viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  });
}

function resetImage({ focus = true, clearText = state.sourceMode === "text", announce = true } = {}) {
  state.scrollAfterUpload = false;
  window.clearTimeout(state.textTimer);
  state.loadToken += 1;
  state.renderToken += 1;
  state.image = null;
  state.file = null;
  state.result = null;
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = "";
  elements.fileInput.value = "";
  if (clearText) {
    elements.textSource.value = "";
    elements.textCount.textContent = "0 / 60";
  }
  elements.sourcePreview.removeAttribute("src");
  elements.uploadThumbnail.removeAttribute("src");
  elements.dropEmpty.hidden = false;
  elements.dropPreview.hidden = true;
  elements.previewEmpty.hidden = false;
  elements.previewPanes.hidden = true;
  elements.generateButton.disabled = true;
  elements.resetButton.disabled = true;
  elements.downloadButton.disabled = true;
  elements.canvas.width = 1;
  elements.canvas.height = 1;
  elements.horizontalRuler.textContent = "— dominoes across";
  elements.verticalRuler.textContent = "— dominoes down";
  elements.usedStat.textContent = "—";
  elements.budgetStat.textContent = "Choose a source to begin";
  elements.acrossStat.textContent = "—";
  elements.downStat.textContent = "—";
  elements.footprintStat.textContent = "—";
  elements.buildFormula.textContent = "Choose a source to calculate your grid";
  elements.inventoryPanel.open = false;
  elements.inventoryPanel.setAttribute("disabled", "");
  elements.inventoryPanel.setAttribute("inert", "");
  elements.inventoryPanel.setAttribute("aria-disabled", "true");
  elements.inventorySummary.textContent = "Generated after choosing a source";
  elements.inventoryNote.textContent = "Pairs are grouped regardless of direction. One standard double-six set contains one of each pair.";
  elements.inventoryGrid.replaceChildren();
  elements.previewStage.dataset.view = "mosaic";
  elements.viewButtons.forEach((button) => {
    button.disabled = true;
    button.classList.toggle("active", button.dataset.view === "mosaic");
    button.setAttribute("aria-pressed", String(button.dataset.view === "mosaic"));
  });
  hideUploadError();
  setResultStatus("idle", "Waiting for a source");
  if (announce) elements.liveStatus.textContent = "Source cleared. Choose an image or enter text to create a mosaic.";
  if (focus) (state.sourceMode === "image" ? elements.fileInput : elements.textSource).focus();
}

function downloadMosaic() {
  if (!state.result || !elements.canvas.width || !elements.canvas.height) return;
  const resultSnapshot = state.result;
  const fileNameSnapshot = state.file?.name || "domino-mosaic";
  elements.canvas.toBlob((blob) => {
    if (!blob) {
      elements.liveStatus.textContent = "The PNG could not be created. Please try again.";
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const sourceName = fileNameSnapshot.replace(/\.[^.]+$/, "");
    const safeName = sourceName.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "domino-mosaic";
    link.href = url;
    link.download = `${safeName}-${resultSnapshot.cols}x${resultSnapshot.rows}-domino-mosaic.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    elements.liveStatus.textContent = "High-resolution mosaic PNG downloaded.";
  }, "image/png");
}

function setResultStatus(kind, text) {
  elements.resultStatusDot.classList.remove("ready", "working");
  if (kind === "ready") elements.resultStatusDot.classList.add("ready");
  if (kind === "working") elements.resultStatusDot.classList.add("working");
  elements.resultState.textContent = text;
}

function showUploadError(message) {
  elements.uploadError.textContent = message;
  elements.uploadError.hidden = false;
}

function hideUploadError() {
  elements.uploadError.textContent = "";
  elements.uploadError.hidden = true;
}

function renderToneScale() {
  document.querySelectorAll("[data-pip]").forEach((face) => {
    const value = Number(face.dataset.pip);
    for (const [x, y] of PIP_POSITIONS[value]) {
      const dot = document.createElement("i");
      dot.style.left = `${x * 100}%`;
      dot.style.top = `${y * 100}%`;
      face.append(dot);
    }
  });
}

function formatFootprint(cols, rows, orientation) {
  const widthMm = cols * (orientation === "horizontal" ? 50 : 25);
  const heightMm = rows * (orientation === "vertical" ? 50 : 25);
  if (Math.max(widthMm, heightMm) >= 1000) {
    return `${(widthMm / 1000).toFixed(2)} × ${(heightMm / 1000).toFixed(2)} m`;
  }
  return `${Math.round(widthMm / 10)} × ${Math.round(heightMm / 10)} cm`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function updateRangeProgress(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value);
  const progress = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--range-progress", `${progress}%`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
