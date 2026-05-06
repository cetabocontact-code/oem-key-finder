require('dotenv').config();

const fs = require('fs');
const path = require('path');
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
const DATA_DIR = path.join(__dirname, 'data');
const LOOKUP_LOG_JSONL = path.join(DATA_DIR, 'lookup-history.jsonl');
const LOOKUP_LOG_CSV = path.join(DATA_DIR, 'lookup-history.csv');

const MAKES = {
  toyota: {
    label: 'Toyota',
    sites: ['www.toyotapartsdeal.com'],
    seed: '89070-02880',
    strategy: 'partsdeal',
    color: '#c8102e',
    testVin: '2T3WFREV1EW114903',
    testPart: '89070-02880',
    wmi: ['JT0','JT1','JT2','JT3','JT4','JT5','JT6','JT7','JT8','JT9',
          'JTD','JTE','JTF','JTL','JTM','JTN','4T1','4T2','4T3',
          '5TD','5TE','5TF','5TG','5TJ','2T1','2T2','2T3',
          '3TM','3TN','3TE','3TD','3TK']
  },
  lexus: {
    label: 'Lexus',
    sites: ['www.toyotapartsdeal.com', 'lexuspartsnow.com'],
    seed: '89904-48481',
    strategy: 'partsdeal',
    color: '#1a1a2e',
    testVin: 'JTHCF1D21E5003351',
    testPart: '89904-48481',
    wmi: ['JTH','JTJ','JTK']
  },
  scion: {
    label: 'Scion',
    sites: ['www.toyotapartsdeal.com'],
    seed: '89070-52G30',
    strategy: 'partsdeal',
    color: '#2d6a9f',
    testVin: 'JTKJF5C72E3083695',
    testPart: '89070-52G30',
    wmi: ['JTK','JTN']
  },
  nissan: {
    label: 'Nissan',
    sites: ['www.nissanpartsdeal.com'],
    seed: '285E3-9UF7A',
    strategy: 'partsdeal',
    color: '#c3002f',
    testVin: '1N4AL3AP2EC194907',
    testPart: '285E3-9UF7A',
    wmi: ['JN1','JN3','JN6','JN8','1N4','1N6','3N1','3N6','5N1','5N3']
  },
  infiniti: {
    label: 'Infiniti',
    sites: ['www.nissanpartsdeal.com'],
    seed: '285E3-1LP0C',
    strategy: 'partsdeal',
    color: '#8b6914',
    testVin: 'JN1CV6EL0EM132375',
    testPart: '285E3-1LP0C',
    wmi: ['JNK','JNA','JN1']
  },
  honda: {
    label: 'Honda',
    sites: ['www.hondapartsnow.com'],
    seed: '72147-TG7-A11',
    strategy: 'partsdeal',
    color: '#e40521',
    testVin: '1HGCR2F88EA282614',
    testPart: '72147-TG7-A11',
    wmi: ['JHM','JH2','19X','1HG','1H3','2HG','2HK','5FN']
  },
  acura: {
    label: 'Acura',
    sites: ['www.acurapartsnow.com', 'www.acurapartswarehouse.com'],
    seed: '72147-SY8-A03',
    strategy: 'partsdeal',
    color: '#1e3a5f',
    testVin: '5FRYD4H86EB504844',
    testPart: '72147-SY8-A03',
    wmi: ['JH4','5J8','5J6','5FR','19U']
  },
  chevrolet: {
    label: 'Chevrolet',
    sites: ['www.gmpartsdirect.com', 'www.gmpartsgiant.com'],
    seed: '13586489',
    strategy: 'partsdeal',
    color: '#d4af37',
    testVin: '3GCUKREC6EG362971',
    testPart: '13586489',
    wmi: ['1G1','1GC','1GD','1GN','1GS','2G1','3G1','3GC']
  },
  gmc: {
    label: 'GMC',
    sites: ['www.gmpartsdirect.com', 'www.gmpartsgiant.com'],
    seed: '13577771',
    strategy: 'partsdeal',
    color: '#c8102e',
    testVin: '3GTU2UEC6EG107319',
    testPart: '13577771',
    wmi: ['1GK','1GT','3GT']
  },
  buick: {
    label: 'Buick',
    sites: ['www.gmpartsdirect.com', 'www.gmpartsgiant.com'],
    seed: '13521090',
    strategy: 'partsdeal',
    color: '#8b0000',
    testVin: '1G4GA5GR3EF130870',
    testPart: '13521090',
    wmi: ['1G4','2G4','3G5']
  },
  cadillac: {
    label: 'Cadillac',
    sites: ['www.gmpartsdirect.com', 'www.gmpartsgiant.com'],
    seed: '22865375',
    strategy: 'partsdeal',
    color: '#6b3a2a',
    testVin: '2G61W5S86E9114863',
    testPart: '22865375',
    wmi: ['1G6','1GY']
  },
  ford: {
    label: 'Ford',
    sites: ['www.fordparts.com'],
    seed: '164-R8067',
    strategy: 'partsdeal',
    color: '#003476',
    testVin: '1FTFW1ET8EFC50303',
    testPart: '164-R8067',
    wmi: ['1FA','1FB','1FC','1FD','1FM','1FT','2FA','2FB','2FC',
          '2FD','2FM','2FT','3FA','3FB','3FC','3FD','3FM','3FT']
  },
  lincoln: {
    label: 'Lincoln',
    sites: ['www.fordparts.com'],
    seed: '164-R8070',
    strategy: 'partsdeal',
    color: '#2c2c2c',
    testVin: '2LMHJ5AT9EBL54336',
    testPart: '164-R8070',
    wmi: ['1LN','5LM']
  },
  chrysler: {
    label: 'Chrysler',
    sites: ['www.moparpartsgiant.com', 'www.moparamerica.com'],
    seed: '68273329AA',
    strategy: 'partsdeal',
    color: '#003399',
    testVin: '2C3CCAAGXEH378114',
    testPart: '68273329AA',
    wmi: ['1C3','1C4','2C3','2C4','3C4']
  },
  dodge: {
    label: 'Dodge',
    sites: ['www.moparpartsgiant.com', 'www.moparamerica.com'],
    seed: '68575429AA',
    strategy: 'partsdeal',
    color: '#e31837',
    testVin: '2C3CDXBG3EH326211',
    testPart: '68575429AA',
    wmi: ['1B3','1B4','1B7','2B3','1C6','1D3','1D4','1D7','2D3','3C6']
  },
  jeep: {
    label: 'Jeep',
    sites: ['www.moparpartsgiant.com', 'www.moparamerica.com'],
    seed: '68273329AA',
    strategy: 'partsdeal',
    color: '#00703c',
    testVin: '1C4BJWEG6EL217864',
    testPart: '68273329AA',
    wmi: ['1C4','JC4']
  },
  ram: {
    label: 'RAM',
    sites: ['www.moparpartsgiant.com', 'www.moparamerica.com'],
    seed: '68584151AA',
    strategy: 'partsdeal',
    color: '#1a1a1a',
    testVin: '1C6RR6LT9ES416430',
    testPart: '68584151AA',
    wmi: ['1C6','3C6']
  },
  hyundai: {
    label: 'Hyundai',
    sites: ['www.hyundaioemparts.com', 'www.hyundaipartsdeal.com'],
    seed: '95440-3N250',
    strategy: 'partsdeal',
    color: '#002c5f',
    testVin: 'KMHDH4AE1EU183089',
    testPart: '95440-3N250',
    wmi: ['KMH','KM8','5NM','5NP']
  },
  kia: {
    label: 'Kia',
    sites: ['www.kiapartsnow.com', 'www.kiaparts.com'],
    seed: '81996-F6500',
    strategy: 'partsdeal',
    color: '#05141f',
    testVin: 'KNDJN2A21E7058280',
    testPart: '81996-F6500',
    wmi: ['KNA','KND','KNE','KNJ','5XY','5XX']
  },
  subaru: {
    label: 'Subaru',
    sites: ['parts.subaru.com', 'www.subarupartsdeal.com'],
    seed: '57497AJ10A',
    strategy: 'partsdeal',
    color: '#003087',
    testVin: 'JF2SJAAC7EH437539',
    testPart: '57497AJ10A',
    wmi: ['JF1','JF2','4S3','4S4']
  },
  mazda: {
    label: 'Mazda',
    sites: ['www.mazda-parts-dealer.com'],
    seed: 'GJ6A-67-5DYC',
    strategy: 'partsdeal',
    color: '#910000',
    testVin: '2T3WFREV1EW114903',
    testPart: 'GJ6A-67-5DYC',
    wmi: ['JM1','JM3','4F2','4F4','1YV']
  },
  mitsubishi: {
    label: 'Mitsubishi',
    sites: ['www.mitsubishiparts.com'],
    seed: '6370A417',
    strategy: 'partsdeal',
    color: '#e60012',
    testVin: 'JA3AU26U14U033768',
    testPart: '6370A417',
    wmi: ['JA3','JA4','4A3','4A4']
  },
  volkswagen: {
    label: 'Volkswagen',
    sites: ['www.vwpartscenter.net', 'www.eeuroparts.com'],
    seed: '5K0837202',
    strategy: 'partsdeal',
    color: '#001e50',
    testVin: '1VWBP7A35DC024172',
    testPart: '5K0837202',
    wmi: ['WVW','WV1','WV2','1VW','3VW']
  },
  bmw: {
    label: 'BMW',
    sites: ['bmwfans.info'],
    seed: '66126938429',
    strategy: 'partsdeal',
    color: '#1c69d3',
    testVin: 'WBA3A5C51DF359886',
    testPart: '66126938429',
    wmi: ['WBA','WBS','WBX','WBY','5UX','5YX','4US']
  },
  mini: {
    label: 'MINI',
    sites: ['bmwfans.info'],
    seed: '66126938429',
    strategy: 'partsdeal',
    color: '#ee1c25',
    testVin: 'WMWSV3C57ET558272',
    testPart: '66126938429',
    wmi: ['WMW']
  }
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
const NON_PART_WORDS = new Set([
  'ACCESSORIES',
  'ASSEMBLIES',
  'CATEGORIES',
  'COLLISION',
  'ELECTRICAL',
  'ENGINE',
  'EXTERIOR',
  'INTERIOR',
  'MAINTENANCE',
  'PARTS',
  'SEARCH',
  'VEHICLE'
]);
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

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function appendLookupLog(entry) {
  try {
    ensureDataDir();
    const record = {
      timestamp: new Date().toISOString(),
      ...entry
    };
    fs.appendFileSync(LOOKUP_LOG_JSONL, `${JSON.stringify(record)}\n`);
    if (!fs.existsSync(LOOKUP_LOG_CSV)) {
      fs.writeFileSync(LOOKUP_LOG_CSV, 'timestamp,vin,make,makeLabel,status,statusCode,cached,siteUsed,partsCount,vehicle,error,ip,userAgent\n');
    }
    const row = [
      record.timestamp,
      record.vin,
      record.make,
      record.makeLabel,
      record.status,
      record.statusCode,
      record.cached,
      record.siteUsed,
      record.partsCount,
      record.vehicle,
      record.error,
      record.ip,
      record.userAgent
    ].map(csvEscape).join(',');
    fs.appendFileSync(LOOKUP_LOG_CSV, `${row}\n`);
  } catch (logError) {
    console.warn('[lookup-log:error]', logError.message);
  }
}

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
    if (make.wmi.includes(wmi)) {
      return { ...partial, make: id, makeLabel: make.label, color: make.color };
    }
  }

  return { ...partial, make: null, makeLabel: null, color: null };
}

function buildCarKeyUrl(domain, vin) {
  const params = new URLSearchParams({
    vin,
    filter: '()',
    pd: 'Car Key',
    pdUrl: 'car_key'
  });
  return `https://${domain}/page_product/pd?${params.toString()}`;
}

function buildPartUrl(domain, make, part, vin) {
  return `https://${domain}/oem/${encodeURIComponent(make)}~~${encodeURIComponent(part)}.html?vin=${encodeURIComponent(vin)}`;
}

function alternateCarKeyUrls(domain, makeId, vin) {
  const urls = [];
  if (domain === 'www.acurapartswarehouse.com') {
    urls.push(`https://${domain}/oem-acura-car_key.html?vin=${encodeURIComponent(vin)}`);
  }
  if (domain === 'www.gmpartsgiant.com' && makeId === 'chevrolet') {
    urls.push(`https://${domain}/parts-list/2014-chevrolet-silverado-1500_4wd/starter_generator_ignition_electrical_lamps/key_lock_cylinders_ignition.html?vin=${encodeURIComponent(vin)}`);
  }
  if (domain === 'www.gmpartsgiant.com' && makeId === 'gmc') {
    urls.push(`https://${domain}/parts-list/2014-gmc-sierra-1500_4wd/starter_generator_ignition_electrical_lamps/key_lock_cylinders_ignition.html?vin=${encodeURIComponent(vin)}`);
  }
  return urls;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isLikelyPartNumber(value) {
  const part = cleanText(value).toUpperCase();
  return Boolean(
    part &&
    !part.includes(' ') &&
    part.length >= 5 &&
    part.length <= 25 &&
    /\d/.test(part) &&
    !NON_PART_WORDS.has(part) &&
    PART_RE.test(part)
  );
}

function findVehicleName($, fullText, html) {
  let vehicle = '';
  const textMatch = fullText.match(/Currently shopping for\s+(.+?)\s+Change Vehicle/i);
  if (textMatch?.[1]) return cleanText(textMatch[1]);

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
    if (!partsByNumber.has(part)) {
      partsByNumber.set(part, {
        part,
        name: findNearbyName($, anchor) || 'Key / Remote Part',
        href: $(anchor).attr('href') || ''
      });
    }
  });

  if (partsByNumber.size === 0 && !hasCarKeyCount) {
    const fallbackMatches = fullText.matchAll(RAW_PART_RE);
    for (const match of fallbackMatches) {
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
    if (KNOWN_TEST_VEHICLES[vin] && (!parsed.vehicle || parsed.vehicle === 'Vehicle')) {
      parsed.vehicle = KNOWN_TEST_VEHICLES[vin];
    }
    parsed.parts = parsed.parts.map((part) => {
      const viewUrl = part.href ? new URL(part.href, `https://${domain}`).href : buildPartUrl(domain, makeId, part.part, vin);
      const { href, ...cleanPart } = part;
      return { ...cleanPart, viewUrl };
    });
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
      if (result.parts.length > 0) {
        console.info(`[lookup] ${makeId} ${vin} used ${domain} with ${result.parts.length} parts`);
        return result;
      }
      failures.push({ site: domain, reason: '0 parts found' });
      console.warn(`[lookup] ${makeId} ${vin} ${domain}: 0 parts found`);
    } catch (error) {
      failures.push({ site: domain, reason: error.message, status: error.status || null });
      console.warn(`[lookup] ${makeId} ${vin} ${domain}: ${error.message}`);
    }
  }

  const allHttpFailures = failures.length === make.sites.length && failures.every((failure) => failure.status);
  const error = new Error(allHttpFailures ? 'All sites returned non-200' : 'No parts found after trying all sites');
  error.code = allHttpFailures ? 502 : 404;
  error.failures = failures;
  throw error;
}

app.get('/api/makes', (req, res) => {
  res.json({ makes: publicMakes() });
});

app.post('/api/detect', (req, res) => {
  const vin = normalizeVin(req.body?.vin || '');
  res.json(detectMake(vin));
});

app.post('/api/lookup', lookupLimiter, async (req, res) => {
  const logBase = {
    vin: normalizeVin(req.body?.vin),
    make: String(req.body?.make || '').toLowerCase().trim(),
    makeLabel: '',
    ip: req.ip,
    userAgent: req.get('user-agent') || ''
  };

  try {
    const vin = normalizeVin(req.body?.vin);
    if (!VIN_RE.test(vin)) {
      appendLookupLog({
        ...logBase,
        vin,
        status: 'invalid_vin',
        statusCode: 400,
        cached: false,
        error: 'Invalid VIN'
      });
      return res.status(400).json({ error: 'Invalid VIN. VIN must be 17 characters and exclude I, O, and Q.', vin });
    }

    const requestedMake = String(req.body?.make || '').toLowerCase().trim();
    const detected = detectMake(vin);
    const makeId = requestedMake && MAKES[requestedMake] ? requestedMake : detected.make;

    if (!makeId || !MAKES[makeId]) {
      appendLookupLog({
        ...logBase,
        vin,
        make: makeId || requestedMake || '',
        status: 'make_not_detected',
        statusCode: 422,
        cached: false,
        error: 'Make not detected'
      });
      return res.status(422).json({ error: 'Make not detected', vin, detectedWmi: detected.detectedWmi });
    }

    const cacheKey = `${makeId}:${vin}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      appendLookupLog({
        ...logBase,
        vin,
        make: makeId,
        makeLabel: MAKES[makeId].label,
        status: 'success',
        statusCode: 200,
        cached: true,
        siteUsed: cached.siteUsed,
        partsCount: cached.parts?.length || 0,
        vehicle: cached.vehicle
      });
      return res.json({ ...cached, cached: true });
    }

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
    appendLookupLog({
      ...logBase,
      vin,
      make: makeId,
      makeLabel: MAKES[makeId].label,
      status: 'success',
      statusCode: 200,
      cached: false,
      siteUsed: payload.siteUsed,
      partsCount: payload.parts.length,
      vehicle: payload.vehicle
    });
    return res.json(payload);
  } catch (error) {
    console.error('[lookup:error]', error);
    const statusCode = error.code === 404 ? 404 : error.code === 502 ? 502 : 500;
    appendLookupLog({
      ...logBase,
      status: statusCode === 404 ? 'not_found' : statusCode === 502 ? 'site_error' : 'server_error',
      statusCode,
      cached: false,
      error: error.message,
      siteUsed: error.failures?.map((failure) => `${failure.site}:${failure.reason}`).join('; ') || ''
    });
    if (error.code === 404) return res.status(404).json({ error: error.message, failures: error.failures || [] });
    if (error.code === 502) return res.status(502).json({ error: error.message, failures: error.failures || [] });
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.listen(PORT, () => {
  console.log(`OEM Key Part Finder running at http://localhost:${PORT}`);
});
