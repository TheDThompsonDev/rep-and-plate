# Spot assets

## In-app scene integration

Five approved scene originals are copied to `scenes/` and
`mobile/assets/spot/scenes/` for first-use onboarding and contextual moments.
They retain their native 1254 × 1254 resolution. Shared scene identity is in
`src/features/spot/scenes.ts`; introduction copy is in `model.ts` and moment/voice
copy is in `personality.ts`. Both renderers honor the saved illustration switch.
Keep source originals in Spot Studio for marketing reuse. The four-step app intro
is skippable, has Back/Next controls, and can be replayed from the web Chat menu
or native You profile without clearing records or drafts.

## Chaos collection — current creative direction

`/spot-studio/chaos/index.html` contains four new absurdist scenes: a one-walk
press conference, leg-day funeral, dinner conspiracy board and shaker ritual.
Text-free originals are 1254 × 1254; share cards are 1080 × 1350. The downloadable
pack and reusable voice/caption guide live in `public/spot-studio/chaos/`.
The creative rule is “tiny event, completely unreasonable production budget.”
This supersedes the earlier gentle tone for promotional memes. Existing art
is retained. Automatic app chat behavior is not changed by this asset pack.

Generation used the built-in image tool; exact prompts are in that collection's
`PROMPTS.md`. Export and packaging scripts accept `chaos` as an argument.
Verified filters, copied captions, scene/card/ZIP downloads and layouts at
320/390/1440px; existing story tests and web production build passed.

## Story scenes

Six complete narrative scenes based on the user's cheesecake-chat example live
at `public/spot-studio/stories/art/`. The scene collection is available at
`/spot-studio/stories/index.html`, linked from the existing studio. Each scene
has a text-free 1254 × 1254 original, a 1080 × 1350 share card, a chat setup,
Spot's response and a punchline. A separate ZIP contains all twelve PNGs,
captions, prompts and dimension records. These are creative assets for reuse;
this addition does not automatically insert teasing reactions into food logs.

Re-export with `node scripts/export-spot-stories.mjs` while the web server is
running, then package with `python scripts/package-spot-stories.py`.

## Expanded reaction library

Twelve new standalone transparent stickers live in `expansion/`, with identical
copies in `mobile/assets/spot/expansion/`. Each is natively 1254 × 1254; no
artificial upscaling. Coffee, detective, chef, blanket, calculator, groceries,
stretch, proud, water, dumbbell, shrug and planner provide reusable everyday moods.

Open `/spot-studio/index.html` for the filterable gallery, individual downloads,
copyable captions and the complete ZIP. Captioned cards are 1080 × 1080.
`public/spot-studio/usage-guide.md` includes alternate captions and suggested uses.
Exact generation prompts are in `expansion/PROMPTS.md`.

Shared app captions are in `src/features/spot/expansion.ts`; product reaction
renderers support every new pose on web and native. Chat cycles eight greetings,
food review uses detective Spot, and food processing uses calculator Spot.
Regenerate caption cards with `node scripts/export-spot-studio.mjs` while the
local web server is running (override the origin with `SPOT_STUDIO_URL`).

## Reaction / meme pack

### Corrected peeking pose

Latest quality restoration: rebuilt from the original user-supplied peeking
reference and original brand sheet, then removed the unwanted upper thumb bump.
The thumb is now a small rounded bump beneath the three curled fingers.
Verified saved dimensions: **1254 × 1254** in both platforms. The built-in image
tool returned this size despite a 2048 × 2048 request; no artificial upscaling
was applied. This replaces the repeatedly edited, visibly degraded version.

Rebuild prompt (built-in image tool): Use case: identity-preserve / fresh high-resolution reconstruction. Output a NEW pristine production-quality high resolution 2048 x 2048 PNG, native detailed rendering, true alpha transparency. Image 1 is the ORIGINAL clean peeking pose reference, image 2 is the definitive character/material reference. Reconstruct Spot from these clean originals, NOT from any previously revised output. Preserve Image 1's exact camera, curious deadpan face, eyebrow angles, cream plate face and forest-green rim, ivory vertical wall on viewer LEFT, plate peeking to viewer RIGHT, one green shoe with cream sole visible below. IMPORTANT HAND SPEC: preserve the original simple rounded glove silhouette and three curled horizontal fingers gripping the wall edge. The original small thumb bump at the TOP of the grip should instead be an equally SMALL rounded bump tucked at the BOTTOM of the grip. Four digits total: three finger lobes and one discreet thumb bump underneath. Thumb is short and subtle, roughly a third of the size of one finger, partly hidden by the wall. No long thumb, no prominent joint, no bulbous second palm or extra oval finger at bottom. The other arm hangs loosely behind the exposed right rim, with a small relaxed glove visible below, partly occluded by plate. Render afresh with pristine smooth ceramic, controlled fine green texture, clean round geometry, smooth studio lighting gradients, sharp well-antialiased edges. Restore high-detail commercial 3D character quality. NO pixelation, no painterly brush patches, no mottled low-resolution texture, no ringing, no jagged outline or white halo. Character and wall entirely in frame, centered with 7 percent padding. SINGLE character only, no text, no logo, no floor, no backdrop, no shadow outside cutout. High resolution 2048x2048 actual output, not an enlarged blurry image.

Final localized cleanup prompt: Precision cleanup on this freshly rendered Spot cutout. Preserve its crisp high quality, smooth shading and fine material detail. Correct only ONE error: there is a little green bump sticking ABOVE the three gripping fingers near the wall, at the top of the glove. Remove that UPPER bump entirely, revealing the cream plate face behind it. Leave the three large horizontal curled fingers exactly as they are. Keep the small discreet rounded bump UNDERNEATH the lowest finger; THAT is the thumb and must be the ONLY extra digit. Total hand silhouette: three horizontal finger lobes plus one small lower thumb bump, nothing above the upper finger. Keep the free arm hanging behind the plate. All other pixels, subject, pose, layout, framing and lighting unchanged. Render with maximum available native output resolution, requested 2048x2048 or greater, clean antialiased edges and true alpha transparency. No blurring, pixelation, smearing, painterly texture or added outlines. No new objects. Do not change the existing bottom thumb bump into a long thumb or large lobe.

`spot-peek.png` replaces the atlas's original peeking pose in both apps and the
caption sheet. Native copy: `mobile/assets/spot/spot-peek.png`. The original
curled grip is restored, with the pinky uppermost and the thumb underneath.
The grip has four total digits: three curled fingers and the bottom thumb.
The free arm hangs down behind the exposed plate rim. This is a standalone
transparent square revised with the built-in image tool. Other reactions
continue using the original atlas.

Correction prompts:

Latest thumb-shape refinement (built-in image tool): Use case: precise-object-edit. Edit ONLY the bottom digit of the green hand gripping the ivory wall in this supplied image. The hand currently reads as four parallel stacked fingers; the bottom digit MUST become an unmistakable OPPOSABLE THUMB. Keep exactly THREE horizontal curled fingers at the top, unchanged. REMOVE the fourth horizontal oval finger at the bottom. Replace it with a distinct, shorter stout THUMB rooted on the LOWER RIGHT SIDE OF THE PALM, projecting diagonally LEFT AND UP across the front/underside of the grip at about 45 degrees, with a rounded thumb tip, a visible thumb knuckle and a fleshy rounded thumb-base mound. Make a clear V-shaped web crease between thumb and lowest finger. Thumb should be visibly rotated relative to the three horizontal fingers, not parallel with them, and thumb base must remain below all three fingers. Its tip presses the wall edge from the opposing side, making a believable gripping hand. This is a cartoon glove with FOUR digits total: three curled fingers plus one anatomically distinct thumb underneath. Do not merely shorten the existing oval; visibly change its orientation and attachment into an opposed thumb. Preserve EVERY other element exactly: face, wall, plate rim, shoe, dangling background arm, texture, lighting and framing. Preserve true alpha transparency. No text. This is a localized glove anatomy correction only.

Latest four-digit refinement: Use case: precise-object-edit. Make ONE tiny localized edit to this exact transparent peeking Spot image: the wall-gripping green glove currently has FIVE visible rounded digits (four stacked fingers plus the bottom thumb). Change it to FOUR TOTAL DIGITS: exactly THREE curled fingers stacked horizontally, plus ONE small opposable THUMB at the BOTTOM, for four visible lobes total. Remove one of the middle fingers and reshape the grip slightly shorter to fit naturally. Topmost finger is the smallest/pinky, then middle and index below it; thumb stays underneath the lowest finger, slightly angled upward. Keep the original curled grip around the wall edge, never a flat palm and never a thumb at the top. Preserve EVERYTHING ELSE exactly: the hanging background arm and glove, face and expression, ivory wall, green rim, single visible shoe, lighting, proportions, pose and composition. Do not add new arms or fingers. Keep true alpha transparency, square canvas, no text or background. Four total visible digits on gripping hand, counting the thumb.

Use case: precise-object-edit. Edit target: the ORIGINAL top-left peeking Spot pose in this atlas. Output ONLY that one pose as a standalone square transparent image. Return to exactly the original pose: Spot behind the ivory vertical wall on viewer LEFT, half his cream dinner-plate face peeking out to viewer RIGHT with the same raised eyebrows and tiny deadpan mouth, one shoe visible below, ONE green glove gripping and curling around the wall's RIGHT VERTICAL EDGE at lower cheek height. Keep original composition and grip, NOT a flat palm on the wall and NO arm crossing in front of his face. Make precisely these two changes: (1) Flip the GRIPPING HAND'S anatomy vertically from the original: the small curled PINKY is the TOPMOST finger, then ring, middle and index stacked below, with the THUMB at the very BOTTOM of the grip curving upward from underneath. Finger pads wrap HORIZONTALLY around the edge as in original; NO fingers pointing upward, NO thumb at the top, NO waving. Gripping wrist and arm are mostly hidden behind wall/plate as originally. (2) The OTHER arm is now partially visible hanging relaxed straight DOWN in the BACKGROUND behind the plate's exposed right rim, with a small relaxed glove near his hip just above the shoe. It must clearly be behind the plate, partly occluded by rim, not in front, not reaching to wall. Preserve all other identity, forest green textured rim, ivory ceramic face, gloved hands, shoes with cream soles, lighting and proportions. True alpha transparent background. No text, no captions, no floor or shadow outside character, no additional poses. Full pose fits inside square image with clear padding. EXACTLY TWO ARMS: the mostly hidden wall-gripping arm, and the partly visible relaxed background arm.

Precise localized edit of the supplied single peeking Spot. Keep the entire image identical except for the glove gripping the wall. The dangling background arm is now correct: preserve it exactly. The grip still has an incorrect little thumb bump ABOVE the horizontal fingers. REMOVE THAT TOP BUMP COMPLETELY. Rebuild this small glove with FOUR horizontal rounded fingers stacked vertically: top pinky shortest, second ring, third middle longest, fourth index, all curling leftward around the wall edge. Add a distinct small THUMB protruding from the BOTTOM of the glove, pointing LEFT and slightly UP underneath the lowest index finger. The TOP silhouette must start with a horizontal curled pinky, never a separate upward protrusion. The BOTTOM silhouette must show the separate opposable thumb. Think of rotating the original grip upside down but keeping the wrist behind the wall. NO raised fingers. NO palm flat on wall. Keep pose, face, wall, shoe, background arm, lighting, dimensions and true alpha transparency unchanged. Only fix the hand; exact same image otherwise.


`spot-reactions.png` is a 1254 × 1254 transparent atlas, generated with the built-in
image tool using the user's peeking/tired Spot reference. Native copy:
`mobile/assets/spot/spot-reactions.png`. Columns split at 50%; rows split at 52%.
`spotReactionFrame` keeps complete poses visible without neighboring-cell bleed.

| Pose | Position | Caption / use |
| --- | --- | --- |
| Peeking | Top left | Always here. (In a supportive way.) |
| Exhausted | Top right | Still here. Small steps count. Dramatic sighs optional. |
| Burger joy | Bottom left | Good food. Great plot. Personally, I’m invested in the sandwich. |
| Sunglasses | Bottom right | Look at us. Being all organized and stuff. |

Reusable caption sheet: `docs/design/spot-moods.html` and `spot-moods.png`.
The HTML retains editable, accessible captions; the PNG is ready to share.
Product captions live in `src/features/spot/personality.ts` for both platforms.

### Reaction pack generation prompt

Use case: stylized-concept. Asset type: production mascot reaction sticker atlas for Rep & Plate. Reference image is the definitive identity and cute meme expression direction for Spot. Create exactly FOUR isolated poses in a clean 2 by 2 grid, equally sized square cells, all on TRUE ALPHA TRANSPARENCY. Preserve forest green textured circular rim, creamy ceramic dinner plate face, black brows, cute black eyes, little mouth, green gloved hands and chunky green sneakers with ivory soles. Premium soft 3D render, cute expressive small friend. TOP LEFT: Spot peeking around a narrow ivory vertical door edge, half his body hidden behind it, one glove wrapped around the edge, raised eyebrow and curious deadpan expression exactly like reference. Door fits entirely in cell. TOP RIGHT: full-body comically exhausted Spot after exercise, slouched short legs, droopy eyes, pink tongue hanging out, floppy arms and three small dark green wiggly steam lines above head, exactly like reference. BOTTOM LEFT: full-body delighted Spot holding a big burger at chest height, happy closed crescent eyes, charming small smile, food enjoyment without guilt. BOTTOM RIGHT: full-body quietly smug Spot in black sunglasses giving a subtle thumbs up, other glove on hip. Same visual scale, face occupies at least 45 percent of each cell, each complete pose entirely within its cell with 10 percent padding so none touch neighboring cells. NO captions or text, NO backgrounds, no gradient, no panels, no outside shadows, no decorative floor, no additional characters. Square 1:1 image. The empty space in every cell must have real alpha transparency. All four poses show the FRONT dinner plate face.

## Original six-pose atlas

Six poses, generated with the built-in image tool from the user-provided Rep & Plate brand reference.
The atlas is 1536 × 1024 with real alpha transparency. Each cell is 512 × 512.
Use CSS positioning or a clipped native image; do not stretch individual cells.

| Pose | Column | Row | Use |
| --- | --- | --- | --- |
| Neutral | 0 | 0 | Capture |
| Welcome | 1 | 0 | Introduction, comeback |
| Rep | 2 | 0 | Training |
| Curious | 0 | 1 | Spot Check |
| Satisfied | 1 | 1 | Saved result |
| Rep with towel | 2 | 1 | Completed workout |

Native duplicate: `mobile/assets/spot/spot-atlas.png`.
Keep both files identical when updating the library. Never use expressions to judge food.

## Leaning wordmark pose

`spot-lean.png` is the dedicated transparent cutout for the header, duplicated at
`mobile/assets/spot/spot-lean.png`. Keep the wordmark as live accessible text and
position Spot's leftmost elbow on the final “e”. This pose is decorative and
respects the saved illustration preference. Generated with the built-in image tool.

Prompt: Use case: stylized-concept. Asset type: transparent character cutout for a small app wordmark. Reference image: Spot character identity and materials only. Generate ONE full-body Spot, matching exactly the ivory plate face, forest green textured circular rim, black eyebrows and eyes, green gloves and green sneakers with cream soles. Pose: relaxed friendly lean toward viewer LEFT, his arm on viewer LEFT bent with elbow projecting left and resting on an invisible ledge at roughly 48 percent image height. That forearm points upward, hand supporting the side of his face. Other hand casually on hip; feet below body, slight relaxed crossed stance. The user will position the elbow directly on the final lowercase e of a text logo to the character's left. Elbow must be the leftmost contact point and clearly visible, and character body to its right. Warm small confident smile, looking toward viewer. Premium soft studio 3D render exactly matching reference. Single square image, entire character fills 90 percent height, small even clear padding. True alpha transparent background, no backdrop, no gradient, no floor, no external shadow. NO letters, no wordmark, no ledge or supporting object, no extra characters. Only the isolated mascot.

## Generation prompt

Use case: stylized-concept. Asset type: production mascot sprite atlas for Rep & Plate. Input image is the definitive character reference for Spot, preserve his exact forest-green textured rim, cream ceramic dinner-plate face, expressive black eyebrows, tiny black eyes and mouth, green glove hands, short legs and chunky green sneakers with cream soles. Create one transparent PNG atlas in exactly 3 columns and 2 rows, six equal square cells, no gutters. Each character fits entirely inside its own cell with 12 percent clear padding, same scale, centered. Top left: front three-quarter view, calm deadpan smile, arms relaxed. Top middle: front view, friendly small wave. Top right: BACK view, green gym weight plate with center metal hole and grip cutouts, embossed REP & PLATE and 45 LB, same arms legs shoes, NO face on back. Bottom left: front view, one raised eyebrow, curious/questioning expression, hand on hip. Bottom middle: front view, small satisfied smile and subtle thumbs up, no celebration. Bottom right: BACK view weight plate, slightly tired proud posture with a cream gym towel over one shoulder, NO face on back. Premium soft studio-lit 3D character render matching reference. No backgrounds, no floor, no cast shadow outside character, no panels, no captions, no extra symbols or props. Actual alpha transparency in every cell. No leaves. Output landscape 3:2 aspect ratio.
