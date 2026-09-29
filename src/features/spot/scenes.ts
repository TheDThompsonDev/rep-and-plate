// Shared scene identity and copy; platform renderers own loading and visibility.
export const spotScenes = {
  "press-conference": {
    alt: "Spot in sunglasses addressing far too many microphones.",
    caption: "Get my publicist.",
  },
  "dinner-conspiracy": {
    alt: "Spot connecting pasta photos with red string on a conspiracy board.",
    caption: "The pasta goes all the way to the top.",
  },
  "leg-funeral": {
    alt: "Spot holding a dramatic funeral for his legs after squats.",
    caption: "Three squats. A full memorial service.",
  },
  "shaker-ritual": {
    alt: "Spot summoning a shaker bottle in a beam of golden light.",
    caption: "The prophecy is complete.",
  },
  "recovery-department": {
    alt: "Spot wrapped in a blanket, taking rest extremely seriously.",
    caption: "Head of recovery. Do not disturb.",
  },
} as const;
export type SpotSceneName = keyof typeof spotScenes;
