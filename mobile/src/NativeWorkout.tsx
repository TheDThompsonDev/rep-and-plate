import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { type Exercise } from "../../src/domain";
import {
  adjustWorkoutExercise,
  displayLoad,
  storedLoad,
  recordSet,
  startPlan,
  workoutPlans,
  reopenWorkout,
  reopenHistoryWorkout,
  finishWorkout,
  moveWorkoutExercise,
  exerciseTechnique,
  saveWorkoutRoutine,
  startWorkoutRoutine,
  deleteWorkoutRoutine,
  startWorkoutRest,
  endWorkoutRest,
  applyLoadToRemainingSets,
} from "../../src/workouts";
import { addActivity } from "../../src/activities";
import { setLoad, setWorkoutLoad } from "../../src/features/progress/set-loads";
import { useHealth } from "./store";
import { Button, Card, Choice, Field, Screen, Sheet, Sources, s } from "./ui";

export function NativeWorkout() {
  const h = useHealth(),
    w = h.state!.workout,
    unit = h.state!.profile.workoutUnit ?? "lb";
  const [focus, setFocus] = useState(0),
    [finish, setFinish] = useState(false),
    [adjust, setAdjust] = useState(false),
    [showTechnique, setShowTechnique] = useState(false);
  const [activity, setActivity] = useState(false),
    [activityTitle, setActivityTitle] = useState("Walk"),
    [activityDate, setActivityDate] = useState(h.day),
    [minutes, setMinutes] = useState(""),
    [activityId, setActivityId] = useState<string | null>(null),
    [removeActivity, setRemoveActivity] = useState(false);
  const [sessionLimit, setSessionLimit] = useState(12),
    [activityLimit, setActivityLimit] = useState(8);
  const [savingRoutine, setSavingRoutine] = useState(false),
    [routineName, setRoutineName] = useState(""),
    [routineId, setRoutineId] = useState<string | null>(null),
    [deletingRoutine, setDeletingRoutine] = useState(false);
  const routine = w.routines?.find((r) => r.id === routineId);
  const active = Math.min(focus, Math.max(0, w.exercises.length - 1)),
    e = w.exercises[active];
  const technique = e ? exerciseTechnique(e.name) : undefined;
  const sessions = [
    ...(w.history ?? []).map((session, index) => ({ session, index })),
    ...(w.status === "finished" ? [{ session: w, index: -1 }] : []),
  ]
    .filter((x) => x.session.finishedAt)
    .reverse();
  return (
    <Screen>
      <Text style={s.eyebrow}>YOUR MOVEMENT</Text>
      <Text style={s.title}>
        {w.status === "active" ? w.title : "Your training log"}
      </Text>
      <Choice
        values={["lb", "kg"]}
        value={unit}
        onChange={(v) =>
          h.change((s) => ({
            ...s,
            profile: { ...s.profile, workoutUnit: v as "lb" | "kg" },
          }))
        }
      />
      {w.status !== "active" && (
        <Text style={s.tiny}>
          Choose the units on your equipment. A rep is one repetition; a set is
          a group of reps. This is a training log, not individualized technique
          coaching.
        </Text>
      )}
      {w.status !== "active" ? (
        <>
          {!!w.routines?.length && (
            <Text style={s.h2}>Your saved routines</Text>
          )}
          {w.routines?.map((r) => (
            <Button
              key={r.id}
              label={`Review routine: ${r.name}`}
              secondary
              onPress={() => {
                setRoutineId(r.id);
                setDeletingRoutine(false);
              }}
            />
          ))}
          <Button
            label="Build my workout"
            onPress={() => h.setTool("workout")}
          />
          <Text style={s.muted}>
            Starter templates have no prescribed load. Choose a comfortable load
            for each set before saving; enter 0 for bodyweight. Get qualified
            instruction for unfamiliar movements.
          </Text>
          {workoutPlans.map((p) => (
            <Card key={p.id}>
              <Text style={s.h2}>{p.title}</Text>
              <Text style={s.muted}>
                {p.exercises.map((e) => e.name).join(" · ")}
              </Text>
              <Button
                label={`Start ${p.title}`}
                onPress={() => {
                  if (
                    h.change((s) => ({
                      ...s,
                      workout: startPlan(s.workout, p.id),
                    }))
                  )
                    setFocus(0);
                }}
              />
            </Card>
          ))}
        </>
      ) : (
        <>
          <Text style={s.muted}>
            Jump to any exercise when equipment is busy. Unlogged sets stay
            unknown.
          </Text>
          <Choice
            values={w.exercises.map((_, i) => String(i))}
            labels={Object.fromEntries(
              w.exercises.map((e, i) => [String(i), `${i + 1}. ${e.name}`]),
            )}
            value={String(active)}
            onChange={(v) => setFocus(Number(v))}
          />
          {e && (
            <Card>
              <Text style={s.h2}>{e.name}</Text>
              <Text style={s.muted}>
                {e.sets.length} sets × {e.target} target reps
              </Text>
              {e.sets.map((reps, j) => (
                <CompactSet
                  key={`${w.startedAt}:${active}:${e.name}:${j}:${reps}:${setLoad(e, j)}:${unit}`}
                  exercise={e}
                  index={j}
                  unit={unit}
                  onSave={(weight, reps, effort) =>
                    h.change((s) => {
                      const workout = recordSet(
                        setWorkoutLoad(s.workout, active, j, weight),
                        active,
                        j,
                        reps,
                        undefined,
                        unit,
                      );
                      return {
                        ...s,
                        workout: {
                          ...workout,
                          exercises: workout.exercises.map((x, i) =>
                            i === active
                              ? {
                                  ...x,
                                  setEffort: x.sets.map((_, k) =>
                                    k === j
                                      ? effort
                                      : (x.setEffort?.[k] ?? null),
                                  ),
                                }
                              : x,
                          ),
                        },
                      };
                    })
                  }
                  onApplyLoad={(weight) =>
                    h.change((s) => ({
                      ...s,
                      workout: applyLoadToRemainingSets(
                        s.workout,
                        active,
                        j,
                        weight,
                      ),
                    }))
                  }
                />
              ))}
              <View style={s.row}>
                <View style={s.grow}>
                  <Button
                    label="Move earlier"
                    secondary
                    disabled={active === 0}
                    onPress={() => {
                      if (
                        h.change((s) => ({
                          ...s,
                          workout: moveWorkoutExercise(
                            s.workout,
                            active,
                            active - 1,
                          ),
                        }))
                      )
                        setFocus(active - 1);
                    }}
                  />
                </View>
                <View style={s.grow}>
                  <Button
                    label="Move later"
                    secondary
                    disabled={active === w.exercises.length - 1}
                    onPress={() => {
                      if (
                        h.change((s) => ({
                          ...s,
                          workout: moveWorkoutExercise(
                            s.workout,
                            active,
                            active + 1,
                          ),
                        }))
                      )
                        setFocus(active + 1);
                    }}
                  />
                </View>
              </View>
              <Button
                label="Adjust or substitute exercise"
                secondary
                onPress={() => setAdjust(true)}
              />
              <Button
                label="Exercise guidance"
                secondary
                onPress={() => setShowTechnique(true)}
              />
            </Card>
          )}
          <RestTimer />
          <Button
            label="Use voice"
            secondary
            onPress={() => h.setTool("voice")}
          />
          <Button label="Finish workout" onPress={() => setFinish(true)} />
        </>
      )}
      {(w.status === "active" || w.status === "finished") && (
        <Button
          label="Save workout as a routine"
          secondary
          onPress={() => {
            setRoutineName(w.title ?? "My routine");
            setSavingRoutine(true);
          }}
        />
      )}
      <Button
        label="Log a walk or cardio"
        secondary
        onPress={() => {
          setActivityId(null);
          setRemoveActivity(false);
          setActivityTitle("Walk");
          setActivityDate(h.day);
          setMinutes("");
          setActivity(true);
        }}
      />
      <Text style={s.h2}>Your recent sessions</Text>
      {(h.state!.activities ?? [])
        .slice(-activityLimit)
        .reverse()
        .map((a) => (
          <Card key={a.id}>
            <Text style={s.h3}>{a.title}</Text>
            <Text style={s.muted}>
              {a.day} · {a.minutes} minutes
            </Text>
            <Button
              label={`Edit ${a.title} on ${a.day}`}
              secondary
              onPress={() => {
                setActivityId(a.id);
                setRemoveActivity(false);
                setActivityTitle(a.title);
                setActivityDate(a.day);
                setMinutes(String(a.minutes));
                setActivity(true);
              }}
            />
          </Card>
        ))}
      {(h.state!.activities?.length ?? 0) > activityLimit && (
        <Button
          label="Load older activities"
          secondary
          onPress={() => setActivityLimit((n) => n + 12)}
        />
      )}
      {!sessions.length && (
        <Text style={s.muted}>Your saved loads and reps will appear here.</Text>
      )}
      {sessions.slice(0, sessionLimit).map(({ session, index }) => (
        <Card key={`${session.startedAt}:${index}`}>
          <Text style={s.h3}>{session.title}</Text>
          <Text style={s.muted}>{session.finishedAt?.slice(0, 10)}</Text>
          {session.exercises.map((ex, i) => (
            <View key={i}>
              <Text style={s.text}>{ex.name}</Text>
              <Text style={s.muted}>
                {ex.sets
                  .map((reps, j) =>
                    reps === null
                      ? `Set ${j + 1}: not logged`
                      : `Set ${j + 1}: ${displayLoad(setLoad(ex, j), unit)} ${unit} × ${reps} reps${ex.setEffort?.[j] ? ` · RPE ${ex.setEffort[j]}` : ""}`,
                  )
                  .join(" · ")}
              </Text>
            </View>
          ))}
          <Button
            label={`Correct ${session.title}`}
            secondary
            disabled={w.status === "active"}
            onPress={() => {
              if (
                h.change((s) => ({
                  ...s,
                  workout:
                    index === -1
                      ? reopenWorkout(s.workout)
                      : reopenHistoryWorkout(s.workout, index),
                }))
              )
                setFocus(0);
            }}
          />
        </Card>
      ))}
      {sessions.length > sessionLimit && (
        <Button
          label="Load older workouts"
          secondary
          onPress={() => setSessionLimit((n) => n + 12)}
        />
      )}
      {w.status === "active" && sessions.length > 0 && (
        <Text style={s.tiny}>
          Finish the active session before reopening a previous session.
        </Text>
      )}
      {savingRoutine && (
        <Sheet
          title="Save reusable routine"
          onClose={() => setSavingRoutine(false)}
        >
          <Text style={s.muted}>
            Save exercise order, set counts and target reps. Future sessions
            start with no completed sets and ask you to choose loads again.
          </Text>
          <Field
            label="Routine name"
            value={routineName}
            onChangeText={setRoutineName}
          />
          <Button
            label="Save routine"
            disabled={!routineName.trim() || routineName.length > 100}
            onPress={() => {
              if (
                h.change((s) => ({
                  ...s,
                  workout: saveWorkoutRoutine(s.workout, routineName),
                }))
              ) {
                setSavingRoutine(false);
                h.setNotice("Routine saved for your next workout.");
              }
            }}
          />
        </Sheet>
      )}
      {routine && (
        <Sheet
          title={`Review ${routine.name}`}
          onClose={() => setRoutineId(null)}
        >
          <Text style={s.muted}>
            New session: no sets are recorded yet. Prior loads are reference
            only; choose a comfortable load before recording.
          </Text>
          {routine.exercises.map((ex, i) => (
            <Text key={i} style={s.text}>
              {ex.name} · {ex.setCount} sets × {ex.target} reps
              {ex.suggestedLoad !== undefined
                ? ` · Prior load ${displayLoad(ex.suggestedLoad, unit)} ${unit}`
                : ""}
            </Text>
          ))}
          <Button
            label="Start saved routine"
            onPress={() => {
              if (
                h.change((s) => ({
                  ...s,
                  workout: startWorkoutRoutine(s.workout, routine.id),
                }))
              ) {
                setFocus(0);
                setRoutineId(null);
              }
            }}
          />
          <Button
            label={
              deletingRoutine
                ? "Confirm remove routine"
                : "Remove saved routine"
            }
            secondary
            onPress={() => {
              if (!deletingRoutine) {
                setDeletingRoutine(true);
                return;
              }
              if (
                h.change((s) => ({
                  ...s,
                  workout: deleteWorkoutRoutine(s.workout, routine.id),
                }))
              )
                setRoutineId(null);
            }}
          />
        </Sheet>
      )}
      {finish && (
        <Sheet title="Review your workout" onClose={() => setFinish(false)}>
          <Text style={s.muted}>
            {w.exercises.reduce(
              (n, e) => n + e.sets.filter((r) => r !== null).length,
              0,
            )}{" "}
            sets recorded.{" "}
            {w.exercises.reduce(
              (n, e) => n + e.sets.filter((r) => r === null).length,
              0,
            )}{" "}
            sets not logged. Only recorded sets count.
          </Text>
          <Button
            label="Save finished workout"
            onPress={() => {
              if (
                h.change((s) => ({
                  ...s,
                  workout: finishWorkout(s.workout),
                }))
              )
                setFinish(false);
            }}
          />
          <Button
            label="Keep training"
            secondary
            onPress={() => setFinish(false)}
          />
          <Text style={s.tiny}>
            You can reopen this session from Your recent sessions to correct it.
          </Text>
        </Sheet>
      )}
      {adjust && e && (
        <AdjustExercise
          exercise={e}
          unit={unit}
          onClose={() => setAdjust(false)}
          onSave={(value) => {
            if (
              h.change((s) => ({
                ...s,
                workout: adjustWorkoutExercise(s.workout, active, value),
              }))
            )
              setAdjust(false);
          }}
        />
      )}
      {showTechnique && technique && (
        <Sheet title={technique.title} onClose={() => setShowTechnique(false)}>
          {technique.cues.map((cue) => (
            <Text key={cue} style={s.text}>
              {cue}
            </Text>
          ))}
          <Sources sources={[technique.source]} />
        </Sheet>
      )}
      {activity && (
        <Sheet title="Log movement" onClose={() => setActivity(false)}>
          <Field
            label="Activity"
            value={activityTitle}
            onChangeText={setActivityTitle}
          />
          <Field
            label="Activity date (YYYY-MM-DD)"
            value={activityDate}
            onChangeText={setActivityDate}
          />
          <Field
            label="Minutes"
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="decimal-pad"
          />
          <Button
            label="Save activity"
            onPress={() => {
              if (
                h.change((s) => {
                  const next = addActivity(s, {
                    title: activityTitle,
                    day: activityDate,
                    minutes: Number(minutes),
                    note: "Manual activity log",
                  });
                  return activityId
                    ? {
                        ...s,
                        activities: (s.activities ?? []).map((a) =>
                          a.id === activityId
                            ? { ...next.activities!.at(-1)!, id: activityId }
                            : a,
                        ),
                      }
                    : next;
                })
              ) {
                setActivity(false);
                setMinutes("");
              }
            }}
          />
          {activityId && (
            <Button
              label={
                removeActivity ? "Confirm remove activity" : "Remove activity"
              }
              secondary
              onPress={() => {
                if (!removeActivity) {
                  setRemoveActivity(true);
                  return;
                }
                if (
                  h.change((s) => ({
                    ...s,
                    activities: (s.activities ?? []).filter(
                      (a) => a.id !== activityId,
                    ),
                  }))
                )
                  setActivity(false);
              }}
            />
          )}
        </Sheet>
      )}
    </Screen>
  );
}

function CompactSet({
  exercise: e,
  index,
  unit,
  onSave,
  onApplyLoad,
}: {
  exercise: Exercise;
  index: number;
  unit: "lb" | "kg";
  onSave: (weight: number, reps: number, effort: number | null) => boolean;
  onApplyLoad: (weight: number) => boolean;
}) {
  const [load, setLoadText] = useState(
    e.weightConfirmed === false && e.setWeights?.[index] == null
      ? ""
      : String(displayLoad(setLoad(e, index), unit)),
  );
  const [reps, setReps] = useState(e.sets[index]?.toString() ?? "");
  const [effort, setEffort] = useState(e.setEffort?.[index]?.toString() ?? "");
  const [showEffort, setShowEffort] = useState(Boolean(e.setEffort?.[index]));
  const weight = Number(load) * (unit === "kg" ? 2.2046226218 : 1),
    count = Number(reps);
  const valid =
    load.trim() !== "" &&
    Number.isFinite(weight) &&
    weight >= 0 &&
    weight <= 2000 &&
    reps.trim() !== "" &&
    Number.isInteger(count) &&
    count >= 0 &&
    count <= 100 &&
    (!effort.trim() ||
      (Number.isFinite(Number(effort)) &&
        Number(effort) >= 1 &&
        Number(effort) <= 10));
  return (
    <View
      style={{
        gap: 8,
        borderTopWidth: 1,
        borderColor: "#deebe6",
        paddingTop: 10,
      }}
    >
      <Text style={s.h3}>
        Set {index + 1}
        {e.sets[index] !== null ? " · saved" : ""}
      </Text>
      <View style={s.row}>
        <View style={s.grow}>
          <Field
            label={`Weight (${unit})`}
            accessibilityLabel={`${e.name} set ${index + 1} weight (${unit})`}
            keyboardType="decimal-pad"
            value={load}
            onChangeText={setLoadText}
            placeholder="Choose load"
          />
        </View>
        <View style={s.grow}>
          <Field
            label="Reps"
            accessibilityLabel={`${e.name} set ${index + 1} reps`}
            keyboardType="number-pad"
            value={reps}
            onChangeText={setReps}
            placeholder={String(e.target)}
          />
        </View>
      </View>
      <Button
        label={`Save ${e.name} set ${index + 1}`}
        secondary
        disabled={!valid}
        onPress={() =>
          onSave(
            Number(load) === displayLoad(setLoad(e, index), unit) &&
              !(e.weightConfirmed === false && e.setWeights?.[index] == null)
              ? setLoad(e, index)
              : storedLoad(Number(load), unit),
            count,
            effort.trim() ? Number(effort) : null,
          )
        }
      />
      {e.sets.slice(index).some((value) => value === null) && (
        <Button
          label={`Apply set ${index + 1} load to remaining sets`}
          secondary
          disabled={
            !load.trim() ||
            !Number.isFinite(weight) ||
            weight < 0 ||
            weight > 2000
          }
          onPress={() =>
            onApplyLoad(
              Number(load) === displayLoad(setLoad(e, index), unit) &&
                !(e.weightConfirmed === false && e.setWeights?.[index] == null)
                ? setLoad(e, index)
                : storedLoad(Number(load), unit),
            )
          }
        />
      )}
      {showEffort ? (
        <>
          <Field
            label={`Set ${index + 1} effort (RPE, optional)`}
            value={effort}
            onChangeText={setEffort}
            keyboardType="decimal-pad"
          />
          <Text style={s.tiny}>
            Rate effort from 1 (very easy) to 10 (maximal). Leave blank if you
            do not track it, then save the set.
          </Text>
        </>
      ) : (
        <Button
          label={`Add effort to set ${index + 1}`}
          secondary
          onPress={() => setShowEffort(true)}
        />
      )}
    </View>
  );
}

function AdjustExercise({
  exercise: e,
  unit,
  onSave,
  onClose,
}: {
  exercise: Exercise;
  unit: "lb" | "kg";
  onClose: () => void;
  onSave: (v: Parameters<typeof adjustWorkoutExercise>[2]) => void;
}) {
  const [name, setName] = useState(e.name),
    [load, setLoadText] = useState(
      e.weightConfirmed === false ? "" : String(displayLoad(e.weight, unit)),
    ),
    [target, setTarget] = useState(String(e.target)),
    [sets, setSets] = useState(String(e.sets.length));
  const valid =
    name.trim() !== "" &&
    load.trim() !== "" &&
    Number.isFinite(Number(load)) &&
    Number(load) >= 0 &&
    Number(load) * (unit === "kg" ? 2.2046226218 : 1) <= 2000 &&
    Number.isInteger(Number(target)) &&
    Number(target) >= 1 &&
    Number(target) <= 100 &&
    Number.isInteger(Number(sets)) &&
    Number(sets) >= 1 &&
    Number(sets) <= 10;
  return (
    <Sheet title="Adjust exercise" onClose={onClose}>
      <Text style={s.muted}>
        Substitute before recording a set. Recorded sets keep their identity and
        load; adjust individual set loads in the session.
      </Text>
      <Field label="Exercise name" value={name} onChangeText={setName} />
      <Field
        label={`Starting load (${unit})`}
        value={load}
        onChangeText={setLoadText}
        keyboardType="decimal-pad"
      />
      <Field
        label="Target reps"
        value={target}
        onChangeText={setTarget}
        keyboardType="number-pad"
      />
      <Field
        label="Number of sets"
        value={sets}
        onChangeText={setSets}
        keyboardType="number-pad"
      />
      <Button
        label="Save exercise adjustment"
        disabled={!valid}
        onPress={() =>
          onSave({
            name,
            weight: storedLoad(Number(load), unit),
            target: Number(target),
            setCount: Number(sets),
          })
        }
      />
    </Sheet>
  );
}

function RestTimer() {
  const h = useHealth(),
    until = h.state!.workout.restUntil;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  const seconds = until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  return (
    <Card>
      <Text style={s.h3}>
        Rest timer{seconds !== null ? ` · ${seconds}s` : ""}
      </Text>
      <Choice
        values={["60", "90", "120"]}
        labels={{ "60": "1 minute", "90": "90 seconds", "120": "2 minutes" }}
        value=""
        onChange={(v) => {
          const time = Date.now();
          setNow(time);
          h.change((s) => ({
            ...s,
            workout: startWorkoutRest(s.workout, Number(v), time),
          }));
        }}
      />
      {until && (
        <Button
          label="Clear timer"
          secondary
          onPress={() =>
            h.change((s) => ({ ...s, workout: endWorkoutRest(s.workout) }))
          }
        />
      )}
      <Text style={s.tiny}>
        Use the rest interval in your training plan. This visual timer does not
        send background alerts.
      </Text>
    </Card>
  );
}
