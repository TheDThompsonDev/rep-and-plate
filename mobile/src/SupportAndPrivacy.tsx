import { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  dataHandling,
  supportDiagnostics,
  validSupportUrl,
} from "../../src/features/support/model";

export function SupportAndPrivacy({
  supportUrl,
  requestIds = [],
}: {
  supportUrl?: string;
  requestIds?: readonly string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const contact = validSupportUrl(supportUrl);
  const share = async () => {
    try {
      await Share.share({
        title: "Rep & Plate support diagnostics",
        message: supportDiagnostics(
          Platform.OS === "ios" ||
            Platform.OS === "android" ||
            Platform.OS === "web"
            ? Platform.OS
            : "native",
          requestIds,
        ),
      });
    } catch {
      setNotice("Diagnostics could not be shared. Please try again.");
    }
  };
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Help & your data
      </Text>
      <Text style={styles.text}>
        Tell us what you were trying to do and what happened. Keep receipts,
        passwords and private meal details out of your report.
      </Text>
      {contact ? (
        <Pressable
          accessibilityRole="link"
          style={styles.button}
          onPress={() => {
            void Linking.openURL(contact).catch(() =>
              setNotice("Support could not be opened. Please try again."),
            );
          }}
        >
          <Text style={styles.buttonText}>Contact support</Text>
        </Pressable>
      ) : (
        <Text style={styles.text}>
          A support contact has not been configured for this preview. Share
          feedback with the person who invited you.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={() => void share()}
      >
        <Text style={styles.buttonText}>Share safe diagnostics</Text>
      </Pressable>
      <Text style={styles.text}>
        Includes app version, platform, time and available request IDs. No
        account email, messages, photos or health records.
      </Text>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.text}>
          {notice}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.button}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.buttonText}>
          How your data is handled {expanded ? "−" : "+"}
        </Text>
      </Pressable>
      {expanded
        ? dataHandling.map((item) => (
            <View key={item.title}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.text}>
                {item.text.replace(
                  "Account & saved data",
                  "Cloud & your records",
                )}
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 18, backgroundColor: "#f6f5eb", gap: 12 },
  title: { color: "#104f43", fontWeight: "700", fontSize: 17 },
  text: { color: "#375f57", fontSize: 14, lineHeight: 21 },
  button: { minHeight: 44, justifyContent: "center", paddingVertical: 10 },
  buttonText: { color: "#104f43", fontWeight: "700", fontSize: 15 },
});
