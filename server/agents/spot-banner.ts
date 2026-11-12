import { spotPoseImages } from './spot-poses.ts';

// Spot's pose and line at the top of an assistant card. Shared by the coaching card and the small
// card on the basic tools. Tool data only chooses which built-in pose to show and supplies text,
// which enters through textContent; the images themselves are fixed data URIs.

export const spotBannerStyle = String.raw`
.spot{display:flex;align-items:flex-end;gap:12px;margin:4px 0 12px}.spot[hidden]{display:none}.spot img{width:96px;height:96px;flex:none;object-fit:contain}.spot img[hidden]{display:none}
.spot-bubble{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin-bottom:22px;max-width:520px}
.spot-bubble::before{content:"";position:absolute;left:-7px;bottom:16px;width:12px;height:12px;background:var(--surface);border-left:1px solid var(--line);border-bottom:1px solid var(--line);transform:rotate(45deg)}
.spot-bubble p{margin:0;font-size:15px;line-height:1.45}.spot-bubble small{display:block;margin-top:4px;font-size:11px;font-weight:700;letter-spacing:1px;color:var(--accent)}
`;

export const spotBannerMarkup = `<section id="spot" class="spot" aria-label="Spot" hidden><img id="spot-pose" alt="" width="96" height="96" hidden><div class="spot-bubble"><p id="spot-says"></p><small>SPOT</small></div></section>`;

/** Defines renderSpot(spot) in the card's script. */
export const spotBannerScript = String.raw`
  const SPOT_POSES = ${JSON.stringify(spotPoseImages)};
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
