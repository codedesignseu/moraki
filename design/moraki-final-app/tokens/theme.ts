export const palette = {
  "day": {
    "background": "#F3F2EE",
    "card": "#FFFFFF",
    "ink": "#161412",
    "textSoft": "#5C5852",
    "line": "#E4E2DA",
    "outline": "#CFCCC3",
    "chip": "#F3F2EE",
    "selected": "#161412",
    "onSelected": "#FFFFFF",
    "buttonPrimary": "#161412",
    "onButtonPrimary": "#FFFFFF",
    "navBar": "#FFFFFF",
    "navButton": "#F3F2EE",
    "navActive": "#161412",
    "navActiveIcon": "#FFFFFF",
    "inputBorder": "#7C7973",
    "error": "#8E4434",
    "errorSurface": "#F7E3DD",
    "feed": "#F7EBC0",
    "sleep": "#F4E4DE",
    "diaper": "#E1E3F7",
    "pump": "#E0EEE7",
    "heroCircle": "#F1E1A8",
    "disabledFill": "#E4E2DA",
    "disabledText": "#5C5852",
    "toast": "#161412",
    "onToast": "#FFFFFF",
    "undo": "#F7EBC0",
    "onUndo": "#161412",
    "warning": "#F7EBC0",
    "scrim": "rgba(22,20,18,0.35)",
    "skeleton": "#E4E2DA",
    "logo": "#C9802F"
  },
  "night": {
    "background": "#171411",
    "card": "#23201C",
    "ink": "#F1EAE0",
    "textSoft": "#B8AD9F",
    "line": "#34302B",
    "outline": "#4A443D",
    "chip": "#2C2823",
    "selected": "#F1EAE0",
    "onSelected": "#171411",
    "buttonPrimary": "#F1EAE0",
    "onButtonPrimary": "#171411",
    "navBar": "#23201C",
    "navButton": "#2C2823",
    "navActive": "#F1EAE0",
    "navActiveIcon": "#171411",
    "inputBorder": "#847E76",
    "error": "#E2A693",
    "errorSurface": "#3A2420",
    "feed": "#51432A",
    "sleep": "#47343A",
    "diaper": "#33374D",
    "pump": "#2F4238",
    "heroCircle": "#5E4F31",
    "disabledFill": "#2C2823",
    "disabledText": "#B8AD9F",
    "toast": "#F1EAE0",
    "onToast": "#171411",
    "undo": "#171411",
    "onUndo": "#F1EAE0",
    "warning": "#3A3322",
    "scrim": "rgba(0,0,0,0.55)",
    "skeleton": "#2C2823",
    "logo": "#E8A55A"
  }
} as const;

export const fonts = { heading: "Comfortaa_700Bold", text: "Manrope_500Medium", textSemi: "Manrope_600SemiBold", textBold: "Manrope_700Bold", textHeavy: "Manrope_800ExtraBold" } as const;

export const type = {
  "heroNumber": {
    "fontFamily": "Comfortaa",
    "fontSize": 38,
    "fontWeight": "700"
  },
  "title": {
    "fontFamily": "Comfortaa",
    "fontSize": 30,
    "fontWeight": "700"
  },
  "sheetTitle": {
    "fontFamily": "Comfortaa",
    "fontSize": 20,
    "fontWeight": "700"
  },
  "cardTitle": {
    "fontFamily": "Comfortaa",
    "fontSize": 17,
    "fontWeight": "700"
  },
  "tileLabel": {
    "fontFamily": "Manrope",
    "fontSize": 16,
    "fontWeight": "800"
  },
  "body": {
    "fontFamily": "Manrope",
    "fontSize": 17,
    "fontWeight": "500"
  },
  "detail": {
    "fontFamily": "Manrope",
    "fontSize": 15,
    "fontWeight": "600"
  },
  "small": {
    "fontFamily": "Manrope",
    "fontSize": 13,
    "fontWeight": "600"
  }
} as const;

export const radius = {"tile": 28, "card": 28, "sheet": 32, "choice": 20, "button": 999, "chip": 999} as const;
export const size = {"minTouch": 48, "button": 60, "choiceButton": 64, "tileHeight": 132, "navBar": 68, "navButton": 52, "navBottom": 30} as const;
export const space = {"screenEdge": 18} as const;

// The logo keeps its own colours: honey deep #C9802F by day, honey #E8A55A at night.
export function isNightTime(d = new Date()) { const h = d.getHours(); return h >= 21 || h < 6; }
