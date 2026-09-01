/**
 * Scene palettes.
 *
 * Everything the renderer draws behind and around the earthquakes lives here,
 * so the light version is a table to read rather than a hunt through five
 * modules. Dark is the default and the values are exactly what they were
 * before this file existed.
 *
 * The light side is not simply "the dark one inverted". Two things force real
 * decisions:
 *
 *   - Additive blending. It only ever brightens, so over a pale backdrop every
 *     point saturates to white and the map disappears. Light mode turns it off
 *     and the control that drives it is disabled while light is on.
 *   - The magnitude and depth ramps stay as they are, because the HTML legend
 *     reads from the same stops. Their palest stop is #ffe14d, so the light
 *     background is a cool grey rather than paper white -- enough to keep a
 *     shallow M2 visible without the view reading as grey.
 *
 * Reference lines all darken and gain opacity: a 30%-alpha powder blue that
 * reads clearly against near-black is invisible against near-white.
 */

export const THEMES = {
  dark: {
    id: 'dark',
    clear: 0x05070d,

    globeBody: 0x080c14,      // the opaque sphere the points sit on
    globeFill: 0x41608c,      // flat land tint when the basemap is "fill"
    globeCoast: [0x8fa9c6, 0.30],

    japanFill: 0x2f4a63,
    japanCoast: [0x9fc4e8, 0.70],
    japanAdmin: [0x7d93ad, 0.30],
    japanBorders: [0xa8b6c8, 0.42],

    cageStrong: [0x8fb0d6, 0.30],   // depth box edges
    cageFaint: [0x7794b8, 0.10],    // graticule inside it

    plates: 0xff8a3d,
    faults: 0xe0566e,
    marker: 0xffffff,

    additive: true,
  },

  light: {
    id: 'light',
    clear: 0xe9eff6,

    globeBody: 0xd7e2ee,
    globeFill: 0x88a5c4,
    globeCoast: [0x48688c, 0.45],

    japanFill: 0x8fabc7,
    japanCoast: [0x3d648d, 0.60],
    japanAdmin: [0x6f88a3, 0.38],
    japanBorders: [0x64809c, 0.45],

    cageStrong: [0x5d7b99, 0.38],
    cageFaint: [0x5d7b99, 0.16],

    plates: 0xd9661a,
    faults: 0xc32f4c,
    marker: 0x16294e,

    additive: false,
  },
};

/** Recolour a line/mesh object in place. `spec` is a hex or `[hex, opacity]`. */
export function paint(object, spec) {
  const material = object?.material;
  if (!material) return;
  const [hex, opacity] = Array.isArray(spec) ? spec : [spec, null];
  material.color?.set(hex);
  if (opacity != null) material.opacity = opacity;
  material.needsUpdate = true;
}
