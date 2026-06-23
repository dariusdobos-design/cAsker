import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { buttonShadow } from "@/constants/button-shadow";
import { formatLicensePlateDisplay, normalizeLicensePlate } from "@/lib/vehicle-lookup-api";

type SkLicensePlateFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSearch: () => void;
  isSearching?: boolean;
  editable?: boolean;
};

export function SkLicensePlateField({
  value,
  onChangeText,
  onSearch,
  isSearching = false,
  editable = true,
}: SkLicensePlateFieldProps) {
  return (
    <View>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-casker-navy/60">
        Evidenčné číslo (EČ)
      </Text>

      <View style={styles.plateRow}>
        <View style={styles.euStrip}>
          <View style={styles.starsRow}>
            {Array.from({ length: 8 }).map((_, index) => (
              <View key={index} style={styles.starDot} />
            ))}
          </View>
          <Text style={styles.skLabel}>SK</Text>
        </View>

        <View style={styles.inputArea}>
          <TextInput
            value={formatLicensePlateDisplay(value)}
            onChangeText={(text) => onChangeText(normalizeLicensePlate(text))}
            placeholder="AA 123AB"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={editable && !isSearching}
            style={styles.plateInput}
            maxLength={12}
          />
          <View style={styles.coatOfArms} accessibilityElementsHidden>
            <View style={styles.coatRed} />
            <View style={styles.coatCross} />
          </View>
        </View>

        <Pressable
          onPress={onSearch}
          disabled={isSearching || !editable}
          accessibilityLabel="Vyhľadať vozidlo"
          accessibilityRole="button"
          style={[styles.searchButton, buttonShadow]}
          className="active:opacity-80"
        >
          {isSearching ? (
            <ActivityIndicator color="#0b194f" size="small" />
          ) : (
            <FontAwesome name="search" size={18} color="#0b194f" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plateRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 2,
    borderColor: "#0f172a",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  euStrip: {
    width: 34,
    backgroundColor: "#003399",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 4,
  },
  starsRow: {
    width: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 2,
  },
  starDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#facc15",
  },
  skLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  inputArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    minHeight: 52,
  },
  plateInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 1.5,
    paddingVertical: 0,
  },
  coatOfArms: {
    width: 14,
    height: 18,
    marginLeft: 6,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  coatRed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#dc2626",
  },
  coatCross: {
    width: 2,
    height: 10,
    backgroundColor: "#ffffff",
    borderRadius: 1,
  },
  searchButton: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 2,
    borderLeftColor: "#0f172a",
    backgroundColor: "#ffffff",
  },
});
