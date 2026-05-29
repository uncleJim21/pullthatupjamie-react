// Tape skin — static ticker watchlists per view subject.
//
// Prices, daily change %, and sparkline series are pulled LIVE from Yahoo
// Finance once and frozen into this file for the demo (Potemkin: real numbers
// at bake time, not a live feed). Each card click-throughs to Yahoo Finance via
// the `yahoo` URL slug.

export interface TapeTicker {
  symbol: string;
  name: string;
  price: string;     // formatted; may include unit (%, etc.)
  change: number;    // signed daily percent
  spark: number[];   // up to ~10 recent daily closes
  yahoo: string;     // URL slug after /quote/  (e.g. 'GLD', '%5ETNX', 'DX-Y.NYB', 'CL%3DF')
}


// Arc — Gromen (debt / Treasuries / gold)
export const TICKERS_ARC_GROMEN: TapeTicker[] = [
  { symbol: "GLD"    , name: "SPDR Gold Trust"                 , price: "417.91"   , change:  1.25, spark: [417.29, 418.43, 411.5, 417.4, 416.99, 413.82, 414.0, 408.49, 412.77, 417.91], yahoo: "GLD" },
  { symbol: "TLT"    , name: "20+ Yr Treasury ETF"             , price: "85.68"    , change: -0.07, spark: [83.66, 83.56, 83.02, 83.91, 84.22, 84.68, 85.1, 85.3, 85.74, 85.68], yahoo: "TLT" },
  { symbol: "US10Y"  , name: "US 10-Year Yield"                , price: "4.44%"    , change: -0.43, spark: [4.59, 4.62, 4.67, 4.57, 4.59, 4.56, 4.49, 4.48, 4.45, 4.44], yahoo: "%5ETNX" },
  { symbol: "DXY"    , name: "US Dollar Index"                 , price: "98.89"    , change: -0.13, spark: [99.27, 98.97, 99.3, 99.11, 99.19, 99.32, 99.17, 99.21, 99.02, 98.89], yahoo: "DX-Y.NYB" },
  { symbol: "SLV"    , name: "iShares Silver Trust"            , price: "68.28"    , change: -0.12, spark: [69.04, 69.94, 66.9, 68.73, 69.45, 68.36, 69.72, 67.5, 68.36, 68.28], yahoo: "SLV" },
  { symbol: "GDX"    , name: "VanEck Gold Miners ETF"          , price: "89.00"    , change:  2.09, spark: [87.35, 87.14, 83.78, 86.36, 85.99, 85.02, 88.5, 85.44, 87.18, 89.0], yahoo: "GDX" },
];

// Dossier — El-Erian (Fed / inflation / growth)
export const TICKERS_DOSSIER_ELERIAN: TapeTicker[] = [
  { symbol: "SPY"    , name: "S&P 500 ETF"                     , price: "755.82"   , change:  0.16, spark: [739.17, 738.65, 733.73, 741.25, 742.72, 745.64, 750.59, 750.46, 754.6, 755.82], yahoo: "SPY" },
  { symbol: "TLT"    , name: "20+ Yr Treasury ETF"             , price: "85.68"    , change: -0.07, spark: [83.66, 83.56, 83.02, 83.91, 84.22, 84.68, 85.1, 85.3, 85.74, 85.68], yahoo: "TLT" },
  { symbol: "DXY"    , name: "US Dollar Index"                 , price: "98.89"    , change: -0.13, spark: [99.27, 98.97, 99.3, 99.11, 99.19, 99.32, 99.17, 99.21, 99.02, 98.89], yahoo: "DX-Y.NYB" },
  { symbol: "VIX"    , name: "CBOE Volatility Index"           , price: "15.26"    , change: -3.05, spark: [17.82, 18.06, 17.44, 16.76, 16.7, 16.59, 17.01, 16.29, 15.74, 15.26], yahoo: "%5EVIX" },
  { symbol: "GLD"    , name: "SPDR Gold Trust"                 , price: "417.91"   , change:  1.25, spark: [417.29, 418.43, 411.5, 417.4, 416.99, 413.82, 414.0, 408.49, 412.77, 417.91], yahoo: "GLD" },
  { symbol: "QQQ"    , name: "Nasdaq-100 ETF"                  , price: "737.05"   , change:   0.2, spark: [708.93, 705.88, 701.53, 713.15, 714.51, 717.54, 730.28, 729.45, 735.6, 737.05], yahoo: "QQQ" },
];

// Dossier — Mike Green (passive / Mag-7 concentration)
export const TICKERS_DOSSIER_GREEN: TapeTicker[] = [
  { symbol: "NVDA"   , name: "NVIDIA"                          , price: "216.88"   , change:  1.23, spark: [225.32, 222.32, 220.61, 223.47, 219.51, 215.33, 214.86, 212.6, 214.25, 216.88], yahoo: "NVDA" },
  { symbol: "MSFT"   , name: "Microsoft"                       , price: "442.18"   , change:  3.56, spark: [421.92, 423.54, 417.42, 421.06, 419.09, 418.57, 416.03, 412.67, 426.99, 442.18], yahoo: "MSFT" },
  { symbol: "AAPL"   , name: "Apple"                           , price: "310.41"   , change: -0.67, spark: [300.23, 297.84, 298.97, 302.25, 304.99, 308.82, 308.33, 310.85, 312.51, 310.41], yahoo: "AAPL" },
  { symbol: "SPY"    , name: "S&P 500 ETF"                     , price: "755.82"   , change:  0.16, spark: [739.17, 738.65, 733.73, 741.25, 742.72, 745.64, 750.59, 750.46, 754.6, 755.82], yahoo: "SPY" },
  { symbol: "IWM"    , name: "Russell 2000 ETF"                , price: "289.48"   , change: -0.87, spark: [277.6, 275.97, 273.0, 279.87, 282.49, 285.12, 290.51, 290.37, 292.03, 289.48], yahoo: "IWM" },
  { symbol: "VIX"    , name: "CBOE Volatility Index"           , price: "15.26"    , change: -3.05, spark: [17.82, 18.06, 17.44, 16.76, 16.7, 16.59, 17.01, 16.29, 15.74, 15.26], yahoo: "%5EVIX" },
];

// Brief — oil & the Strait of Hormuz
export const TICKERS_BRIEF_OIL: TapeTicker[] = [
  { symbol: "CL=F"   , name: "WTI Crude (front)"               , price: "87.25"    , change: -1.86, spark: [105.42, 108.66, 107.77, 98.26, 96.35, 96.6, 93.89, 88.68, 88.9, 87.25], yahoo: "CL%3DF" },
  { symbol: "BNO"    , name: "Brent Oil Fund"                  , price: "50.40"    , change: -1.81, spark: [57.69, 57.65, 58.81, 55.64, 55.56, 55.0, 53.1, 51.14, 51.33, 50.4], yahoo: "BNO" },
  { symbol: "USO"    , name: "US Oil Fund"                     , price: "128.69"   , change:  -1.6, spark: [148.23, 149.29, 152.96, 144.27, 142.54, 140.92, 137.0, 131.03, 130.78, 128.69], yahoo: "USO" },
  { symbol: "XOM"    , name: "Exxon Mobil"                     , price: "145.59"   , change: -0.94, spark: [157.92, 160.49, 162.55, 156.28, 155.29, 154.92, 149.81, 147.9, 146.96, 145.59], yahoo: "XOM" },
  { symbol: "XLE"    , name: "Energy Sector ETF"               , price: "56.41"    , change: -0.94, spark: [59.44, 60.58, 61.29, 59.8, 59.13, 59.49, 57.85, 56.99, 56.95, 56.42], yahoo: "XLE" },
  { symbol: "XOP"    , name: "Oil & Gas E&P ETF"               , price: "163.37"   , change: -0.96, spark: [174.13, 176.21, 178.56, 174.73, 170.65, 171.95, 166.1, 163.36, 164.96, 163.37], yahoo: "XOP" },
];

// Split — the AI bubble
export const TICKERS_SPLIT_AI: TapeTicker[] = [
  { symbol: "NVDA"   , name: "NVIDIA"                          , price: "216.88"   , change:  1.23, spark: [225.32, 222.32, 220.61, 223.47, 219.51, 215.33, 214.86, 212.6, 214.25, 216.88], yahoo: "NVDA" },
  { symbol: "META"   , name: "Meta Platforms"                  , price: "625.73"   , change:  -1.5, spark: [614.23, 611.21, 602.61, 605.06, 607.38, 610.26, 612.34, 635.26, 635.29, 625.73], yahoo: "META" },
  { symbol: "MSFT"   , name: "Microsoft"                       , price: "442.18"   , change:  3.56, spark: [421.92, 423.54, 417.42, 421.06, 419.09, 418.57, 416.03, 412.67, 426.99, 442.18], yahoo: "MSFT" },
  { symbol: "GOOGL"  , name: "Alphabet"                        , price: "382.19"   , change: -2.04, spark: [396.78, 396.94, 387.66, 388.91, 387.66, 382.97, 388.88, 388.83, 390.13, 382.19], yahoo: "GOOGL" },
  { symbol: "AVGO"   , name: "Broadcom"                        , price: "435.91"   , change:  2.19, spark: [425.19, 420.71, 411.07, 417.76, 414.57, 414.14, 422.01, 421.86, 426.58, 435.91], yahoo: "AVGO" },
  { symbol: "AMD"    , name: "Advanced Micro Devices"          , price: "505.82"   , change: -2.37, spark: [424.1, 420.99, 414.05, 447.58, 449.59, 467.51, 503.89, 495.54, 518.09, 505.82], yahoo: "AMD" },
];

/** Lookup for the Dossier action (the only one with multiple subjects). */
export function tickersForDossier(person: string): TapeTicker[] {
  const q = person.toLowerCase();
  if (q.includes('erian')) return TICKERS_DOSSIER_ELERIAN;
  if (q.includes('green')) return TICKERS_DOSSIER_GREEN;
  return [];
}
