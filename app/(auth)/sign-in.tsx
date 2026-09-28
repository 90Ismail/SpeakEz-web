import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Caps } from "../../src/components/Caps";
import { OnboardingButton, OnboardingTextButton } from "../../src/components/OnboardingButton";
import { OnboardingDots } from "../../src/components/OnboardingDots";
import { OnboardingTopBar } from "../../src/components/OnboardingTopBar";
import { fonts, fontWeight, radius, space, type, useTheme } from "../../src/theme";

const CODE_LENGTH = 6;

function localPartOf(value: string): string {
  const at = value.indexOf("@");
  return (at === -1 ? value : value.slice(0, at)).trim().toLowerCase();
}

function domainOf(value: string): string {
  const at = value.indexOf("@");
  return at === -1 ? "" : value.slice(at + 1).trim().toLowerCase();
}

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const codeInputs = useRef<Array<TextInput | null>>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [over18, setOver18] = useState(false);
  const [code, setCode] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));

  const localPart = localPartOf(email);
  const domain = domainOf(email);
  const invalidDomain = domain.length > 0 && !"umn.edu".startsWith(domain);
  const emailValid = !invalidDomain && /^[a-z0-9][a-z0-9._-]*$/.test(localPart);
  const fullEmail = `${localPart}@umn.edu`;
  const codeComplete = code.every((digit) => digit.length === 1);
  const canSendCode = emailValid && over18;
  const showSuffix = !email.includes("@");

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      return;
    }
    router.back();
  };

  const handleSendCode = () => {
    if (!canSendCode) return;
    setCode(Array(CODE_LENGTH).fill(""));
    setStep(2);
  };

  const handleCodeChange = (value: string, index: number) => {
    const digits = value.replace(/[^0-9]/g, "");
    const next = [...code];
    if (digits.length === 0) {
      next[index] = "";
      setCode(next);
      return;
    }
    let cursor = index;
    for (const digit of digits.slice(0, CODE_LENGTH - index)) {
      next[cursor] = digit;
      cursor += 1;
    }
    setCode(next);
    const focusIndex = Math.min(cursor, CODE_LENGTH - 1);
    if (focusIndex !== index) {
      codeInputs.current[focusIndex]?.focus();
    }
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key !== "Backspace") return;
    if (code[index] === "" && index > 0) {
      const next = [...code];
      next[index - 1] = "";
      setCode(next);
      codeInputs.current[index - 1]?.focus();
      return;
    }
    const next = [...code];
    next[index] = "";
    setCode(next);
  };

  const handleVerify = () => {
    if (!codeComplete) return;
    router.replace("/");
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <OnboardingTopBar onBack={handleBack} right={<OnboardingDots active={2} />} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <>
              <View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accentLine }]}>
                <Ionicons name="shield-checkmark" size={24} color={theme.accentText} />
              </View>
              <Text style={[styles.heading, { color: theme.ink }]}>
                One quick check. Then you&apos;re anonymous.
              </Text>
              <Text style={[styles.body, { color: theme.ink2 }]}>
                We confirm you&apos;re a UMN student with your x500 email. It&apos;s never linked to anything you
                post or hear.
              </Text>
              <View style={styles.field}>
                <Caps tone="ink3" style={styles.fieldLabel}>
                  UMN EMAIL
                </Caps>
                <View
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.controlLine }]}
                >
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="goldy012"
                    placeholderTextColor={theme.ink3}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="done"
                    onSubmitEditing={handleSendCode}
                    accessibilityLabel="UMN email"
                    style={[styles.inputText, { color: theme.ink }]}
                  />
                  {showSuffix ? (
                    <Text style={[styles.inputSuffix, { color: theme.ink3 }]}>@umn.edu</Text>
                  ) : null}
                </View>
                {invalidDomain ? (
                  <View style={[styles.errorPanel, { backgroundColor: theme.dangerSoft }]}>
                    <Text style={[styles.errorText, { color: theme.danger }]}>
                      Use your UMN address (@umn.edu)
                    </Text>
                  </View>
                ) : null}
                <View style={styles.helper}>
                  <Ionicons name="mail" size={14} color={theme.ink3} />
                  <Text style={[styles.helperText, { color: theme.ink3 }]}>
                    We&apos;ll email a 6-digit code. The address is deleted once you&apos;re verified.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setOver18((current) => !current)}
                accessibilityRole="checkbox"
                accessibilityLabel="I'm 18 or older"
                accessibilityState={{ checked: over18 }}
                style={({ pressed }) => [styles.checkboxRow, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: over18 ? theme.accent : theme.surfaceClear,
                      borderColor: over18 ? theme.accent : theme.controlLine,
                    },
                  ]}
                >
                  {over18 ? <Ionicons name="checkmark" size={14} color={theme.onAccent} /> : null}
                </View>
                <Text style={[styles.checkboxLabel, { color: theme.ink2 }]}>I&apos;m 18 or older</Text>
              </Pressable>
              <View style={[styles.keep, { borderTopColor: theme.line }]}>
                <Caps tone="ink3" style={styles.keepLabel}>
                  WHAT WE KEEP
                </Caps>
                <Text style={[styles.keepText, { color: theme.ink }]}>
                  One &quot;verified&quot; flag. No email, name or student ID.
                </Text>
              </View>
              <View style={styles.footer}>
                <OnboardingButton label="Send code" onPress={handleSendCode} disabled={!canSendCode} />
                <View style={styles.finePrint}>
                  <Text style={[styles.finePrintLead, { color: theme.ink3 }]}>
                    By continuing you agree to the
                  </Text>
                  <Text style={[styles.finePrintLink, { color: theme.ink2 }]}>Community Guidelines</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.stepTwoTop}>
                <Text style={[styles.heading, { color: theme.ink }]}>Enter your code</Text>
                <Text style={[styles.body, { color: theme.ink2 }]}>
                  {`We sent a 6-digit code to ${fullEmail}`}
                </Text>
              </View>
              <View style={styles.codeRow}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(node) => {
                      codeInputs.current[index] = node;
                    }}
                    value={digit}
                    onChangeText={(value) => handleCodeChange(value, index)}
                    onKeyPress={(event) => handleCodeKeyPress(event.nativeEvent.key, index)}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={1}
                    autoFocus={index === 0}
                    textContentType={index === 0 ? "oneTimeCode" : "none"}
                    accessibilityLabel={`Code digit ${index + 1} of ${CODE_LENGTH}`}
                    style={[
                      styles.codeBox,
                      { color: theme.ink, borderColor: theme.controlLine, backgroundColor: theme.surface },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.footer}>
                <OnboardingButton label="Verify" onPress={handleVerify} disabled={!codeComplete} />
                <OnboardingTextButton
                  label="Send it again"
                  tone="accent"
                  onPress={() => {}}
                  accessibilityHint="Resends the code to your UMN email"
                />
                <OnboardingTextButton label="Use a different email" onPress={() => setStep(1)} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 20,
    paddingHorizontal: 24,
    gap: 16,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  heading: {
    fontFamily: fonts.sans,
    fontSize: type.display,
    fontWeight: fontWeight.bold,
    lineHeight: 35,
    letterSpacing: -1,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.regular,
    lineHeight: 22.5,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    letterSpacing: 1.2,
  },
  input: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  inputText: {
    flex: 1,
    padding: 0,
    fontFamily: fonts.sans,
    fontSize: type.body,
  },
  inputSuffix: {
    fontFamily: fonts.sans,
    fontSize: type.body,
  },
  errorPanel: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.xs,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.semibold,
  },
  helper: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  helperText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.regular,
    lineHeight: 19,
  },
  checkboxRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.regular,
  },
  keep: {
    paddingTop: 16,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  keepLabel: {
    letterSpacing: 1.2,
  },
  keepText: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: fontWeight.regular,
    lineHeight: 22,
  },
  footer: {
    marginTop: "auto",
    width: "100%",
    alignItems: "center",
    gap: 14,
  },
  finePrint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  finePrintLead: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.regular,
  },
  finePrintLink: {
    fontFamily: fonts.sans,
    fontSize: type.support,
    fontWeight: fontWeight.bold,
  },
  stepTwoTop: {
    gap: 16,
    paddingTop: 4,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  codeBox: {
    width: 44,
    height: 52,
    padding: 0,
    textAlign: "center",
    fontFamily: fonts.sans,
    fontSize: type.title,
    fontWeight: fontWeight.semibold,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
});
