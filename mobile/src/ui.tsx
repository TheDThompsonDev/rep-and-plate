import type { ReactNode } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, ChevronRight, CircleDot } from "lucide-react-native";
import { useHealth } from "./store";
export const colors = {
  ink: "#14323c",
  green: "#126952",
  mint: "#e0f3eb",
  muted: "#768797",
  line: "#deebe6",
  paper: "#ffffff",
  wash: "#f5f9f7",
  blue: "#dcecff",
  red: "#a63f3f",
};
export const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  body: { padding: 20, paddingBottom: 40, gap: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  grow: { flex: 1 },
  title: {
    fontSize: 29,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.9,
    lineHeight: 35,
  },
  h2: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  h3: { fontSize: 17, fontWeight: "600", color: colors.ink },
  text: { fontSize: 16, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  tiny: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: colors.green,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
    backgroundColor: colors.paper,
  },
  hero: {
    padding: 22,
    borderRadius: 26,
    backgroundColor: colors.mint,
    gap: 12,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  button: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.green,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  secondary: { backgroundColor: colors.mint },
  secondaryText: { color: colors.green },
  field: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.wash,
    borderRadius: 14,
    padding: 13,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
  },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bubble: {
    backgroundColor: "#f0f1f4",
    padding: 14,
    borderRadius: 20,
    gap: 6,
    maxWidth: "88%",
  },
  user: { backgroundColor: colors.mint, alignSelf: "flex-end" },
  avatar: {
    width: 34,
    height: 34,
    backgroundColor: colors.mint,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon}
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{label}</Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          s.field,
          props.multiline && { minHeight: 84, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Choice({
  values,
  value,
  onChange,
  labels,
}: {
  values: string[];
  value: string;
  onChange: (s: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {values.map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: v === value }}
          onPress={() => onChange(v)}
          style={[
            s.pill,
            v === value && {
              backgroundColor: colors.mint,
              borderColor: colors.green,
            },
          ]}
        >
          <Text
            style={[
              s.muted,
              v === value && { color: colors.green, fontWeight: "600" },
            ]}
          >
            {labels?.[v] ?? v}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Card({
  children,
  mint = false,
}: {
  children: ReactNode;
  mint?: boolean;
}) {
  return <View style={mint ? s.hero : s.card}>{children}</View>;
}
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.body}
    >
      {children}
    </ScrollView>
  );
}
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const h = useHealth();
  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.fill}>
        <KeyboardAvoidingView
          style={s.fill}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : Platform.OS === "android"
                ? "height"
                : undefined
          }
        >
          <View
            style={[
              s.between,
              {
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: colors.line,
              },
            ]}
          >
            <Text accessibilityRole="header" style={[s.h2, s.grow]}>
              {title}
            </Text>
            <IconButton label="Close" onPress={onClose}>
              <X color={colors.ink} />
            </IconButton>
          </View>
          <Screen>
            {!!h.notice && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
                onPress={() => h.setNotice("")}
                style={s.hero}
              >
                <Text style={s.text}>{h.notice}</Text>
              </Pressable>
            )}
            {children}
          </Screen>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export function Row({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[
        s.between,
        { paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line },
      ]}
    >
      <View style={[s.grow, { gap: 5 }]}>
        <Text style={s.h3}>{title}</Text>
        {!!detail && <Text style={s.muted}>{detail}</Text>}
      </View>
      <ChevronRight color={colors.muted} size={19} />
    </Pressable>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <CircleDot color={colors.green} size={28} />
      <Text style={s.h3}>{title}</Text>
      <Text style={s.muted}>{detail}</Text>
    </Card>
  );
}
export function Sources({
  sources,
}: {
  sources: { title: string; url: string }[];
}) {
  return (
    <>
      {sources.map((source) => (
        <Pressable
          key={source.url}
          accessibilityRole="link"
          onPress={() => {
            if (/^https:\/\//.test(source.url))
              void Linking.openURL(source.url);
          }}
        >
          <Text
            style={[
              s.tiny,
              { color: colors.green, textDecorationLine: "underline" },
            ]}
          >
            {source.title} ↗
          </Text>
        </Pressable>
      ))}
    </>
  );
}
