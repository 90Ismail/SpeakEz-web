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
import { OnboardingButton, OnboardingTextButton } from "../../src/components/OnboardingButton";
import { OnboardingDots } from "../../src/components/OnboardingDots";
import { TopBar } from "../../src/components/TopBar";
import { pressed, radius, space, textStyle, useTheme } from "../../src/theme";

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
  const [emailFocused, setEmailFocused] = useState(false);
  const [over18, setOver18] = useState(false);
  const [code, setCode] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [focusedDigit, setFocusedDigit] = useState<number | null>(null);

  const localPart = localPartOf(email);
  const domain = domainOf(email);
  const invalidDomain = domain.length > 0 && !"umn.edu".startsWith(domain);
  const emailValid = !invalidDomain && /^[a-z0-9][a-z0-9._-]*$/.test(localPart);
  const fullEmail = `${localPart}@umn.edu`;
  const codeComplete = code.every((digit) => digit.length === 1);
  const canSendCode = emailValid && over18;
  const showSuffix = !email.includes("@");

  const emailLineColor = invalidDomain ? theme.danger : emailFocused ? theme.accent : theme.line;

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
      <TopBar leading={{ label: "Go back", onPress: handleBack }} trailing={<OnboardingDots active={2} />} />
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
                <Ionicons name="shield-checkmark-outline" size={24} color={theme.accentText} />
              </View>
              <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>
                One quick check. Then you&apos;re anonymous.
              </Text>
              <Text style={[styles.body, { color: theme.ink2 }]}>
                We confirm you&apos;re a UMN student with your x500 email. It&apos;s never linked to anything you
                post or hear.
              </Text>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.ink2 }]}>UMN email</Text>
                <View style={[styles.input, { backgroundColor: theme.surface, borderColor: emailLineColor }]}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
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
                  <Ionicons name="mail-outline" size={14} color={theme.ink3} style={styles.helperIcon} />
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
                style={({ pressed: isPressed }) => [styles.checkboxRow, { opacity: isPressed ? pressed.dim : 1 }]}
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
                <Text style={[styles.keepLabel, { color: theme.ink2 }]}>What we keep</Text>
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
                <Text accessibilityRole="header" style={[styles.heading, { color: theme.ink }]}>
                  Enter your code
                </Text>
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
                    onFocus={() => setFocusedDigit(index)}
                    onBlur={() => setFocusedDigit((current) => (current === index ? null : current))}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={1}
                    autoFocus={index === 0}
                    textContentType={index === 0 ? "oneTimeCode" : "none"}
                    accessibilityLabel={`Code digit ${index + 1} of ${CODE_LENGTH}`}
                    style={[
                      styles.codeBox,
                      {
                        color: theme.ink,
                        backgroundColor: theme.surface,
                        borderColor: focusedDigit === index ? theme.accent : theme.line,
                      },
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
    paddingHorizontal: space.gutter,
    gap: space.md,
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
    ...textStyle.displaySans,
  },
  body: {
    ...textStyle.body,
  },
  field: {
    gap: space.sm,
  },
  fieldLabel: {
    ...textStyle.supportStrong,
  },
  input: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  inputText: {
    flex: 1,
    padding: 0,
    ...textStyle.body,
  },
  inputSuffix: {
    ...textStyle.body,
  },
  errorPanel: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  errorText: {
    ...textStyle.supportStrong,
  },
  helper: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  helperIcon: {
    marginTop: 2,
  },
  helperText: {
    flex: 1,
    ...textStyle.support,
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
    ...textStyle.support,
  },
  keep: {
    paddingTop: space.md,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  keepLabel: {
    ...textStyle.supportStrong,
  },
  keepText: {
    ...textStyle.body,
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
    flexWrap: "wrap",
    gap: space.xs,
  },
  finePrintLead: {
    ...textStyle.support,
  },
  finePrintLink: {
    ...textStyle.supportStrong,
  },
  stepTwoTop: {
    gap: space.md,
    paddingTop: space.xs,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.sm,
  },
  codeBox: {
    width: 48,
    height: 56,
    padding: 0,
    textAlign: "center",
    ...textStyle.titleSans,
    lineHeight: undefined,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
