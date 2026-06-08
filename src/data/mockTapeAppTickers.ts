// Tape skin — APP (AppLovin) + peer tickers for the Read In action.
//
// Baked snapshot from Yahoo Finance (same approach as mockTapeTickers.ts);
// re-run /tmp/tape_app_tickers.py to refresh before a demo.

import type { TapeTicker } from './mockTapeTickers.ts';

export const TICKER_READIN_APP_HEADER: TapeTicker = 
  { symbol: "APP", name: "AppLovin Corp", price: "613.09", change: 2.2, spark: [501.0, 492.38, 476.9, 482.28, 485.89, 481.68, 514.24, 567.83, 599.89, 613.09], yahoo: "APP" }
;

export const TICKERS_READIN_APP_PEERS: TapeTicker[] = [
  { symbol: "GOOGL", name: "Alphabet (Google Ads)", price: "380.34", change: -2.51, spark: [396.78, 396.94, 387.66, 388.91, 387.66, 382.97, 388.88, 388.83, 390.13, 380.34], yahoo: "GOOGL" },
  { symbol: "META", name: "Meta Platforms", price: "632.51", change: -0.44, spark: [614.23, 611.21, 602.61, 605.06, 607.38, 610.26, 612.34, 635.26, 635.29, 632.51], yahoo: "META" },
  { symbol: "TTD", name: "The Trade Desk", price: "21.56", change: 1.94, spark: [21.15, 22.27, 21.16, 21.02, 21.28, 22.38, 22.18, 22.29, 21.15, 21.56], yahoo: "TTD" },
  { symbol: "U", name: "Unity Software", price: "30.47", change: 1.77, spark: [27.16, 26.8, 26.2, 26.23, 25.54, 25.57, 26.77, 27.76, 29.94, 30.47], yahoo: "U" },
  { symbol: "PUBM", name: "PubMatic", price: "11.68", change: 2.1, spark: [9.72, 9.91, 10.06, 9.88, 10.21, 10.36, 10.54, 11.05, 11.44, 11.68], yahoo: "PUBM" },
];