export type ExerciseTechnique = {title:string;cues:string[];source:{title:string;url:string}};
const ace = (path:string) => ({title:'ACE exercise guide',url:`https://www.acefitness.org/resources/everyone/exercise-library/${path}/`});
const nasm = (path:string) => ({title:'NASM exercise guide',url:`https://www.nasm.org/resource-center/${path}`});
const guides: Record<string, Omit<ExerciseTechnique,'title'>> = {
  'bench press': {cues:['Set your feet firmly on the floor and keep your hips supported by the bench.','Grip the bar just outside shoulder width; lower it slowly toward your chest.','Press the bar up with control. Ask a qualified trainer to show you the setup and spotting before your first session.'],source:ace('5/chest-press')},
  'incline dumbbell press': {cues:['Keep your head, shoulders and hips supported on the incline bench, with your feet stable.','Lower the dumbbells together toward your upper chest, keeping your wrists aligned with your forearms.','Breathe out as you press upward; avoid bouncing or arching your back.'],source:ace('25/incline-chest-press')},
  'seated cable row': {cues:['Sit tall with bent knees and stable feet.','Draw your elbows back beside your ribs, bringing the handle toward your stomach.','Pause briefly, then let your arms straighten slowly without swinging your torso.'],source:ace('48/seated-row')},
  'triceps pushdown': {cues:['Use a high cable pulley. Stand tall with a small bend in your knees.','Keep your elbows beside your torso as you press the handle down.','Straighten your arms with control, then bend your elbows to return without swinging.'],source:ace('3/triceps-pressdown')},
  'goblet squat': {cues:['Hold one dumbbell or kettlebell securely at chest height.','Bend at your hips and knees while keeping your chest upright and the weight close.','Use a depth you can control, then press through your feet to stand. Keep your knees from collapsing inward.'],source:nasm('exercise-library/goblet-squat')},
  'dumbbell romanian deadlift': {cues:['Stand with a dumbbell in each hand and a small bend in your knees.','Move your hips backward, keeping your spine neutral and the weights near your legs.','Stop lowering before your back rounds; bring your hips forward to stand with control.'],source:nasm('exercise-library/dumbbell-romanian-deadlift')},
  'reverse lunge': {cues:['Stand upright with your feet around hip width and your abdomen engaged.','Step one foot backward and lower with control, keeping most of your weight in the front leg.','Push through the middle of your front foot to stand again; repeat on both sides.'],source:nasm('blog/squat-alternatives')},
  'standing calf raise': {cues:['Stand upright with feet around hip width and a small bend in your knees.','Press through the front of your feet to lift your heels.','Pause briefly, then lower your heels slowly instead of bouncing.'],source:ace('51/calf-raises')},
};
/** Exact names only: a custom variation must not inherit unsuitable exercise-specific cues. */
export function exerciseTechnique(name:string):ExerciseTechnique {
  const guide = guides[name.trim().toLowerCase()];
  return guide ? {title:name,...guide} : {title:'Before trying this exercise',cues:['Ask a qualified trainer to demonstrate this movement and check your technique.','Choose a load you can control smoothly; the app does not prescribe a starting weight.','Keep breathing, and stop if the movement causes pain.'],source:{title:'Mayo Clinic: weight training technique',url:'https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/weight-training/art-20045842'}};
}
