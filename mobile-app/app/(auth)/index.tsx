import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthTextField } from "@/components/auth-text-field";
import { CaskerLogo } from "@/components/casker-logo";
import { APP_SPLASH_DELAY_MS } from "@/constants/app-splash";
import { buttonShadow } from "@/constants/button-shadow";
import { useDriverAuth } from "@/contexts/driver-auth-context";
import { hasRegisteredAccount, verifyDriverLogin, loadDriverAuthCredentials } from "@/lib/driver-auth-credentials";
import { isValidEmail } from "@/lib/driver-profile";

const FORM_FADE_MS = 450;

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const { signIn } = useDriverAuth();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowForm(true);
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: FORM_FADE_MS,
        useNativeDriver: true,
      }).start();
    }, APP_SPLASH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [formOpacity]);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Vyplňte e-mail aj heslo.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError("Zadajte platný e-mail.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const accountExists = await hasRegisteredAccount();
      if (!accountExists) {
        setError("Účet neexistuje. Najprv sa zaregistrujte.");
        return;
      }

      const isValid = await verifyDriverLogin(trimmedEmail, trimmedPassword);
      if (!isValid) {
        const credentials = await loadDriverAuthCredentials();
        if (credentials && credentials.email !== trimmedEmail.trim().toLowerCase()) {
          setError(
            "E-mail sa nezhoduje s účtom v telefóne. Skúste e-mail, ktorý ste zadali pri registrácii, alebo použite Registrovať.",
          );
          return;
        }

        setError(
          trimmedPassword.length < 6
            ? "Heslo musí mať aspoň 6 znakov."
            : "Nesprávne heslo. Ak ste ho zabudli, použite Registrovať a vytvorte účet znova (rovnaký e-mail).",
        );
        return;
      }

      await signIn();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-casker-navy">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-10"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View
            className={`items-center ${showForm ? "pb-6 pt-10" : "min-h-[360px] flex-1 justify-center"}`}
          >
            <CaskerLogo size={showForm ? "default" : "splash"} />
          </View>

          {showForm ? (
            <Animated.View style={{ opacity: formOpacity }}>
              <View
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5"
                style={buttonShadow}
              >
                <AuthTextField
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="vas@email.sk"
                  keyboardType="email-address"
                />
                <AuthTextField
                  label="Heslo"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                />

                {error ? <Text className="mb-3 text-sm text-red-300">{error}</Text> : null}

                <Pressable
                  onPress={() => void handleLogin()}
                  disabled={isSubmitting}
                  className="mb-3 items-center rounded-xl bg-white py-3.5 active:opacity-90"
                  style={buttonShadow}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#0b194f" />
                  ) : (
                    <Text className="text-base font-bold text-casker-navy">Prihlásiť</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(auth)/register")}
                  disabled={isSubmitting}
                  className="items-center rounded-xl border border-white/30 bg-transparent py-3.5 active:opacity-90"
                >
                  <Text className="text-base font-semibold text-white">Registrovať</Text>
                </Pressable>

                <Text className="mt-4 text-center text-xs leading-5 text-white/60">
                  Účet je uložený len v tomto telefóne. Po odhlásení alebo vyčistení Expo Go
                  použite rovnaký e-mail v Registrovať a nastavte nové heslo.
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
