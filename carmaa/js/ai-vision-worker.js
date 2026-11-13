/* CarMaa — on-device photo recognition worker (free, no API key, photos never leave the phone).
   Runs OpenAI CLIP (ViT-B/32, quantized ONNX) through Transformers.js and does hierarchical zero-shot
   classification:  is it a car exterior? → maker → model of that maker → colour.
   Loaded as a MODULE worker by js/55-photo-autofill.js.

   Messages in : { type:"init", cfg }                       (once)
                 { id, type:"analyze", images:[blobUrl], catalog:{ makers:[{key,en,models:[{name,en}]}], colors:[{key,en}] } }
   Messages out: { type:"progress", pct }  { id, type:"phase", phase }  { id, type:"result", result }  { id, type:"error", message } */
import {
  env, AutoTokenizer, AutoProcessor, RawImage,
  CLIPTextModelWithProjection, CLIPVisionModelWithProjection,
} from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

const MODEL_ID = "Xenova/clip-vit-base-patch32";
let cfg = { localModelPath: "", allowRemote: true, remoteHost: "" };
let ready = null;
let tokenizer, textModel, processor, visionModel;
const textCache = new Map();               // label → normalized Float32Array
const fileProgress = new Map();            // file → {loaded,total}

function configure() {
  env.allowLocalModels = !!cfg.localModelPath;
  if (cfg.localModelPath) env.localModelPath = cfg.localModelPath;   // e.g. "/models/" → /models/Xenova/clip-vit-base-patch32/…
  env.allowRemoteModels = cfg.allowRemote !== false;
  if (cfg.remoteHost) env.remoteHost = cfg.remoteHost;               // optional mirror of huggingface.co
  env.useBrowserCache = true;                                         // model is downloaded once, then served from Cache Storage
}

function onProgress(p) {
  if (!p || p.status !== "progress" || !p.total) return;
  fileProgress.set(p.file, { loaded: p.loaded, total: p.total });
  let l = 0, t = 0;
  fileProgress.forEach(v => { l += v.loaded; t += v.total; });
  postMessage({ type: "progress", pct: t ? Math.min(99, Math.round((l / t) * 100)) : 0 });
}

function load() {
  if (ready) return ready;
  ready = (async () => {
    configure();
    const opts = { quantized: true, progress_callback: onProgress };
    [tokenizer, textModel, processor, visionModel] = await Promise.all([
      AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback: onProgress }),
      CLIPTextModelWithProjection.from_pretrained(MODEL_ID, opts),
      AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: onProgress }),
      CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, opts),
    ]);
  })().catch(e => { ready = null; throw e; });
  return ready;
}

function normalize(arr) {
  let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i];
  s = Math.sqrt(s) || 1;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] / s;
  return out;
}

async function embedTexts(labels) {
  const missing = [...new Set(labels)].filter(l => !textCache.has(l));
  for (let i = 0; i < missing.length; i += 48) {
    const chunk = missing.slice(i, i + 48);
    const inputs = tokenizer(chunk, { padding: true, truncation: true });
    const { text_embeds } = await textModel(inputs);
    const d = text_embeds.dims[1];
    chunk.forEach((label, k) => textCache.set(label, normalize(text_embeds.data.slice(k * d, (k + 1) * d))));
  }
  return labels.map(l => textCache.get(l));
}

async function embedImage(url) {
  const img = await RawImage.read(url);
  const inputs = await processor(img);
  const { image_embeds } = await visionModel(inputs);
  return normalize(image_embeds.data);
}

// CLIP logit scale = 100.  Returns softmax probabilities for one image against the label embeddings.
function probs(imgEmb, textEmbs) {
  const logits = textEmbs.map(t => { let s = 0; for (let i = 0; i < t.length; i++) s += t[i] * imgEmb[i]; return s * 100; });
  const m = Math.max(...logits);
  const ex = logits.map(x => Math.exp(x - m));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map(x => x / sum);
}

// Weighted average of per-image distributions (weights = how "exterior" each photo is).
function blend(imgEmbs, weights, textEmbs) {
  const acc = new Array(textEmbs.length).fill(0);
  let wsum = 0;
  imgEmbs.forEach((e, i) => {
    const p = probs(e, textEmbs), w = weights[i];
    p.forEach((v, k) => { acc[k] += v * w; });
    wsum += w;
  });
  return acc.map(v => v / (wsum || 1));
}

function top(dist, n = 2) {
  return dist.map((p, i) => ({ i, p })).sort((a, b) => b.p - a.p).slice(0, n);
}

async function analyze(id, { images, catalog }) {
  const phase = (p) => postMessage({ id, type: "phase", phase: p });
  phase("load");
  await load();
  postMessage({ type: "progress", pct: 100 });

  phase("images");
  const imgEmbs = [];
  for (const url of images) imgEmbs.push(await embedImage(url));

  // 1) Is this a car exterior at all?  (interiors / random photos must not trigger a guess)
  const gateEmbs = await embedTexts([
    "a photo of the exterior of a car", "a photo of the interior of a car", "a photo of something that is not a car",
  ]);
  const gate = imgEmbs.map(e => probs(e, gateEmbs));
  const pExt = gate.map(g => g[0]);
  const weights = pExt.map(p => Math.max(p, 0.02));
  const result = { pExterior: Math.max(...pExt), maker: null, model: null, color: null };
  if (result.pExterior < 0.35) return result;

  // 2) maker
  phase("brand");
  const makerEmbs = await embedTexts(catalog.makers.map(m => `a photo of a ${m.en} car`));
  const mt = top(blend(imgEmbs, weights, makerEmbs), 3);
  const best = catalog.makers[mt[0].i];
  result.maker = { key: best.key, brand: best.brand, en: best.en, p: mt[0].p, second: mt[1] ? mt[1].p : 0 };

  // 3) model, restricted to that maker's lineup
  if (best.models && best.models.length) {
    const modelEmbs = await embedTexts(best.models.map(m => `a photo of a ${m.en}`));
    const dist = blend(imgEmbs, weights, modelEmbs);
    const tm = top(dist, 3);
    result.model = {
      name: best.models[tm[0].i].name, p: tm[0].p, second: tm[1] ? tm[1].p : 0,
      alternatives: tm.map(x => ({ name: best.models[x.i].name, p: x.p })),
    };
  }

  // 4) colour
  phase("color");
  const colorEmbs = await embedTexts(catalog.colors.map(c => `a photo of a ${c.en} car`));
  const ct = top(blend(imgEmbs, weights, colorEmbs), 2);
  result.color = { key: catalog.colors[ct[0].i].key, p: ct[0].p, second: ct[1] ? ct[1].p : 0 };
  return result;
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type === "init") { cfg = { ...cfg, ...(msg.cfg || {}) }; return; }
  if (msg.type !== "analyze") return;
  try {
    postMessage({ id: msg.id, type: "result", result: await analyze(msg.id, msg) });
  } catch (err) {
    postMessage({ id: msg.id, type: "error", message: String((err && err.message) || err) });
  }
};
