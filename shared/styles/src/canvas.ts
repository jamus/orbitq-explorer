// Canvas drawing colors — keep in sync with CSS variable values in theme.css
export const canvasColors = {
  rocketFill: "#1e1f21", // --color-orbitq-950
  rocketStroke: "#bdbebf", // --color-orbitq-200
  thrustPlume: "#ff6f61", // --color-orbitq-red-500
  // Left/right rocket accent colors — used for margins, timeline markers, etc.
  rocketAAccent: "rgb(100, 200, 255)", // teal
  rocketAAccentSubtle: "rgba(100, 200, 255, 0.1)",
  rocketAAccentMid: "rgba(100, 200, 255, 0.4)",
  rocketBAccent: "rgb(255, 150, 100)", // orange
  rocketBAccentSubtle: "rgba(255, 150, 100, 0.1)",
  rocketBAccentMid: "rgba(255, 150, 100, 0.4)",
  timelineAxis: "#4a4b4d", // --color-orbitq-700
  timelineBackground: "rgba(18, 19, 20, 0.85)",
  timelineGoddard: "#8b8d93", // --color-orbitq-600 (muted)
  timelineToday: "rgba(255, 255, 255, 0.35)",
} as const;
