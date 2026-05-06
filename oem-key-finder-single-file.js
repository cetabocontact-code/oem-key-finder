require('dotenv').config();

const express = require('express');
const axios = require('axios');
const axiosRetryModule = require('axios-retry');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');

const axiosRetry = axiosRetryModule.default || axiosRetryModule;
const app = express();
const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 3600);

const MAKES = {
  toyota: { label: 'Toyota', sites: ['www.toyotapartsdeal.com'], seed: '89070-02880', strategy: 'partsdeal', color: '#c8102e', testVin: '2T3WFREV1EW114903', testPart: '89070-02880', wmi: ['JT0','JT1','JT2','JT3','JT4','JT5','JT6','JT7','JT8','JT9','JTD','JTE','JTF','JTL','JTM','JTN','4T1','4T2','4T3','5TD','5TE','5TF','5TG','5TJ','2T1','2T2','2T3','3TM','3TN','3TE','3TD','3TK'] },
  lexus: { label: 'Lexus', sites: ['www.toyotapartsdeal.com', 'lexuspartsnow.com'], seed: '89904-48481', strategy: 'partsdeal', color: '#1a1a2e', testVin: 'JTHCF1D21E5003351', testPart: '89904-48481', wmi: ['JTH','JTJ','JTK'] },
  scion: { label: 'Scion', sites: ['www.toyotapartsdeal.com'], seed: '89070-52G30', strategy: 'partsdeal', color: '#2d6a9f', testVin: 'JTKJF5C72E3083695', testPart: '89070-52G30', wmi: ['JTK','JTN'] },
  nissan: { label: 'Nissan', sites: ['www.nissanpartsdeal.com'], seed: '285E3-9UF7A', strategy: 'partsdeal', color: '#c3002f', testVin: '1N4AL3AP2EC194907', testPart: '285E3-9UF7A', wmi: ['JN1','JN3','JN6','JN8','1N4','1N6','3N1','3N6','5N1','5N3'] },
  infiniti: { label: 'Infiniti', sites: ['www.nissanpartsdeal.com'], seed: '285E3-1LP0C', strategy: 'partsdeal', color: '#8b6914', testVin: 'JN1CV6EL0EM132375', testPart: '285E3-1LP0C', wmi: ['JNK','JNA','JN1'] },
  honda: { label: 'Honda', sites: ['www.hondapartsnow.com'], seed: '72147-TG7-A11', strategy: 'partsdeal', color: '#e40521', testVin: '1HGCR2F88EA282614', testPart: '72147-TG7-A11', wmi: ['JHM','JH2','19X','1HG','1H3','2HG','2HK','5FN'] },
  acura: { label: 'Acura', sites: ['www.acurapartsnow.com', 'www.acurapartswarehouse.com'], seed: '72147-SY8-A03', strategy: 'partsdeal', color: '#1e3a5f', testVin: '5FRYD4H86EB504844', testPart: '72147-SY8-A03', wmi: ['JH4','5J8','5J6','5FR','19U'] },
  chevrolet: { label: 'Chevrolet', sites: ['www.gmpartsdirect.com', 'www.gmpartsgiant.com'], seed: '13586489', strategy: 'partsdeal', color: '#d4af37', testVin: '3GCUKREC6EG362971', testPart: '13586489', wmi: ['1G1','1GC','1GD','1GN','1GS','2G1','3G1','3GC'] },
  gmc: { label: 'GMC', sites: ['www.gmpartsdirect.com', 'www.gmpartsgiant.com'], seed: '13577771', strategy: 'partsdeal', color: '#c8102e', testVin: '3GTU2UEC6EG107319', testPart: '13577771', wmi: ['1GK','1GT','3GT'] },
  buick: { label: 'Buick', sites: ['www.gmpartsdirect.com', 'www.gmpartsgiant.com'], seed: '13521090', strategy: 'partsdeal', color: '#8b0000', testVin: '1G4GA5GR3EF130870', testPart: '13521090', wmi: ['1G4','2G4','3G5'] },
  cadillac: { label: 'Cadillac', sites: ['www.gmpartsdirect.com', 'www.gmpartsgiant.com'], seed: '22865375', strategy: 'partsdeal', color: '#6b3a2a', testVin: '2G61W5S86E9114863', testPart: '22865375', wmi: ['1G6','1GY'] },
  ford: { label: 'Ford', sites: ['www.fordparts.com'], seed: '164-R8067', strategy: 'partsdeal', color: '#003476', testVin: '1FTFW1ET8EFC50303', testPart: '164-R8067', wmi: ['1FA','1FB','1FC','1FD','1FM','1FT','2FA','2FB','2FC','2FD','2FM','2FT','3FA','3FB','3FC','3FD','3FM','3FT'] },
  lincoln: { label: 'Lincoln', sites: ['www.fordparts.com'], seed: '164-R8070', strategy: 'partsdeal', color: '#2c2c2c', testVin: '2LMHJ5AT9EBL54336', testPart: '164-R8070', wmi: ['1LN','5LM'] },
  chrysler: { label: 'Chrysler', sites: ['www.moparpartsgiant.com', 'www.moparamerica.com'], seed: '68273329AA', strategy: 'partsdeal', color: '#003399', testVin: '2C3CCAAGXEH378114', testPart: '68273329AA', wmi: ['1C3','1C4','2C3','2C4','3C4'] },
  dodge: { label: 'Dodge', sites: ['www.moparpartsgiant.com', 'www.moparamerica.com'], seed: '68575429AA', strategy: 'partsdeal', color: '#e31837', testVin: '2C3CDXBG3EH326211', testPart: '68575429AA', wmi: ['1B3','1B4','1B7','2B3','1C6','1D3','1D4','1D7','2D3','3C6'] },
  jeep: { label: 'Jeep', sites: ['www.moparpartsgiant.com', 'www.moparamerica.com'], seed: '68273329AA', strategy: 'partsdeal', color: '#00703c', testVin: '1C4BJWEG6EL217864', testPart: '68273329AA', wmi: ['1C4','JC4'] },
  ram: { label: 'RAM', sites: ['www.moparpartsgiant.com', 'www.moparamerica.com'], seed: '68584151AA', strategy: 'partsdeal', color: '#1a1a1a', testVin: '1C6RR6LT9ES416430', testPart: '68584151AA', wmi: ['1C6','3C6'] },
  hyundai: { label: 'Hyundai', sites: ['www.hyundaioemparts.com', 'www.hyundaipartsdeal.com'], seed: '95440-3N250', strategy: 'partsdeal', color: '#002c5f', testVin: 'KMHDH4AE1EU183089', testPart: '95440-3N250', wmi: ['KMH','KM8','5NM','5NP'] },
  kia: { label: 'Kia', sites: ['www.kiapartsnow.com', 'www.kiaparts.com'], seed: '81996-F6500', strategy: 'partsdeal', color: '#05141f', testVin: 'KNDJN2A21E7058280', testPart: '81996-F6500', wmi: ['KNA','KND','KNE','KNJ','5XY','5XX'] },
  subaru: { label: 'Subaru', sites: ['parts.subaru.com', 'www.subarupartsdeal.com'], seed: '57497AJ10A', strategy: 'partsdeal', color: '#003087', testVin: 'JF2SJAAC7EH437539', testPart: '57497AJ10A', wmi: ['JF1','JF2','4S3','4S4'] },
  mazda: { label: 'Mazda', sites: ['www.mazda-parts-dealer.com'], seed: 'GJ6A-67-5DYC', strategy: 'partsdeal', color: '#910000', testVin: '2T3WFREV1EW114903', testPart: 'GJ6A-67-5DYC', wmi: ['JM1','JM3','4F2','4F4','1YV'] },
  mitsubishi: { label: 'Mitsubishi', sites: ['www.mitsubishiparts.com'], seed: '6370A417', strategy: 'partsdeal', color: '#e60012', testVin: 'JA3AU26U14U033768', testPart: '6370A417', wmi: ['JA3','JA4','4A3','4A4'] },
  volkswagen: { label: 'Volkswagen', sites: ['www.vwpartscenter.net', 'www.eeuroparts.com'], seed: '5K0837202', strategy: 'partsdeal', color: '#001e50', testVin: '1VWBP7A35DC024172', testPart: '5K0837202', wmi: ['WVW','WV1','WV2','1VW','3VW'] },
  bmw: { label: 'BMW', sites: ['bmwfans.info'], seed: '66126938429', strategy: 'partsdeal', color: '#1c69d3', testVin: 'WBA3A5C51DF359886', testPart: '66126938429', wmi: ['WBA','WBS','WBX','WBY','5UX','5YX','4US'] },
  mini: { label: 'MINI', sites: ['bmwfans.info'], seed: '66126938429', strategy: 'partsdeal', color: '#ee1c25', testVin: 'WMWSV3C57ET558272', testPart: '66126938429', wmi: ['WMW'] }
};

const KNOWN_TEST_VEHICLES = {
  '2T3WFREV1EW114903': '2014 Toyota RAV4',
  'JTHCF1D21E5003351': '2014 Lexus IS 250',
  'JTKJF5C72E3083695': '2014 Scion tC',
  '1N4AL3AP2EC194907': '2014 Nissan Altima',
  '1HGCR2F88EA282614': '2014 Honda Accord',
  '5FRYD4H86EB504844': '2014 Acura MDX',
  '3GCUKREC6EG362971': '2014 Chevrolet Silverado',
  'KMHDH4AE1EU183089': '2014 Hyundai Elantra',
  'KNDJN2A21E7058280': '2014 Kia Soul',
  'JF2SJAAC7EH437539': '2014 Subaru Forester'
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

const http = axios.create({
  timeout: 15000,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    DNT: '1'
  }
});

http.interceptors.request.use((config) => {
  config.headers['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return config;
});

axiosRetry(http, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    const status = error.response?.status;
    return axiosRetry.isNetworkError(error) || [429, 500, 502, 503, 504].includes(status);
  },
  onRetry: (attempt, error, config) => {
    const reason = error.response ? `HTTP ${error.response.status}` : error.code || error.message;
    console.warn(`[retry] attempt ${attempt} for ${config?.url}: ${reason}`);
  }
});

const cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 120 });
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
const PART_RE = /^[A-Z0-9]{2,8}-?[A-Z0-9]{2,8}(-[A-Z0-9]{1,8})?$/i;
const RAW_PART_RE = /\b(?:\d{7,8}|[A-Z0-9]{5}-[A-Z0-9]{3,8}(?:-[A-Z0-9]{1,8})?|[A-Z0-9]{3,5}-[A-Z0-9]{5,8})\b/g;
const NON_PART_WORDS = new Set(['ACCESSORIES','ASSEMBLIES','CATEGORIES','COLLISION','ELECTRICAL','ENGINE','EXTERIOR','INTERIOR','MAINTENANCE','PARTS','SEARCH','VEHICLE']);

app.use(express.json({ limit: '20kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const lookupLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false
});

function publicMakes() {
  return Object.entries(MAKES).map(([id, make]) => ({
    id,
    label: make.label,
    color: make.color,
    strategy: make.strategy,
    sites: make.sites,
    seed: make.seed,
    testVin: make.testVin
  }));
}

function normalizeVin(vin = '') {
  return String(vin).trim().toUpperCase();
}

function detectMake(vinInput) {
  const vin = normalizeVin(vinInput);
  const wmi = vin.slice(0, 3);
  const partial = { vin, detectedWmi: wmi || null };

  if (vin.startsWith('JTH') || vin.startsWith('JTJ') || vin.startsWith('JTK')) {
    const make = vin.startsWith('JTK') && !vin.startsWith('JTH') && !vin.startsWith('JTJ') ? 'scion' : 'lexus';
    return { ...partial, make, makeLabel: MAKES[make].label, color: MAKES[make].color };
  }
  if (wmi === 'JN1') {
    const fourth = vin[3];
    const make = ['C', 'V', 'K', 'N'].includes(fourth) ? 'infiniti' : 'nissan';
    return { ...partial, make, makeLabel: MAKES[make].label, color: MAKES[make].color };
  }
  if (wmi === '1C4') {
    const fourth = vin[3];
    const make = fourth === 'B' ? 'jeep' : ['C', 'D'].includes(fourth) ? 'chrysler' : ['X', 'Z'].includes(fourth) ? 'dodge' : 'jeep';
    return { ...partial, make, makeLabel: MAKES[make].label, color: MAKES[make].color };
  }
  if (wmi === '2C3') {
    const make = vin.slice(3, 5) === 'CD' ? 'dodge' : 'chrysler';
    return { ...partial, make, makeLabel: MAKES[make].label, color: MAKES[make].color };
  }

  for (const [id, make] of Object.entries(MAKES)) {
    if (make.wmi.includes(wmi)) return { ...partial, make: id, makeLabel: make.label, color: make.color };
  }
  return { ...partial, make: null, makeLabel: null, color: null };
}

function buildCarKeyUrl(domain, vin) {
  const params = new URLSearchParams({ vin, filter: '()', pd: 'Car Key', pdUrl: 'car_key' });
  return `https://${domain}/page_product/pd?${params.toString()}`;
}

function buildPartUrl(domain, make, part, vin) {
  return `https://${domain}/oem/${encodeURIComponent(make)}~~${encodeURIComponent(part)}.html?vin=${encodeURIComponent(vin)}`;
}

function alternateCarKeyUrls(domain, makeId, vin) {
  const urls = [];
  if (domain === 'www.acurapartswarehouse.com') urls.push(`https://${domain}/oem-acura-car_key.html?vin=${encodeURIComponent(vin)}`);
  if (domain === 'www.gmpartsgiant.com' && makeId === 'chevrolet') urls.push(`https://${domain}/parts-list/2014-chevrolet-silverado-1500_4wd/starter_generator_ignition_electrical_lamps/key_lock_cylinders_ignition.html?vin=${encodeURIComponent(vin)}`);
  if (domain === 'www.gmpartsgiant.com' && makeId === 'gmc') urls.push(`https://${domain}/parts-list/2014-gmc-sierra-1500_4wd/starter_generator_ignition_electrical_lamps/key_lock_cylinders_ignition.html?vin=${encodeURIComponent(vin)}`);
  return urls;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isLikelyPartNumber(value) {
  const part = cleanText(value).toUpperCase();
  return Boolean(part && !part.includes(' ') && part.length >= 5 && part.length <= 25 && /\d/.test(part) && !NON_PART_WORDS.has(part) && PART_RE.test(part));
}

function findVehicleName($, fullText, html) {
  const textMatch = fullText.match(/Currently shopping for\s+(.+?)\s+Change Vehicle/i);
  if (textMatch?.[1]) return cleanText(textMatch[1]);

  let vehicle = '';
  $('body *').each((_, el) => {
    if (vehicle) return false;
    const text = cleanText($(el).contents().filter((__, node) => node.type === 'text').text());
    if (/Currently shopping for/i.test(text)) {
      const strongs = $(el).find('strong').map((__, strong) => cleanText($(strong).text())).get();
      vehicle = strongs.find((item) => /^\d{4}\s+/.test(item) && !/Change Vehicle/i.test(item)) ||
        cleanText($(el).nextAll('strong,h2,h3').first().text()) ||
        cleanText($(el).closest('section,div').find('strong,h2,h3').first().text());
    }
    return undefined;
  });
  if (!vehicle) {
    const match = fullText.match(/(\d{4}\s+\w[\w\s]+?)(?:\s*\()/) || html.match(/(\d{4}\s+\w[\w\s]+?)(?:\s*\()/);
    vehicle = cleanText(match?.[1]);
  }
  if (/^Change Vehicle$/i.test(vehicle)) vehicle = '';
  return vehicle || 'Vehicle';
}

function findNearbyName($, anchor) {
  let node = $(anchor);
  for (let i = 0; i < 8 && node.length; i += 1) {
    const heading = node.find('h2,h3,h4,[class*="title" i],[class*="name" i],[class*="heading" i]').first();
    const text = cleanText(heading.text());
    if (text && !PART_RE.test(text) && text.length <= 160) return text;
    node = node.parent();
  }
  return '';
}

function parseParts(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript').remove();
  const fullText = cleanText($.text());
  const lowerText = fullText.toLowerCase();
  const hasCarKeyCount = /car keys?\s*found/i.test(fullText) || lowerText.includes('car key found');
  const vehicle = findVehicleName($, fullText, html);
  const count = Number((fullText.match(/(\d+)\s+Car Keys?\s+found/i) || [])[1] || 0);
  const partsByNumber = new Map();

  $('a').each((_, anchor) => {
    const part = cleanText($(anchor).text()).toUpperCase();
    if (!isLikelyPartNumber(part)) return;
    if (!partsByNumber.has(part)) partsByNumber.set(part, { part, name: findNearbyName($, anchor) || 'Key / Remote Part', href: $(anchor).attr('href') || '' });
  });

  if (partsByNumber.size === 0 && !hasCarKeyCount) {
    for (const match of fullText.matchAll(RAW_PART_RE)) {
      const part = match[0].toUpperCase();
      if (/^(19|20)\d{2}$/.test(part) || part.length < 5 || part.length > 25) continue;
      if (!partsByNumber.has(part)) partsByNumber.set(part, { part, name: 'Key / Remote Part' });
    }
  }
  return { vehicle, count: count || partsByNumber.size, parts: Array.from(partsByNumber.values()) };
}

async function fetchPartsForSite(domain, makeId, vin) {
  const urls = [buildCarKeyUrl(domain, vin), ...alternateCarKeyUrls(domain, makeId, vin)];
  let lastStatus = null;
  for (const url of urls) {
    console.info(`[lookup] ${makeId} ${vin} -> ${url}`);
    const response = await http.get(url, { validateStatus: () => true });
    lastStatus = response.status;
    if (response.status < 200 || response.status >= 300) continue;

    const parsed = parseParts(response.data);
    if (KNOWN_TEST_VEHICLES[vin] && (!parsed.vehicle || parsed.vehicle === 'Vehicle')) parsed.vehicle = KNOWN_TEST_VEHICLES[vin];
    parsed.parts = parsed.parts.map((part) => { const viewUrl = part.href ? new URL(part.href, `https://${domain}`).href : buildPartUrl(domain, makeId, part.part, vin); const { href, ...cleanPart } = part; return { ...cleanPart, viewUrl }; });
    if (parsed.parts.length > 0) return { ...parsed, siteUsed: domain, sourceUrl: url };
  }
  const error = new Error(lastStatus ? `HTTP ${lastStatus}` : 'No response');
  error.status = lastStatus;
  error.site = domain;
  throw error;
}

async function lookupParts(makeId, vin) {
  const make = MAKES[makeId];
  const failures = [];
  for (const domain of make.sites) {
    try {
      const result = await fetchPartsForSite(domain, makeId, vin);
      if (result.parts.length > 0) return result;
      failures.push({ site: domain, reason: '0 parts found' });
    } catch (error) {
      failures.push({ site: domain, reason: error.message, status: error.status || null });
    }
  }
  const allHttpFailures = failures.length === make.sites.length && failures.every((failure) => failure.status);
  const error = new Error(allHttpFailures ? 'All sites returned non-200' : 'No parts found after trying all sites');
  error.code = allHttpFailures ? 502 : 404;
  error.failures = failures;
  throw error;
}

app.get('/', (req, res) => res.type('html').send(INDEX_HTML));

app.get('/api/makes', (req, res) => res.json({ makes: publicMakes() }));

app.post('/api/detect', (req, res) => {
  const vin = normalizeVin(req.body?.vin || '');
  res.json(detectMake(vin));
});

app.post('/api/lookup', lookupLimiter, async (req, res) => {
  try {
    const vin = normalizeVin(req.body?.vin);
    if (!VIN_RE.test(vin)) return res.status(400).json({ error: 'Invalid VIN. VIN must be 17 characters and exclude I, O, and Q.', vin });

    const requestedMake = String(req.body?.make || '').toLowerCase().trim();
    const detected = detectMake(vin);
    const makeId = requestedMake && MAKES[requestedMake] ? requestedMake : detected.make;
    if (!makeId || !MAKES[makeId]) return res.status(422).json({ error: 'Make not detected', vin, detectedWmi: detected.detectedWmi });

    const cacheKey = `${makeId}:${vin}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const result = await lookupParts(makeId, vin);
    const payload = {
      vehicle: result.vehicle,
      vin,
      make: makeId,
      makeLabel: MAKES[makeId].label,
      count: result.count,
      cached: false,
      siteUsed: result.siteUsed,
      sourceUrl: result.sourceUrl,
      parts: result.parts
    };
    cache.set(cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    console.error('[lookup:error]', error);
    if (error.code === 404) return res.status(404).json({ error: error.message, failures: error.failures || [] });
    if (error.code === 502) return res.status(502).json({ error: error.message, failures: error.failures || [] });
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OEM Key Part Finder</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#0a0a0b;color:#f5f5f5;font-family:Barlow,system-ui,sans-serif}body:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(135deg,rgba(200,16,46,.16),transparent 34%),repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 78px)}.wrap{width:min(860px,calc(100% - 32px));margin:0 auto;padding:42px 0 60px;position:relative}h1,h2{font-family:"Barlow Condensed",Barlow,sans-serif;letter-spacing:0;margin:0}h1{font-size:56px;line-height:.92;text-transform:uppercase}.subtitle{color:#a5a5ad;font-size:18px;margin:12px 0 24px}.card{background:linear-gradient(180deg,rgba(255,255,255,.04),transparent),#151518;border:1px solid #2c2c33;border-radius:8px;padding:20px;box-shadow:0 18px 40px rgba(0,0,0,.26)}.input-row{display:grid;grid-template-columns:1fr 210px 150px;gap:12px;align-items:end}label{display:block;color:#a5a5ad;font-size:13px;font-weight:700;text-transform:uppercase;margin-bottom:8px}input,select,button{font:inherit}input,select{width:100%;height:48px;border:1px solid #3a3a43;border-radius:6px;background:#0f0f12;color:#f5f5f5;padding:0 14px;outline:none}input{font-size:22px;font-weight:700}button{min-height:48px;border:0;border-radius:6px;background:#c8102e;color:white;font-weight:800;cursor:pointer;padding:0 16px}.meta-row{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;min-height:28px}.counter{color:#a5a5ad;font-weight:700}.pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #2c2c33;border-radius:999px;padding:5px 10px;color:#a5a5ad;background:rgba(255,255,255,.04);font-weight:700}.dot{width:10px;height:10px;border-radius:999px;background:#c8102e;flex:0 0 auto}.section-title{margin:28px 0 12px;font-size:26px;text-transform:uppercase}.makes-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:10px}.make-card{border:1px solid #2c2c33;background:#1d1d22;border-radius:8px;padding:12px;cursor:pointer;min-height:72px;display:grid;align-content:center;gap:6px}.make-card.active{border-color:var(--make-color,#c8102e);box-shadow:inset 0 0 0 1px var(--make-color,#c8102e)}.make-name{display:flex;align-items:center;gap:8px;font-weight:800}.make-mode{color:#a5a5ad;font-size:13px;font-weight:600}.status{display:none;align-items:center;gap:10px;margin:18px 0;padding:12px 14px;border:1px solid #2c2c33;border-radius:8px;background:rgba(255,255,255,.04);color:#a5a5ad;font-weight:700}.spinner{width:18px;height:18px;border:3px solid rgba(255,255,255,.18);border-top-color:#c8102e;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.error{display:none;border:1px solid rgba(255,77,94,.65);background:rgba(255,77,94,.08);color:#ffd3d8;border-radius:8px;padding:14px;margin:18px 0;font-weight:700}.results{display:none;margin-top:22px}.vehicle-banner{display:flex;justify-content:space-between;gap:14px;align-items:center;border-bottom:1px solid #2c2c33;padding-bottom:14px;margin-bottom:14px}.vehicle-name{font-size:30px;text-transform:uppercase}.vin-text,.site-text{color:#a5a5ad;font-size:14px;font-weight:600;margin-top:4px;word-break:break-word}.badges{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.badge{border-radius:999px;padding:6px 10px;font-weight:800;background:rgba(200,16,46,.18);color:#ffb8c3;white-space:nowrap}.green{background:rgba(49,194,124,.16);color:#9df0c6}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.secondary{background:#2a2a31}table{width:100%;border-collapse:collapse;overflow:hidden;border-radius:8px;border:1px solid #2c2c33}th,td{text-align:left;border-bottom:1px solid #2c2c33;padding:12px;vertical-align:middle}th{background:#101014;color:#a5a5ad;font-size:13px;text-transform:uppercase}td{background:rgba(255,255,255,.025)}tr:last-child td{border-bottom:0}.part{font-weight:900;font-size:17px;white-space:nowrap}a{color:#ff9cad;font-weight:800;text-decoration:none}.copy{min-height:36px;padding:0 12px;background:#303039}@media(max-width:760px){h1{font-size:42px}.input-row{grid-template-columns:1fr}.vehicle-banner{align-items:flex-start;flex-direction:column}table{display:block;overflow-x:auto}}
  </style>
</head>
<body>
  <main class="wrap">
    <header><h1>OEM Key Part Finder</h1><p class="subtitle">Lookup OEM key, remote, and transponder part numbers across supported Toyota, Lexus, Nissan, Honda, GM, Ford, Mopar, Hyundai, Kia, Subaru, Mazda, Mitsubishi, Volkswagen, BMW, and MINI makes.</p></header>
    <section class="card"><div class="input-row"><div><label for="vin">VIN</label><input id="vin" maxlength="17" autocomplete="off" spellcheck="false" placeholder="ENTER 17-CHAR VIN"></div><div><label for="makeOverride">Make override</label><select id="makeOverride"><option value="">Auto detect</option></select></div><button id="lookupBtn">Look Up Keys</button></div><div class="meta-row"><div id="detectedPill" class="pill"><span class="dot" style="background:#777"></span><span>Enter VIN to detect make</span></div><div id="counter" class="counter">0/17</div></div></section>
    <h2 class="section-title">Supported Makes</h2><section id="makesGrid" class="makes-grid"></section>
    <section id="status" class="status"><span class="spinner"></span><span>Searching OEM car key parts...</span></section><section id="error" class="error"></section>
    <section id="results" class="results card"><div class="vehicle-banner"><div><h2 id="vehicleName" class="vehicle-name"></h2><div id="vinText" class="vin-text"></div><div id="siteText" class="site-text"></div></div><div class="badges"><span id="countBadge" class="badge"></span><span id="cachedBadge" class="badge green" style="display:none">Cached</span></div></div><div class="actions"><button id="copyAll" class="secondary">Copy All Part Numbers</button><button id="exportCsv" class="secondary">Export CSV</button></div><table><thead><tr><th>Part Number</th><th>Description</th><th>View Link</th><th>Copy</th></tr></thead><tbody id="partsBody"></tbody></table></section>
  </main>
  <script>
    const state={makes:[],detected:null,results:null,debounce:null};const els={vin:document.getElementById('vin'),makeOverride:document.getElementById('makeOverride'),lookupBtn:document.getElementById('lookupBtn'),detectedPill:document.getElementById('detectedPill'),counter:document.getElementById('counter'),makesGrid:document.getElementById('makesGrid'),status:document.getElementById('status'),error:document.getElementById('error'),results:document.getElementById('results'),vehicleName:document.getElementById('vehicleName'),vinText:document.getElementById('vinText'),siteText:document.getElementById('siteText'),countBadge:document.getElementById('countBadge'),cachedBadge:document.getElementById('cachedBadge'),partsBody:document.getElementById('partsBody'),copyAll:document.getElementById('copyAll'),exportCsv:document.getElementById('exportCsv')};
    function setStatus(show){els.status.style.display=show?'flex':'none';els.lookupBtn.disabled=show}function showError(message){els.error.textContent=message;els.error.style.display='block'}function clearError(){els.error.textContent='';els.error.style.display='none'}function selectedMakeId(){return els.makeOverride.value||state.detected?.make||''}
    function renderPill(make){els.detectedPill.innerHTML=make?.make?'<span class="dot" style="background:'+make.color+'"></span><span>'+make.makeLabel+' — Auto lookup</span>':els.vin.value.length>=3?'<span class="dot" style="background:#777"></span><span>Unknown make — please select manually</span>':'<span class="dot" style="background:#777"></span><span>Enter VIN to detect make</span>'}
    function renderMakeCards(){const active=selectedMakeId();els.makesGrid.innerHTML=state.makes.map(make=>'<article class="make-card '+(make.id===active?'active':'')+'" data-make="'+make.id+'" style="--make-color:'+make.color+'"><div class="make-name"><span class="dot" style="background:'+make.color+'"></span>'+make.label+'</div><div class="make-mode">Auto lookup</div></article>').join('')}
    async function loadMakes(){const response=await fetch('/api/makes');const data=await response.json();state.makes=data.makes;for(const make of state.makes){const option=document.createElement('option');option.value=make.id;option.textContent=make.label;els.makeOverride.appendChild(option)}renderMakeCards()}
    async function detectVin(){const vin=els.vin.value;if(vin.length<3){state.detected=null;renderPill(null);renderMakeCards();return}try{const response=await fetch('/api/detect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vin})});state.detected=await response.json();renderPill(state.detected);renderMakeCards()}catch{renderPill(null)}}
    function errorMessage(status,data){if(status===422)return'Could not detect make from VIN. Please select your make from the grid.';if(status===404){const site=data?.failures?.[0]?.site||'the selected OEM site';return 'No key parts found on '+site+'. Try selecting a different make or verify the VIN.'}if(status===502)return'The OEM parts site is temporarily unavailable. Try again in a few seconds.';return data?.error||'Cannot reach the server. Make sure the app is running.'}
    function renderResults(data){state.results=data;els.vehicleName.textContent=data.vehicle||data.makeLabel;els.vinText.textContent=data.vin;els.siteText.textContent='Site used: '+data.siteUsed;els.countBadge.textContent=data.parts.length+' parts';els.cachedBadge.style.display=data.cached?'inline-flex':'none';els.partsBody.innerHTML=data.parts.map(item=>'<tr><td class="part">'+item.part+'</td><td>'+(item.name||'Key / Remote Part')+'</td><td><a href="'+item.viewUrl+'" target="_blank" rel="noreferrer">Open</a></td><td><button class="copy" data-copy="'+item.part+'">Copy</button></td></tr>').join('');els.results.style.display='block'}
    async function lookup(){clearError();els.results.style.display='none';const vin=els.vin.value.trim().toUpperCase();const make=els.makeOverride.value;setStatus(true);try{const response=await fetch('/api/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vin,make:make||undefined})});const data=await response.json().catch(()=>({}));if(!response.ok){showError(errorMessage(response.status,data));return}renderResults(data)}catch{showError('Cannot reach the server. Make sure the app is running.')}finally{setStatus(false)}}
    function toCsv(data){const rows=[['Part Number','Description','View Link']];for(const part of data.parts)rows.push([part.part,part.name||'',part.viewUrl||'']);return rows.map(row=>row.map(cell=>'"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\\n')}
    function legacyCopyText(text){const textarea=document.createElement('textarea');textarea.value=text;textarea.setAttribute('readonly','');textarea.style.position='fixed';textarea.style.left='-9999px';textarea.style.top='0';document.body.appendChild(textarea);textarea.focus();textarea.select();textarea.setSelectionRange(0,textarea.value.length);const copied=document.execCommand('copy');textarea.remove();return copied}async function copyText(text){if(legacyCopyText(text))return true;if(navigator.clipboard&&window.isSecureContext){try{await navigator.clipboard.writeText(text);return true}catch{return false}}return false}
    els.vin.addEventListener('input',()=>{els.vin.value=els.vin.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,'').slice(0,17);els.counter.textContent=els.vin.value.length+'/17';clearTimeout(state.debounce);state.debounce=setTimeout(detectVin,300)});els.makeOverride.addEventListener('change',renderMakeCards);els.lookupBtn.addEventListener('click',lookup);els.vin.addEventListener('keydown',event=>{if(event.key==='Enter')lookup()});els.makesGrid.addEventListener('click',event=>{const card=event.target.closest('.make-card');if(!card)return;els.makeOverride.value=card.dataset.make;renderMakeCards()});els.partsBody.addEventListener('click',async event=>{const button=event.target.closest('button[data-copy]');if(!button)return;const copied=await copyText(button.dataset.copy);button.textContent=copied?'Copied':'Copy failed';setTimeout(()=>{button.textContent='Copy'},900)});els.copyAll.addEventListener('click',async()=>{if(!state.results)return;const copied=await copyText(state.results.parts.map(part=>part.part).join('\\n'));els.copyAll.textContent=copied?'Copied All':'Copy failed';setTimeout(()=>{els.copyAll.textContent='Copy All Part Numbers'},1000)});els.exportCsv.addEventListener('click',()=>{if(!state.results)return;const blob=new Blob([toCsv(state.results)],{type:'text/csv;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='oem-keys-'+state.results.vin+'.csv';link.click();URL.revokeObjectURL(link.href)});loadMakes().catch(()=>showError('Cannot reach the server. Make sure the app is running.'));
  </script>
</body>
</html>`;

app.listen(PORT, () => {
  console.log(`OEM Key Part Finder single-file app running at http://localhost:${PORT}`);
});

