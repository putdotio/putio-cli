import { ansi } from "./ansi.js";

const LOGO_ROWS = ["█▀█ █ █ ▀█▀   █ █▀█", "█▀▀ █▄█  █  ■ █ █▄█"] as const;

const paintRow = (row: string) => {
  let output = "";

  for (const character of row) {
    if (character === " ") {
      output += " ";
      continue;
    }

    if (character === "■") {
      output += ansi.yellowBold(character);
      continue;
    }

    output += ansi.whiteBold(character);
  }

  return output;
};

export const renderPutioSignature = () => LOGO_ROWS.map(paintRow).join("\n");
