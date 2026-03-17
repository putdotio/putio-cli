const RESET = "\u001B[0m";
const BOLD = "\u001B[1m";
const DIM = "\u001B[2m";
const WHITE = "\u001B[97m";
const YELLOW = "\u001B[33m";
const RED = "\u001B[31m";

export const ansi = {
  bold: (value: string) => `${BOLD}${value}${RESET}`,
  dim: (value: string) => `${DIM}${value}${RESET}`,
  red: (value: string) => `${RED}${value}${RESET}`,
  redBold: (value: string) => `${BOLD}${RED}${value}${RESET}`,
  white: (value: string) => `${WHITE}${value}${RESET}`,
  whiteBold: (value: string) => `${BOLD}${WHITE}${value}${RESET}`,
  yellow: (value: string) => `${YELLOW}${value}${RESET}`,
  yellowDim: (value: string) => `${DIM}${YELLOW}${value}${RESET}`,
  yellowBold: (value: string) => `${BOLD}${YELLOW}${value}${RESET}`,
};
