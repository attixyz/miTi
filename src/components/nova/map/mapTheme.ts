// Shared map styling — single source of truth for tile URLs, attribution and
// pin colors so the events map (/map) and the event detail map (/event/[id])
// stay visually identical across light/dark theme.

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const STADIA_ATTRIBUTION =
  '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_THEME = {
  light: {
    tiles: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    pin: "#7c2db1",
    ring: "#fbf8ff",
    radius: "#7c2db1",
    user: "#00677f",
  },
  dark: {
    tiles: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    attribution: STADIA_ATTRIBUTION,
    pin: "#e9b3ff",
    ring: "#1e1a20",
    radius: "#e9b3ff",
    user: "#4cd6ff",
  },
} as const;
