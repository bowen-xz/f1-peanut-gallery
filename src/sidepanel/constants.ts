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
  // Drivers — last name
  "Verstappen:2", "Hamilton:2", "Leclerc:2", "Norris:2", "Piastri:2",
  "Sainz:2", "Alonso:2", "Russell:2", "Perez:2", "Stroll:2",
  "Gasly:2", "Ocon:2", "Bottas:2", "Tsunoda:2", "Ricciardo:2",
  "Magnussen:2", "Hulkenberg:2", "Albon:2", "Bearman:2", "Doohan:2",
  "Antonelli:2", "Hadjar:2", "Lawson:2", "Bortoleto:2", "Colapinto:2",

  // Drivers — first name
  "Max:1", "Lewis:2", "Charles:2", "Lando:2", "Oscar:2",
  "Carlos:2", "Fernando:2", "George:2", "Checo:1", "Sergio:1", "Lance:1",
  "Pierre:1", "Esteban:1", "Valtteri:1", "Yuki:2", "Daniel:1",
  "Kevin:1", "Nico:1", "Alexander:1", "Oliver:1", "Jack:1",
  "Kimi:2", "Isack:2", "Liam:1", "Gabriel:1", "Franco:2",

  // Drivers — full name
  "Max Verstappen:2", "Lewis Hamilton:2", "Charles Leclerc:2", "Lando Norris:2", "Oscar Piastri:2",
  "Carlos Sainz:2", "Fernando Alonso:2", "George Russell:2", "Sergio Perez:2", "Lance Stroll:2",
  "Pierre Gasly:2", "Esteban Ocon:2", "Valtteri Bottas:2", "Yuki Tsunoda:2", "Daniel Ricciardo:2",
  "Kevin Magnussen:2", "Nico Hulkenberg:2", "Alexander Albon:2", "Oliver Bearman:2", "Jack Doohan:2",
  "Kimi Antonelli:2", "Isack Hadjar:2", "Liam Lawson:2", "Gabriel Bortoleto:2", "Franco Colapinto:2",

  // Teams
  "Ferrari:2", "McLaren:2", "Mercedes:2", "Haas:2", "Sauber:2",
  "Alpine:2", "Williams:2", "Scuderia:1",

  // Team principals & key personnel
  "Horner:2", "Wolff:2", "Vasseur:2", "Newey:2",

  // Race events & flags
  "DRS:2", "VSC:2", "DNF:2",
  "safety car:2", "virtual safety car:2", "formation lap:2",
  "drive-through:2", "podium:2",
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
  "brake duct:2", "brake bias:2", "ride height:2", "wing angle:2",

  // Championship
  "constructor championship:2", "driver championship:2",
  "championship leader:2", "points gap:2",

  // Circuits
  "hairpin:1", "chicane:1", "apex:1",
  
];

// ── Insights ───────────────────────────────────────────────────────────────
export const GEMINI_MODEL = "gemini-2.5-flash";
export const INSIGHT_INTERVAL_MS = 60_000;
export const TRANSCRIPT_WINDOW_MS = 30_000; // last N ms of final segments sent to Gemini

import type { InsightType } from "../shared/types";

export const INSIGHT_PROMPTS: Record<Exclude<InsightType, "meme">, (transcript: string) => string> = {
  engineering: (t) => `F1 broadcast transcript:\n${t}\n\nSearch the internet for a specific technical detail about a team this weekend (upgrade, tyre choice, car setup). Explain what it is and why it matters right now. Write for someone new to F1. Under 60 words.`,
  "driver-drama": (t) => `F1 broadcast transcript:\n${t}\n\nFind one specific fact about the driver or team in focus right now — or a historical F1 moment that connects — and connect it to the current moment. Write for someone new to F1, Under 60 words.`,
  news: (t) => `F1 broadcast transcript:\n${t}\n\nSearch for one specific recent news detail from this race weekend (qualifying, practice, team news) that is relevant right now. Explain it clearly to a new F1 fan. Under 60 words.`,
  strategy: (t) => `F1 broadcast transcript:\n${t}\n\nExplain the strategy decision happening right now— i.e what are teams/drivers trying to achieve and what is their plan, what the team chose to do with tyres or pit stops and why it matters, etc. Plain English for a new F1 fan. Under 60 words.`,
};

export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  engineering: "⚙️ Engineering",
  "driver-drama": "🍿 Drama",
  news: "📰 News",
  strategy: "📋 Strategy",
  meme: "🐸 Meme",
};
