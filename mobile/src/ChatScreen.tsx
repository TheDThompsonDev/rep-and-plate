import { SpotAvatar, SpotCheckHeading, SpotWelcome, SpotMoment, SpotReaction } from './Spot';
import { messageSpot, resolveWorkoutCapture } from '../../src/features/spot/model';
import { useEffect, useRef, useState } from "react";
import { FlatList, View, Text, Image, TextInput } from "react-native";
import { Camera, Mic, Send, ScanBarcode } from "lucide-react-native";
import { useHealth } from "./store";
import { Button, Card, IconButton, Sources, colors, s } from "./ui";
import { type Message } from "../../src/domain";
import {
  addProposedMeal,
  resolvePreferenceProposal,
} from "../../src/ai-client";
import { resolveRecipePortionProposal } from "../../src/features/recipes/proposals";
function ChatMessage({ message: m }: { message: Message }) {
  const h = useHealth(),
    state = h.state!;
  return (
    <View style={{ gap: 9, marginBottom: 16 }}>
      <View
        style={[
          s.row,
          {
            alignItems: "flex-start",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          },
        ]}
      >
        {m.role === "assistant" && (
          <View style={s.avatar}>
            <SpotAvatar {...messageSpot(m)} size={34}/>
          </View>
        )}
        <View style={[s.bubble, m.role === "user" && s.user, s.grow]}>
          {m.image && (
            <Image
              source={{ uri: m.image }}
              style={{ height: 220, width: "100%", borderRadius: 13 }}
              resizeMode="contain"
            />
          )}
          {!!m.text && (
            <Text selectable style={s.text}>
              {m.text}
            </Text>
          )}
          <Text style={s.tiny}>
            {m.time}
            {m.role === "user" ? "  ✓✓" : ""}
          </Text>
        </View>
      </View>
      {m.aiStatus === "error" && (
        <Card>
          <Text style={s.muted}>{m.aiError}</Text>
          <Button
            label="Retry capture"
            secondary
            disabled={h.busy}
            onPress={() => void h.send(m.text, m.image, m.id)}
          />
        </Card>
      )}
      {m.spotCheck && <Card><SpotCheckHeading/><Text style={s.muted}>I need one detail. Reply below and we’ll check it together.</Text></Card>}
      {m.workoutProposal && <Card><SpotCheckHeading side="rep"/><Text style={s.h3}>{m.workoutProposal.title}</Text><Text style={s.muted}>{m.workoutProposal.day}</Text>{m.workoutProposal.exercises.map((e,i)=><Text style={s.text} key={i}>{e.name} · {e.weight ? e.weight+' lb' : 'Bodyweight'} · {e.reps.join(', ')} reps</Text>)}<Text style={s.tiny}>{m.workoutProposal.note}</Text>{m.workoutCaptureStatus==='accepted'?<><Text style={[s.h3,{color:colors.green}]}>Logged. Workout saved.</Text><SpotMoment moment="workoutSaved"/></>:m.workoutCaptureStatus==='dismissed'?<Text style={s.muted}>Workout not saved.</Text>:<><Button label="Yep, log workout" onPress={()=>h.change(s=>resolveWorkoutCapture(s,m.id,true))}/><Button label="Fix it" secondary onPress={()=>{h.change(s=>resolveWorkoutCapture(s,m.id,false));h.setDraft('Correction to my workout: ');}}/><Button label="Not now" secondary onPress={()=>h.change(s=>resolveWorkoutCapture(s,m.id,false))}/></>}</Card>}
      {m.mealProposal && !m.mealId && (
        <Card>
          <SpotCheckHeading/><Text style={s.eyebrow}>MEAL ESTIMATE · CHECK THE PORTION</Text>
          <Text style={s.h2}>{m.mealProposal.title}</Text>
          {m.mealProposal.day && <Text style={s.muted}>For {m.mealProposal.day}</Text>}
          <Text style={[s.h2, { color: colors.green }]}>
            ~{m.mealProposal.calories} cal · {m.mealProposal.protein}g protein
          </Text>
          <Text style={s.muted}>
            {m.mealProposal.carbs}g carbs · {m.mealProposal.fat}g fat ·{" "}
            {m.mealProposal.portion}
          </Text>
          <Text style={s.muted}>{m.mealProposal.note}</Text>
          {m.mealProposal.components?.map((c, i) => (
            <Text key={i} style={s.tiny}>
              {c.name} · {c.nutrition.calories} cal
            </Text>
          ))}
          <Sources sources={m.mealProposal.sources} />
          <Button
            label={`Yep, add to ${m.mealProposal.category}`}
            onPress={() => h.change((s) => addProposedMeal(s, m.id))}
          />
          <Button label="Fix it" secondary onPress={()=>{h.setDraft(`Correction to ${m.mealProposal!.title}: `);h.change(s=>({...s,messages:s.messages.map(entry=>entry.id===m.id?{...entry,mealProposal:undefined}:entry)}));}}/>
        </Card>
      )}
      {m.mealId && (
        <><Text style={[s.muted, { color: colors.green, marginLeft: 46 }]}>
          ✓ Logged. Added to your food log
        </Text><SpotMoment moment="mealSaved"/></>
      )}
      {m.receiptId && (
        <Card>
          <Text style={s.h3}>
            {state.groceries?.find((r) => r.id === m.receiptId)?.store ??
              "Your groceries"}
          </Text>
          <Button
            secondary
            label="Review groceries"
            onPress={() => h.setTool("pantry")}
          />
        </Card>
      )}
      {m.preferenceProposal &&
        m.preferenceStatus !== "accepted" &&
        m.preferenceStatus !== "dismissed" && (
          <Card>
            <Text style={s.h3}>Remember these preferences?</Text>
            <Text style={s.muted}>{m.preferenceProposal.description}</Text>
            <Button
              label="Save preferences"
              onPress={() =>
                h.change((s) => resolvePreferenceProposal(s, m.id, true))
              }
            />
            <Button
              label="Keep current preferences"
              secondary
              onPress={() =>
                h.change((s) => resolvePreferenceProposal(s, m.id, false))
              }
            />
          </Card>
        )}
      {m.recipePortionProposal &&
        m.recipePortionProposalStatus === "pending" && (
          <Card>
            <Text style={s.h3}>Confirm your recipe portion</Text>
            <Button
              label="Log this portion"
              onPress={() =>
                h.change((s) => resolveRecipePortionProposal(s, m.id, true))
              }
            />
            <Button
              secondary
              label="Not this portion"
              onPress={() =>
                h.change((s) => resolveRecipePortionProposal(s, m.id, false))
              }
            />
          </Card>
        )}
      {m.suggestedAction && (
        <Button
          secondary
          label={`Open ${m.suggestedAction}`}
          onPress={() =>
            h.setTool(
              (
                {
                  pantry: "pantry",
                  recipes: "recipes",
                  "meal-plan": "planner",
                  preferences: "preferences",
                  shopping: "shopping",
                  workout: "workout",
                } as const
              )[m.suggestedAction!],
            )
          }
        />
      )}
      {!!m.sources?.length && <Sources sources={m.sources} />}
    </View>
  );
}
export function ChatScreen() {
  const h = useHealth(),
    list = useRef<FlatList<Message>>(null);
  const input=useRef<TextInput>(null);
  useEffect(()=>{if(h.captureRequest)input.current?.focus();},[h.captureRequest]);
  const comeback=h.spotReturning;
  const [catchup,setCatchup]=useState(false);
  const intro=h.spotIntroReplay;
  useEffect(()=>{if(h.spotIntroReplay)list.current?.scrollToOffset({offset:0,animated:false});},[h.spotIntroReplay]);
  const done=()=>{h.dismissSpotIntro();h.dismissSpotReturn();h.change(s=>({...s,spot:{...s.spot,introSeen:true}}));};
  return (
    <View style={s.fill}>
      <FlatList
        ref={list}
        data={h.state!.messages.filter(m=>m.id!=="welcome")}
        ListHeaderComponent={<><SpotWelcome key={intro ? 'intro' : 'welcome'} intro={intro} comeback={comeback} onDone={done} onCapture={()=>input.current?.focus()} onCatchup={()=>{setCatchup(true);input.current?.focus();}}/>{catchup&&<Card><Text style={s.h3}>Catch me up.</Text><Text style={s.muted}>Send one moment at a time, with its date if it wasn’t today. We’ll check uncertain details before saving.</Text><Button label="Got it" secondary onPress={()=>setCatchup(false)}/></Card>}</>}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <ChatMessage message={item} />}
        contentContainerStyle={{ padding: 18, paddingTop: 8 }}
        onContentSizeChange={() =>
          h.state!.messages.some(m=>m.role==="user") && list.current?.scrollToEnd({ animated: false })
        }
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          h.busy ? (
            <Card>
              <View style={s.row}><SpotReaction reaction="calculator" size={48}/><Text accessibilityLiveRegion="polite" style={[s.muted,s.grow]}>Got it. Tiny plate. Big thinking. {h.progress}</Text></View>
              <Button secondary label="Stop response" onPress={h.cancel} />
            </Card>
          ) : null
        }
      />
      <View
        style={[
          s.row,
          {
            gap: 0,
            padding: 8,
            borderTopWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.wash,
          },
        ]}
      >
        <IconButton label="Take a photo" onPress={() => h.setTool("capture")}>
          <Camera color={colors.muted} size={22} />
        </IconButton>
        <IconButton label="Scan a barcode" onPress={() => h.setTool("scan")}>
          <ScanBarcode color={colors.muted} size={22} />
        </IconButton>
        <TextInput
          ref={input}
          accessibilityLabel="Message Rep & Plate"
          value={h.draft}
          onChangeText={h.setDraft}
          multiline
          maxLength={4000}
          placeholder="Tell me what happened…"
          style={[
            s.field,
            {
              flex: 1,
              maxHeight: 110,
              borderRadius: 25,
              fontSize: 14,
              padding: 11,
            },
          ]}
        />
        {h.draft.trim() ? (
          <IconButton
            label="Send message"
            onPress={() => {
              if (!h.busy) {
                void h.send(h.draft);
                h.setDraft("");
              }
            }}
          >
            <Send color={colors.green} />
          </IconButton>
        ) : (
          <IconButton
            label="Record a message"
            onPress={() => h.setTool("voice")}
          >
            <Mic color={colors.green} />
          </IconButton>
        )}
      </View>
    </View>
  );
}
