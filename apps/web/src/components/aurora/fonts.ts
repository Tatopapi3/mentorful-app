import { Inter, Instrument_Serif, Lora, Sora } from "next/font/google";

const sora = Sora({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sora" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const auroraFonts = `${sora.variable} ${instrument.variable} ${inter.variable}`;

// The blend look sets headings in Lora, as Nick's pages do, with its italic for the accent word.
const lora = Lora({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-blend-serif" });
export const blendFonts = `${auroraFonts} ${lora.variable}`;
