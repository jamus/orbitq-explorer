<script setup lang="ts">
import { computed } from "vue";
import type { RocketConfig } from "@orbitq/graphql";
import { canvasColors } from "@orbitq/styles/canvas";
import { formatMaidenFlight } from "@shared/utils/formatMaidenFlight";

const props = defineProps<{
  baselineY: number;
  bandHeight: number;
  canvasWidth: number;
  rocketA: RocketConfig | null;
  rocketB: RocketConfig | null;
}>();

// ---------------------------------------------------------------------------
// Historical milestones
// ---------------------------------------------------------------------------

const MILESTONES = [
  { date: "1926-03-16", label: "First rocket" },
  // { date: "1957-10-04", label: "Sputnik 1" },
  { date: "1961-04-12", label: "Gagarin" },
  { date: "1969-07-20", label: "Apollo 11" },
  { date: "1981-04-12", label: "Space Shuttle" },
] as const;

const GODDARD_YEAR = 1926;

// ---------------------------------------------------------------------------
// Time axis
// ---------------------------------------------------------------------------

const AXIS_PADDING = 60;
const TICK_INTERVAL = 10;

function parseYear(maidenFlight: string | null | undefined): number | null {
  if (!maidenFlight) return null;
  const year = parseInt(maidenFlight.slice(0, 4), 10);
  return isNaN(year) ? null : year;
}

const currentYear = new Date().getFullYear();

const axisEndYear = computed(() => {
  const years = [
    parseYear(props.rocketA?.maidenFlight),
    parseYear(props.rocketB?.maidenFlight),
  ].filter((y): y is number => y !== null);
  return Math.max(...years, currentYear) + 2;
});

// Mirror the right-side buffer (axisEndYear - currentYear) on the left of Goddard
const axisStartYear = computed(
  () => GODDARD_YEAR - (axisEndYear.value - currentYear),
);
const axisRange = computed(() => axisEndYear.value - axisStartYear.value);

function fracYearToXPos(fracYear: number): number {
  const usableWidth = props.canvasWidth - AXIS_PADDING * 2;
  return (
    AXIS_PADDING +
    (usableWidth * (fracYear - axisStartYear.value)) / axisRange.value
  );
}

function dateStrToXPos(dateStr: string): number {
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parts[1] ? parseInt(parts[1], 10) - 1 : 0;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;
  return fracYearToXPos(year + (month * 30.44 + day) / 365.25);
}

// ---------------------------------------------------------------------------
// Layout — axis at 38% leaves room for two label rows below
// ---------------------------------------------------------------------------

const axisY = computed(() => props.baselineY + props.bandHeight * 0.38);

// Vertical offsets below the axis (shared for milestones, today)
const DATE_Y = 44; // formatted date
const LABEL_Y = 26; // descriptive label (milestones only)

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

const backgroundConfig = computed(() => ({
  x: 0,
  y: props.baselineY,
  width: props.canvasWidth,
  height: props.bandHeight,
  fill: canvasColors.timelineBackground,
  listening: false,
}));

// ---------------------------------------------------------------------------
// Axis line
// ---------------------------------------------------------------------------

const axisConfig = computed(() => ({
  points: [
    AXIS_PADDING,
    axisY.value,
    props.canvasWidth - AXIS_PADDING,
    axisY.value,
  ],
  stroke: canvasColors.timelineAxis,
  strokeWidth: 1,
  strokeScaleEnabled: false,
  listening: false,
}));

// ---------------------------------------------------------------------------
// Tick marks
// ---------------------------------------------------------------------------

const ticks = computed(() => {
  const items = [];
  const firstTick =
    Math.ceil(axisStartYear.value / TICK_INTERVAL) * TICK_INTERVAL;
  for (let y = firstTick; y <= axisEndYear.value; y += TICK_INTERVAL) {
    items.push({ x: fracYearToXPos(y), year: y });
  }
  return items;
});

const TICK_H = 4;
const TICK_LABEL_W = 36;

function tickLineConfig(x: number) {
  return {
    points: [x, axisY.value - TICK_H, x, axisY.value + TICK_H],
    stroke: canvasColors.timelineAxis,
    strokeWidth: 1,
    strokeScaleEnabled: false,
    listening: false,
  };
}

function tickYearConfig(x: number, year: number) {
  return {
    x,
    y: axisY.value - TICK_H * 3 - MILESTONE_FONT,
    offsetX: TICK_LABEL_W / 2,
    width: TICK_LABEL_W,
    text: String(year),
    fontSize: MILESTONE_FONT,
    fontFamily: "monospace",
    fill: canvasColors.timelineAxis,
    align: "center",
    listening: false,
  };
}

// ---------------------------------------------------------------------------
// Milestone markers — circle + date + descriptive label below axis
// ---------------------------------------------------------------------------

const MARKER_RADIUS = 5;
const MILESTONE_LABEL_W = 200;
const MILESTONE_FONT = 14;

function milestoneCircleConfig(x: number) {
  return {
    x,
    y: axisY.value,
    radius: MARKER_RADIUS,
    fill: canvasColors.timelineGoddard,
    listening: false,
  };
}

function milestoneDateConfig(x: number, dateStr: string) {
  return {
    x,
    y: axisY.value + DATE_Y,
    offsetX: MILESTONE_LABEL_W / 2,
    width: MILESTONE_LABEL_W,
    text: formatMaidenFlight(dateStr),
    fontSize: MILESTONE_FONT,
    fontFamily: "monospace",
    fill: canvasColors.timelineGoddard,
    align: "center",
    listening: false,
  };
}

function milestoneLabelConfig(x: number, text: string) {
  return {
    x,
    y: axisY.value + LABEL_Y,
    offsetX: MILESTONE_LABEL_W / 2,
    width: MILESTONE_LABEL_W,
    text,
    fontSize: MILESTONE_FONT,
    fontFamily: "monospace",
    lineHeight: 1.4,
    fill: canvasColors.timelineGoddard,
    align: "center",
    listening: false,
  };
}

const milestones = computed(() =>
  MILESTONES.map((m) => ({ ...m, x: dateStrToXPos(m.date) })),
);

// ---------------------------------------------------------------------------
// Today marker
// ---------------------------------------------------------------------------

const todayX = computed(() => {
  const now = new Date();
  return fracYearToXPos(
    now.getFullYear() + (now.getMonth() + now.getDate() / 31) / 12,
  );
});

const todayLineConfig = computed(() => ({
  points: [
    todayX.value,
    axisY.value - DATE_Y / 3,
    todayX.value,
    axisY.value + DATE_Y / 3,
  ],
  stroke: canvasColors.timelineToday,
  strokeWidth: 1,
  dash: [3, 3],
  strokeScaleEnabled: false,
  listening: false,
}));

// ---------------------------------------------------------------------------
// Rocket markers — circle on axis, name above, date at same level as milestones
// ---------------------------------------------------------------------------

interface RocketMarker {
  x: number;
  label: string;
  formattedDate: string;
  color: string;
  colorMid?: string;
}

const ROCKET_NAME_ABOVE = 80;
const ROCKET_DATE_ABOVE = 60;
const ROCKET_LABEL_W = 120;

function makeMarker(
  rocket: RocketConfig | null,
  color: string,
  colorMid: string,
): RocketMarker | null {
  if (!rocket?.maidenFlight) return null;
  if (parseYear(rocket.maidenFlight) === null) return null;
  return {
    x: dateStrToXPos(rocket.maidenFlight),
    label: rocket.name,
    formattedDate: formatMaidenFlight(rocket.maidenFlight),
    color,
    colorMid: colorMid,
  };
}

const markerA = computed(() =>
  makeMarker(
    props.rocketA,
    canvasColors.rocketAAccent,
    canvasColors.rocketAAccentMid,
  ),
);
const markerB = computed(() =>
  makeMarker(
    props.rocketB,
    canvasColors.rocketBAccent,
    canvasColors.rocketBAccentMid,
  ),
);

function rocketCircleConfig(m: RocketMarker) {
  return {
    x: m.x,
    y: axisY.value,
    radius: MARKER_RADIUS,
    fill: m.color,
    listening: false,
  };
}

function rocketNameConfig(m: RocketMarker) {
  return {
    x: m.x,
    y: axisY.value - ROCKET_NAME_ABOVE,
    offsetX: ROCKET_LABEL_W / 2,
    width: ROCKET_LABEL_W,
    text: m.label,
    fontSize: MILESTONE_FONT,
    fontFamily: "monospace",
    fill: m.color,
    align: "center",
    listening: false,
  };
}

function rocketDateConfig(m: RocketMarker) {
  return {
    x: m.x,
    y: axisY.value - ROCKET_DATE_ABOVE,
    offsetX: ROCKET_LABEL_W / 2,
    width: ROCKET_LABEL_W,
    text: m.formattedDate,
    fontSize: MILESTONE_FONT,
    fontFamily: "monospace",
    fill: m.colorMid,
    align: "center",
    listening: false,
  };
}
</script>

<template>
  <v-group>
    <!-- Background -->
    <v-rect :config="backgroundConfig" />

    <!-- Axis line -->
    <v-line :config="axisConfig" />

    <template v-for="tick in ticks" :key="tick.year">
      <v-line :config="tickLineConfig(tick.x)" />
      <v-text :config="tickYearConfig(tick.x, tick.year)" />
    </template>

    <template v-for="m in milestones" :key="m.date">
      <v-circle :config="milestoneCircleConfig(m.x)" />
      <v-text :config="milestoneDateConfig(m.x, m.date)" />
      <v-text :config="milestoneLabelConfig(m.x, m.label)" />
    </template>

    <v-line :config="todayLineConfig" />

    <template v-if="markerA">
      <v-circle :config="rocketCircleConfig(markerA)" />
      <v-text :config="rocketNameConfig(markerA)" />
      <v-text :config="rocketDateConfig(markerA)" />
    </template>

    <template v-if="markerB">
      <v-circle :config="rocketCircleConfig(markerB)" />
      <v-text :config="rocketNameConfig(markerB)" />
      <v-text :config="rocketDateConfig(markerB)" />
    </template>
  </v-group>
</template>
