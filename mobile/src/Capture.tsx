import { useEffect, useRef, useState } from "react";
import { Image, Text, View, Platform, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Button, Card, Field, Sheet, Sources, s } from "./ui";
import { useHealth } from "./store";
import { jsonApi } from "./api";
import { clockTime, id } from "../../src/domain";
import {
  nutritionForServing,
  normalizeGTIN,
  productLookupSchema,
  type FoodProduct,
} from "../../src/features/products/contracts";
import { captureProduct } from "../../src/features/products/actions";
import { replyToWorkout } from "../../src/workouts";

export async function pickPhoto(camera: boolean) {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Camera access is off. Choose a photo or enable Camera in your phone settings.",
      );
  }
  const result = await (
    camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
  )({ mediaTypes: ["images"], quality: 0.85, allowsEditing: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const scale = Math.min(1, 2000 / Math.max(asset.width, asset.height));
  const photo = await manipulateAsync(
    asset.uri,
    [{ resize: { width: Math.round(asset.width * scale) } }],
    { compress: 0.82, format: SaveFormat.JPEG, base64: true },
  );
  if (!photo.base64 || photo.base64.length > 4300000)
    throw new Error(
      "This photo is too large. Crop the receipt or choose a smaller image.",
    );
  return `data:image/jpeg;base64,${photo.base64}`;
}
export function Capture({ receipt = false }: { receipt?: boolean }) {
  const h = useHealth(),
    [image, setImage] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  async function choose(camera: boolean) {
    setError("");
    setBusy(true);
    try {
      const photo = await pickPhoto(camera);
      if (live.current && photo) setImage(photo);
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <Sheet
      title={receipt ? "Add a grocery receipt" : "Show me what happened"}
      onClose={() => h.setTool(null)}
    >
      <Text style={s.muted}>
        {receipt
          ? "Lay your receipt flat in good light. Include the store, items, and total."
          : "A meal photo, receipt, or screenshot. Start wherever is easiest."}
      </Text>
      {!!image && (
        <Image
          accessibilityLabel="Your photo preview"
          source={{ uri: image }}
          style={{ width: "100%", height: 280, borderRadius: 20 }}
          resizeMode="contain"
        />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.muted}>
          {error}
        </Text>
      )}
      <Button
        label={image ? "Retake photo" : "Take a photo"}
        disabled={busy}
        onPress={() => void choose(true)}
      />
      <Button
        label={image ? "Choose another photo" : "Choose a photo"}
        secondary
        disabled={busy}
        onPress={() => void choose(false)}
      />
      {!!image && (
        <>
          <Field
            label="Anything to add? (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={2000}
          />
          <Button
            label="Send to Rep & Plate"
            disabled={busy || h.busy}
            onPress={() =>
              void h.send(
                (receipt
                  ? "This is a grocery receipt for items I purchased. Identify the store and items, research nutrition and save groceries separately from meals eaten. Do not log these purchases as food eaten."
                  : "Please help me understand this photo.") +
                  (note.trim() ? ` Additional context: ${note.trim()}` : ""),
                image,
              )
            }
          />
          <Text style={s.tiny}>
            Sent to our AI provider, QwenCloud or OpenAI, for image reading and research. Review uncertain
            product matches and quantities.
          </Text>
          <Button
            label="Save image for later review"
            secondary
            onPress={() => {
              h.change((s) => ({
                ...s,
                reviews: [
                  ...s.reviews,
                  {
                    id: id(),
                    title: receipt ? "Grocery receipt" : "Photo",
                    question:
                      "Your image is saved for review. It has not changed your food log.",
                    source: `Image · ${clockTime()}`,
                    image,
                    options: ["Keep as a note"],
                    kind: "capture",
                    resolved: false,
                  },
                ],
              }));
              h.setTool(null);
            }}
          />
        </>
      )}
    </Sheet>
  );
}
export function Scanner({
  onSelect,
  onClose,
}: {
  onSelect?: (p: FoodProduct) => void;
  onClose?: () => void;
}) {
  const h = useHealth(),
    [permission, requestPermission] = useCameraPermissions(),
    [camera, setCamera] = useState(false),
    [barcode, setBarcode] = useState(""),
    [products, setProducts] = useState<FoodProduct[]>([]),
    [selected, setSelected] = useState<FoodProduct | null>(null),
    [servings, setServings] = useState("1"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const locked = useRef(false),
    operation = useRef(id()),
    abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function lookup(code = barcode) {
    if (locked.current) return;
    const gtin = normalizeGTIN(code);
    if (!gtin) {
      setError("Enter a valid UPC or EAN barcode.");
      return;
    }
    locked.current = true;
    setCamera(false);
    setBarcode(gtin);
    setBusy(true);
    setError("");
    setSelected(null);
    setProducts([]);
    try {
      const privateProduct = h.state!.products?.find((p) => p.gtin === gtin);
      if (privateProduct) {
        setProducts([privateProduct]);
        setSelected(privateProduct);
      } else {
        abort.current = new AbortController();
        const data = productLookupSchema.parse(
          await jsonApi(
            "/api/products/lookup",
            { barcode: gtin },
            abort.current.signal,
          ),
        );
        setProducts(data.products);
        if (data.products.length === 1) setSelected(data.products[0]);
        setError(data.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet title="Scan a food" onClose={onClose ?? (() => h.setTool(null))}>
      <Text style={s.muted}>
        Check the product and labeled serving before adding it.
      </Text>
      {camera && permission?.granted ? (
        <CameraView
          style={{ height: 240, borderRadius: 20 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a"] }}
          onBarcodeScanned={(result) => void lookup(result.data)}
        />
      ) : (
        <Button
          label="Open barcode camera"
          secondary
          onPress={() =>
            void (async () => {
              if (permission?.granted || (await requestPermission()).granted)
                setCamera(true);
              else
                setError(
                  "Camera permission is off. Enter the barcode below or enable Camera in Settings.",
                );
            })()
          }
        />
      )}
      <Field
        label="Barcode number"
        keyboardType="number-pad"
        value={barcode}
        onChangeText={setBarcode}
      />
      <Button
        label={busy ? "Looking up product…" : "Look up barcode"}
        disabled={busy}
        onPress={() => void lookup()}
      />
      {!!error && <Text style={s.muted}>{error}</Text>}
      {products.length > 1 &&
        products.map((p) => (
          <Button
            key={p.id}
            label={`${p.brand} ${p.name}`}
            secondary
            onPress={() => setSelected(p)}
          />
        ))}
      {selected && (
        <Card>
          <Text style={s.h2}>{selected.name}</Text>
          <Text style={s.muted}>
            {selected.brand} · {selected.serving.label}
          </Text>
          <Text style={s.muted}>Nutrition per {selected.basis}</Text>
          {Object.entries(selected.nutrition).map(([key, value]) => (
            <Text key={key} style={s.text}>
              {key}: {value ?? "Unknown"}
            </Text>
          ))}
          {selected.source.url && (
            <Sources
              sources={[{ title: "Product source", url: selected.source.url }]}
            />
          )}
          <Text style={s.tiny}>{selected.ingredients}</Text>
          {onSelect ? (
            <Button
              label="Review this receipt match"
              onPress={() => onSelect(selected)}
            />
          ) : (
            <>
              <Field
                label="Number of labeled servings"
                value={servings}
                onChangeText={setServings}
                keyboardType="decimal-pad"
              />
              {(["grocery", "meal"] as const).map((action) => (
                <Button
                  key={action}
                  label={
                    action === "grocery" ? "Add to groceries" : "Log as eaten"
                  }
                  secondary={action === "grocery"}
                  disabled={
                    !Number.isFinite(Number(servings)) ||
                    Number(servings) <= 0 ||
                    Number(servings) > 1000 ||
                    (action === "meal" && !nutritionForServing(selected))
                  }
                  onPress={() => {
                    if (
                      h.change((s) =>
                        captureProduct(
                          s,
                          selected,
                          action,
                          Number(servings),
                          operation.current,
                        ),
                      )
                    )
                      h.setTool(null);
                  }}
                />
              ))}
            </>
          )}
        </Card>
      )}
      {!selected && normalizeGTIN(barcode) && (
        <Button
          label="Enter the label myself"
          secondary
            onPress={() => { h.setLabelBarcode(barcode); h.setTool("label"); }}
        />
      )}
    </Sheet>
  );
}
export function Voice() {
  const h = useHealth(),
    recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY),
    status = useAudioRecorderState(recorder),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    active = useRef(true),
    abort = useRef<AbortController | null>(null),
    stopping = useRef(false);
  const remove = async () => {
    if (recorder.uri && Platform.OS !== "web")
      await FileSystem.deleteAsync(recorder.uri, { idempotent: true }).catch(
        () => {},
      );
  };
  useEffect(
    () => () => {
      active.current = false;
      abort.current?.abort();
      void recorder
        .stop()
        .catch(() => {})
        .finally(remove);
      void setAudioModeAsync({ allowsRecording: false });
    },
    [],
  );
  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    setBusy(true);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) throw new Error("No recording was captured.");
      let audio: string;
      if (Platform.OS === "web") {
        const blob = await (await fetch(recorder.uri)).blob();
        audio = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else
        audio = await FileSystem.readAsStringAsync(recorder.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      abort.current = new AbortController();
      const result = await jsonApi(
        "/api/voice",
        { audio, mime: Platform.OS === "web" ? "audio/webm" : "audio/mp4" },
        abort.current.signal,
      );
      if (active.current) {
        if (typeof result.text !== "string" || result.text.length > 4000)
          throw new Error("No usable transcript returned.");
        setText(result.text);
      }
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      await remove();
      stopping.current = false;
      if (active.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (status.isRecording && status.durationMillis >= 60000) void stop();
  }, [status.durationMillis, status.isRecording]);
  return (
    <Sheet title="Tell me what happened" onClose={() => h.setTool(null)}>
      <Text style={s.muted}>
        Record up to a minute, then check your words before sending. Audio is
        sent to OpenAI for transcription.
      </Text>
      {!!error && <Text style={s.muted}>{error}</Text>}
      {status.isRecording ? (
        <>
          <Text style={s.title}>
            {Math.floor(status.durationMillis / 1000)} seconds
          </Text>
          <Button label="Stop recording" onPress={() => void stop()} />
        </>
      ) : (
        <Button
          label={busy ? "Transcribing…" : "Start recording"}
          disabled={busy}
          onPress={() =>
            void (async () => {
              try {
                setError("");
                if (
                  !(await AudioModule.requestRecordingPermissionsAsync())
                    .granted
                )
                  throw new Error(
                    "Microphone access is off. You can type your message instead.",
                  );
                await setAudioModeAsync({
                  allowsRecording: true,
                  playsInSilentMode: true,
                });
                await recorder.prepareToRecordAsync();
                recorder.record();
              } catch (e) {
                setError((e as Error).message);
              }
            })()
          }
        />
      )}
      <Field
        label="Review your message"
        multiline
        value={text}
        onChangeText={setText}
        maxLength={4000}
      />
      <Button
        label="Send message"
        disabled={!text.trim() || busy || status.isRecording || h.busy}
        onPress={() => {
          if (h.tab === "Workouts" && h.state!.workout.status === "active") {
            h.change((s) => ({
              ...s,
              workout: replyToWorkout(s.workout, text),
            }));
            h.setTool(null);
          } else void h.send(text);
        }}
      />
    </Sheet>
  );
}
