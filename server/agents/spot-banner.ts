import { spotPoseImages } from './spot-poses.ts';

// Spot's pose and line at the top of an assistant card. Shared by the coaching card and the small
// card on the basic tools. Tool data only chooses which built-in pose to show and supplies text,
// which enters through textContent; the images themselves are fixed data URIs.

export const spotBannerStyle = String.raw`
.spot{display:flex;align-items:center;gap:12px;margin:8px 0 16px}.spot[hidden]{display:none}.spot img{width:56px;height:56px;flex:none;object-fit:contain}.spot img[hidden]{display:none}
.spot-bubble{min-width:0;max-width:540px}.spot-bubble p{margin:0;font-size:14px;line-height:1.5;overflow-wrap:anywhere}.spot-bubble small{display:block;margin-top:4px;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--accent)}
:root[data-theme=light]{--bg:transparent;--surface:#f2f7f3;--ink:#173d31;--muted:#526e61;--line:#d5e5da;--accent:#006249}
:root[data-theme=dark]{--bg:transparent;--surface:#1d2b23;--ink:#e5f3e9;--muted:#b1c9ba;--line:#385343;--accent:#86d3ac}
`;

export const spotBannerMarkup = `<section id="spot" class="spot" aria-label="Spot" hidden><img id="spot-pose" alt="" width="56" height="56" hidden><div class="spot-bubble"><p id="spot-says"></p><small>SPOT</small></div></section>`;

/** Defines renderSpot(spot) in the card's script. */
export const spotBannerScript = String.raw`
  const SPOT_POSES = ${JSON.stringify(spotPoseImages)};
  function applyHostTheme(context) {
    if (context && (context.theme === 'light' || context.theme === 'dark')) {
      document.documentElement.dataset.theme = context.theme;
      document.documentElement.style.colorScheme = context.theme;
    }
  }
  function renderSpot(value) {
    const box = document.getElementById('spot'); if (!box) return;
    const spot = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const says = typeof spot.says === 'string' ? spot.says.slice(0, 280) : '';
    if (!says) { box.hidden = true; return; }
    const image = document.getElementById('spot-pose');
    const pose = typeof spot.pose === 'string' && Object.prototype.hasOwnProperty.call(SPOT_POSES, spot.pose) ? spot.pose : '';
    if (pose) { image.src = SPOT_POSES[pose]; image.alt = 'Spot, ' + pose; image.hidden = false; } else { image.removeAttribute('src'); image.alt = ''; image.hidden = true; }
    document.getElementById('spot-says').textContent = says;
    box.hidden = false;
  }
`;
