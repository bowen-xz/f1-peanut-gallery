// ── Capture ────────────────────────────────────────────────────────────────
export const RECORDER_CHUNK_MS = 250;

export const DEEPGRAM_PARAMS: Record<string, string> = {
  model: "nova-2",
  language: "en",
  interim_results: "true",
  punctuate: "true",
  smart_format: "true",
};

export const F1_KEYWORDS = [
  // Drivers
  "Verstappen:2", "Hamilton:2", "Leclerc:2", "Norris:2", "Piastri:2",
  "Sainz:2", "Alonso:2", "Russell:2", "Perez:2", "Stroll:2",
  "Gasly:2", "Ocon:2", "Bottas:2", "Tsunoda:2", "Ricciardo:2",
  "Magnussen:2", "Hulkenberg:2", "Albon:2", "Bearman:2", "Doohan:2",
  "Antonelli:2", "Hadjar:2", "Lawson:2", "Bortoleto:2", "Colapinto:2",

  // Teams
  "Ferrari:2", "McLaren:2", "Mercedes:2", "Haas:2", "Sauber:2",
  "Alpine:2", "Williams:2", "Scuderia:1",

  // Team principals & key personnel
  "Horner:2", "Wolff:2", "Vasseur:2", "Newey:2", "Lambiase:2",
  "Bonnington:2",

  // Race events & flags
  "DRS:2", "VSC:2", "DNF:2", "DNS:2", "DSQ:2", "FCY:2",
  "safety car:2", "virtual safety car:2", "formation lap:2",
  "parc ferme:2", "drive-through:2", "podium:2",
  "pole position:2", "fastest lap:2", "chequered flag:2",
  "yellow flag:2", "red flag:2", "blue flag:2",
  "track limits:2", "lap deleted:2", "stewards:2",
  "investigation:1", "penalty:2", "time penalty:2",
  "grid penalty:2", "gearbox penalty:2",

  // Pit & strategy
  "undercut:2", "overcut:2", "outlap:2", "inlap:2",
  "pit stop:2", "pit lane:2", "pit wall:2", "pit window:2",
  "one-stop:2", "two-stop:2", "three-stop:2",
  "stint:2", "lap delta:2", "gap management:2",
  "DRS train:2", "DRS zone:2", "DRS detection:2",

  // Tyres
  "softs:2", "mediums:2", "hards:2", "intermediates:2", "wets:2",
  "slicks:1", "Pirelli:2", "graining:2", "blistering:2",
  "degradation:2", "deg:2", "tyre wear:2", "tyre life:2",
  "tyre cliff:2", "overheating:1", "thermal degradation:2",
  "prime:1", "option:1",

  // Power unit & technical
  "power unit:2", "ERS:2", "MGU-K:2", "MGU-H:2", "ICE:2",
  "deployment:2", "harvesting:2", "fuel load:2", "fuel mapping:2",
  "downforce:2", "oversteer:2", "understeer:2", "balance:1",
  "front wing:2", "rear wing:2", "diffuser:2", "floor:1",
  "sidepod:2", "suspension:1", "gearbox:2", "turbo:1",
  "brake duct:2", "brake bias:2", "trail braking:2",
  "rake:1", "ride height:2", "wing angle:2",

  // Championship
  "constructor championship:2", "driver championship:2",
  "WCC:2", "WDC:2", "championship leader:2", "points gap:2",

  // Circuits
  "Eau Rouge:2", "Raidillon:2", "Maggots:2", "Becketts:2",
  "Copse:2", "Stowe:2", "hairpin:1", "chicane:1", "apex:1",
  "Interlagos:2", "Monza:2", "Silverstone:2", "Suzuka:2",
  "Zandvoort:2", "Baku:2", "Jeddah:2", "Lusail:2", "Yas Marina:2",
  "Circuit de Barcelona:2", "Albert Park:2", "Miami:1",
];

// ── Insights ───────────────────────────────────────────────────────────────
export const GEMINI_MODEL = "gemini-2.5-flash";
export const INSIGHT_INTERVAL_MS = 60_000;
export const TRANSCRIPT_WINDOW_MS = 30_000; // last N ms of final segments sent to Gemini

import type { InsightType } from "../shared/types";

export const INSIGHT_PROMPTS: Record<InsightType, (transcript: string) => string> = {
  engineering: (t) => `F1 broadcast transcript:\n${t}\n\nIn 1-2 sentences, give a sharp technical insight about the engineering, tyre deg, aero, power unit, or setup decisions happening right now. Be specific and concise.`,
  "driver-drama": (t) => `F1 broadcast transcript:\n${t}\n\nIn 1-2 sentences, highlight the most interesting driver moment, mistake, battle, or radio exchange right now. Be specific and punchy.`,
  drama: (t) => `F1 broadcast transcript:\n${t}\n\nIn 1-2 sentences, capture the main drama or storyline unfolding right now. Be direct and punchy.`,
  standings: (t) => `F1 broadcast transcript:\n${t}\n\nIn 1-2 sentences, explain what the current race situation means for the drivers' or constructors' championship standings. Be specific.`,
  strategy: (t) => `F1 broadcast transcript:\n${t}\n\nIn 1-2 sentences, analyse the key strategy play happening right now — pit windows, undercuts, overcuts, tyre choices. Be specific.`,
};

export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  engineering: "⚙️ Engineering",
  "driver-drama": "🎭 Driver",
  drama: "🔥 Drama",
  standings: "🏆 Standings",
  strategy: "📋 Strategy",
};
