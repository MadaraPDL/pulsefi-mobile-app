export type PulseFiThemeMode = "light" | "dark";

export type PulseFiColors = {
  mode: PulseFiThemeMode;
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  primary: string;
  primaryStrong: string;
  successBackground: string;
  successBorder: string;
  successText: string;
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
  buttonText: string;
};

export const pulseFiLightColors: PulseFiColors = {
  mode: "light",
  background: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF4FA",
  text: "#102033",
  textMuted: "#5D6B7A",
  textSubtle: "#6B7888",
  border: "#E3EAF2",
  primary: "#00A7D8",
  primaryStrong: "#102033",
  successBackground: "#ECFDF3",
  successBorder: "#ABEFC6",
  successText: "#067647",
  dangerBackground: "#FFF3F0",
  dangerBorder: "#FFD1C7",
  dangerText: "#8A2E1B",
  buttonText: "#FFFFFF",
};

export const pulseFiDarkColors: PulseFiColors = {
  mode: "dark",
  background: "#050B14",
  surface: "#08111F",
  surfaceMuted: "#101B2C",
  text: "#F8FBFF",
  textMuted: "#A8B6C7",
  textSubtle: "#93A4B8",
  border: "#1E2A3B",
  primary: "#00D1FF",
  primaryStrong: "#00A7D8",
  successBackground: "#062C20",
  successBorder: "#0E7A55",
  successText: "#7BF0B4",
  dangerBackground: "#35130F",
  dangerBorder: "#8A2E1B",
  dangerText: "#FFB4A8",
  buttonText: "#FFFFFF",
};
