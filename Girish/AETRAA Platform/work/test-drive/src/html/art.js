// THE LINE DRAWINGS — the platform's imagery. Architecture drawn the way a
// sheet is: thin lines, hidden edges shown, a few construction lines running
// past the corners. Drawn in currentColor, so they take the text colour of
// wherever they are put, in either theme. Plain SVG strings, built once.
//
//   BUILDING_ART   a cantilevered two-storey house, isometric (the hero)
//   SKETCH_ART     a frame of columns and slabs, two-point-ish (cards)
//
// No backticks, no "${", no backslashes in the output: these strings go into
// template literals and page scripts.

const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6);
const f = (n) => Math.round(n * 10) / 10;

// Isometric: x runs right-down, y runs left-down, z runs up.
function iso(x, y, z, k, ox, oy) { return [f(ox + (x - y) * C * k), f(oy + (x + y) * S * k - z * k)]; }

function boxEdges(b) {
  const [x0, y0, z0, x1, y1, z1] = b;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  return e.map(([a, c]) => [v[a], v[c]]);
}

// Lines to SVG, with the viewBox fitted round what was drawn (plus a margin).
function draw(lines, k) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const segs = lines.map(([a, b, cls]) => {
    const p = iso(a[0], a[1], a[2], k, 0, 0), q = iso(b[0], b[1], b[2], k, 0, 0);
    for (const [x, y] of [p, q]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
  }).join('');
  const m = 8;
  return { box: f(x0 - m) + ' ' + f(y0 - m) + ' ' + f(x1 - x0 + 2 * m) + ' ' + f(y1 - y0 + 2 * m), segs };
}

function building() {
  const L = [];
  const add = (b, cls) => boxEdges(b).forEach(([a, c]) => L.push([a, c, cls]));
  // Ground floor: a long glazed box. Upper floor: a heavier box cantilevered past it.
  add([0, 0, 0, 12, 7, 3.2]);
  add([-3, 1, 3.2, 10, 8.5, 6.6]);
  add([-3.4, 0.6, 6.6, 10.4, 8.9, 7.0]);                        // roof slab
  add([12.5, -1, 0, 16, 5, 0.25], 'faint');                     // terrace / pool edge
  // Mullions on the two faces the eye sees.
  for (let x = 1.5; x < 12; x += 1.5) L.push([[x, 0, 0], [x, 0, 3.2]]);
  for (let y = 1.4; y < 7; y += 1.4) L.push([[12, y, 0], [12, y, 3.2]]);
  for (let x = -1.5; x < 10; x += 2.6) L.push([[x, 1, 3.2], [x, 1, 6.6], 'faint']);
  L.push([[-3, 1, 4.9], [10, 1, 4.9], 'faint']);                // the upper floor's sill line
  // Construction lines past the corners, and a ground grid.
  L.push([[-6, 0, 0], [15, 0, 0], 'faint']);
  L.push([[12, -3, 0], [12, 11, 0], 'faint']);
  L.push([[-3, 1, 9.5], [-3, 1, -1.5], 'faint']);
  L.push([[10.4, 8.9, 7], [10.4, 8.9, 10], 'faint']);
  for (let i = -2; i <= 16; i += 3) L.push([[i, -3, 0], [i, 12, 0], 'grid']);
  for (let j = -3; j <= 12; j += 3) L.push([[-5, j, 0], [17, j, 0], 'grid']);
  return draw(L, 26);
}

function sketch() {
  const L = [];
  const add = (b, cls) => boxEdges(b).forEach(([a, c]) => L.push([a, c, cls]));
  add([0, 0, 0, 9, 6, 6], 'faint');
  for (let z = 0; z <= 6; z += 2) add([0, 0, z, 9, 6, z + 0.15]);    // slabs
  for (let x = 0; x <= 9; x += 3) for (let y = 0; y <= 6; y += 3) L.push([[x, y, 0], [x, y, 6]]);   // columns
  L.push([[-2, 0, 0], [12, 0, 0], 'faint']);
  L.push([[9, -2, 0], [9, 9, 0], 'faint']);
  L.push([[0, 0, 6], [0, 0, 8], 'faint']);
  return draw(L, 14);
}

const STYLE = '<style>.art line{stroke:currentColor;stroke-width:.75;vector-effect:non-scaling-stroke}' +
  '.art .faint{opacity:.45}.art .grid{opacity:.14}</style>';

const svg = (d) => '<svg class="art" viewBox="' + d.box + '" fill="none" aria-hidden="true" focusable="false" ' +
  'preserveAspectRatio="xMidYMid meet">' + STYLE + d.segs + '</svg>';
export const BUILDING_ART = svg(building());
export const SKETCH_ART = svg(sketch());
