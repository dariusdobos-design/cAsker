import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { SafeAreaView } from "react-native-safe-area-context";

import { SkLicensePlateField } from "@/components/sk-license-plate-field";
import { buttonShadow } from "@/constants/button-shadow";
import { useGarageVehicles } from "@/hooks/use-garage-vehicles";
import {
  formatVehicleMileage,
  formatVehicleSpecsSummary,
  type DriverVehicle,
} from "@/lib/driver-vehicles";
import {
  lookupVehicleByPlate,
  normalizeLicensePlate,
  VehicleLookupApiError,
} from "@/lib/vehicle-lookup-api";

type GarageSheetProps = {
  visible: boolean;
  onClose: () => void;
};

type GarageFormState = {
  plate: string;
  label: string;
  vin: string;
  fuelType: string;
  color: string;
  year: string;
  mileageKm: string;
  engineVolume: string;
  power: string;
  transmission: string;
  engine: string;
};

const EMPTY_FORM: GarageFormState = {
  plate: "",
  label: "",
  vin: "",
  fuelType: "",
  color: "",
  year: "",
  mileageKm: "",
  engineVolume: "",
  power: "",
  transmission: "",
  engine: "",
};

function GarageVehicleCard({
  vehicle,
  onDelete,
}: {
  vehicle: DriverVehicle;
  onDelete: () => void;
}) {
  return (
    <View
      className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
      style={buttonShadow}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-casker-navy">{vehicle.label}</Text>
          <Text className="mt-1 text-sm font-semibold text-slate-600">EČ {vehicle.plate}</Text>
          {vehicle.color ? (
            <Text className="mt-1 text-xs text-slate-500">{vehicle.color}</Text>
          ) : null}
          <Text className="mt-2 text-xs leading-5 text-slate-600">
            {formatVehicleSpecsSummary(vehicle)}
          </Text>
          <Text className="mt-1 text-xs text-slate-500">
            {[vehicle.fuelType, vehicle.transmission, vehicle.engineVolume]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {vehicle.vin ? (
            <Text className="mt-1 text-[11px] text-slate-400">VIN {vehicle.vin}</Text>
          ) : null}
        </View>

        <Pressable
          onPress={onDelete}
          className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
        >
          <FontAwesome name="trash-o" size={16} color="#64748b" />
        </Pressable>
      </View>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-casker-navy/60">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-casker-navy"
      />
    </View>
  );
}

export function GarageSheet({ visible, onClose }: GarageSheetProps) {
  const { vehicles, isLoading, isSaving, upsertVehicle, deleteVehicle } =
    useGarageVehicles(visible);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<GarageFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);

  const closeAddModal = () => {
    setAddOpen(false);
    setForm(EMPTY_FORM);
    setFormError(null);
    setLookupNote(null);
  };

  const updateForm = (patch: Partial<GarageFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFormError(null);
  };

  const handleLookup = async () => {
    const plate = normalizeLicensePlate(form.plate);
    if (!plate) {
      setFormError("Zadajte evidenčné číslo vozidla.");
      return;
    }

    setIsLookingUp(true);
    setFormError(null);
    setLookupNote(null);

    try {
      const result = await lookupVehicleByPlate(plate);
      const label = [result.znacka, result.model].filter(Boolean).join(" ").trim();
      const yearValue =
        result.rok !== null && result.rok !== undefined
          ? String(result.rok)
          : result.rokVyroby?.split("–").pop()?.trim() ?? "";

      updateForm({
        plate: result.ecv,
        label,
        vin: result.vin,
        fuelType: result.palivo,
        color: result.farba,
        year: yearValue,
        engineVolume: result.objemMotora ?? "",
        power: result.vykon ?? "",
        transmission: result.prevodovka ?? result.pohon ?? "",
        engine: result.motor?.trim() || result.objemMotora?.trim() || "",
      });

      const sourceNote = result.sources?.includes("databazavozidiel")
        ? "Údaje boli načítané z oficiálneho registra vozidiel."
        : result.sources?.includes("gafa")
          ? "Údaje boli doplnené z registra vozidiel a katalógu dielov."
          : "Údaje boli načítané z registra vozidiel.";
      const variantNote =
        (result.variantCount ?? 0) > 1
          ? ` Nájdených ${result.variantCount} variantov – použitý prvý.`
          : "";
      const warningNote = result.lookupWarning ? ` ${result.lookupWarning}` : "";
      setLookupNote(`${sourceNote}${variantNote}${warningNote}`);
    } catch (error) {
      const message =
        error instanceof VehicleLookupApiError
          ? error.message
          : "Nepodarilo sa načítať údaje o vozidle.";
      setFormError(message);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSaveVehicle = async () => {
    const plate = normalizeLicensePlate(form.plate);
    const label = form.label.trim();

    if (!plate) {
      setFormError("Zadajte evidenčné číslo vozidla.");
      return;
    }

    if (!label) {
      setFormError("Zadajte názov vozidla alebo ho vyhľadajte podľa EČ.");
      return;
    }

    const year = Number.parseInt(form.year, 10);
    const mileageKm = Number.parseInt(form.mileageKm.replace(/\s/g, ""), 10);

    const vehicle: DriverVehicle = {
      id: `garage-${plate}`,
      label,
      plate,
      vin: form.vin.trim(),
      fuelType: form.fuelType.trim() || "—",
      color: form.color.trim(),
      year: Number.isFinite(year) ? year : new Date().getFullYear(),
      mileageKm: Number.isFinite(mileageKm) ? mileageKm : 0,
      engineVolume: form.engineVolume.trim() || "—",
      power: form.power.trim() || "—",
      transmission: form.transmission.trim() || "—",
      engine: form.engine.trim() || form.engineVolume.trim() || "—",
    };

    try {
      await upsertVehicle(vehicle);
      closeAddModal();
    } catch {
      setFormError("Vozidlo sa nepodarilo uložiť.");
    }
  };

  const confirmDelete = (vehicle: DriverVehicle) => {
    Alert.alert("Odstrániť vozidlo?", `${vehicle.label} · EČ ${vehicle.plate}`, [
      { text: "Zrušiť", style: "cancel" },
      {
        text: "Odstrániť",
        style: "destructive",
        onPress: () => {
          void deleteVehicle(vehicle.id);
        },
      },
    ]);
  };

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color="#0b194f" />
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-8 py-16">
        <FontAwesome name="car" size={42} color="#cbd5e1" />
        <Text className="mt-4 text-center text-base font-semibold text-slate-600">
          Zatiaľ nemáte žiadne vozidlo
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Pridajte auto cez tlačidlo + dole. EČ môžete vyhľadať a údaje sa doplnia automaticky.
        </Text>
      </View>
    );
  }, [isLoading]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "bottom"]}>
        <View className="flex-row items-center border-b border-slate-200 bg-white px-4 py-3">
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
            style={buttonShadow}
          >
            <FontAwesome name="chevron-left" size={16} color="#0b194f" />
          </Pressable>
          <Text className="ml-3 text-xl font-bold text-casker-navy">Garáž</Text>
        </View>

        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 112,
            gap: 12,
          }}
          ListEmptyComponent={listEmpty}
          renderItem={({ item }) => (
            <GarageVehicleCard vehicle={item} onDelete={() => confirmDelete(item)} />
          )}
        />

        <View className="absolute bottom-0 left-0 right-0 items-center pb-6 pt-3">
          <Pressable
            accessibilityLabel="Pridať vozidlo"
            accessibilityRole="button"
            onPress={() => setAddOpen(true)}
            className="h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white active:bg-slate-50"
            style={buttonShadow}
          >
            <FontAwesome name="plus" size={30} color="#0b194f" />
          </Pressable>
        </View>

        <Modal visible={addOpen} animationType="slide" onRequestClose={closeAddModal}>
          <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
            <View className="flex-row items-center border-b border-slate-200 px-4 py-3">
              <Pressable
                onPress={closeAddModal}
                className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
                style={buttonShadow}
              >
                <FontAwesome name="chevron-left" size={16} color="#0b194f" />
              </Pressable>
              <Text className="ml-3 text-xl font-bold text-casker-navy">Pridať vozidlo</Text>
            </View>

            <KeyboardAvoidingView
              className="flex-1"
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <ScrollView
                className="flex-1"
                contentContainerClassName="px-5 pb-8 pt-4"
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                showsVerticalScrollIndicator={false}
              >
                <SkLicensePlateField
                  value={form.plate}
                  onChangeText={(plate) => updateForm({ plate })}
                  onSearch={() => void handleLookup()}
                  isSearching={isLookingUp}
                />

                {lookupNote ? (
                  <Text className="mb-4 text-sm text-emerald-700">{lookupNote}</Text>
                ) : null}

                <FormField
                  label="Názov vozidla"
                  value={form.label}
                  onChangeText={(label) => updateForm({ label })}
                  placeholder="Škoda Octavia"
                />
                <FormField
                  label="VIN"
                  value={form.vin}
                  onChangeText={(vin) => updateForm({ vin })}
                  placeholder="TMB..."
                />
                <FormField
                  label="Farba"
                  value={form.color}
                  onChangeText={(color) => updateForm({ color })}
                  placeholder="Šedomodrá"
                />
                <FormField
                  label="Palivo"
                  value={form.fuelType}
                  onChangeText={(fuelType) => updateForm({ fuelType })}
                  placeholder="Benzín"
                />
                <FormField
                  label="Rok výroby"
                  value={form.year}
                  onChangeText={(year) => updateForm({ year })}
                  placeholder="2016"
                  keyboardType="numeric"
                />
                <FormField
                  label="Najazdené km"
                  value={form.mileageKm}
                  onChangeText={(mileageKm) => updateForm({ mileageKm })}
                  placeholder="142 600"
                  keyboardType="numeric"
                />
                <FormField
                  label="Objem motora"
                  value={form.engineVolume}
                  onChangeText={(engineVolume) => updateForm({ engineVolume })}
                  placeholder="2.0 l"
                />
                <FormField
                  label="Výkon"
                  value={form.power}
                  onChangeText={(power) => updateForm({ power })}
                  placeholder="140 kW"
                />
                <FormField
                  label="Prevodovka"
                  value={form.transmission}
                  onChangeText={(transmission) => updateForm({ transmission })}
                  placeholder="Automatická"
                />

                {formError ? (
                  <Text className="mb-3 text-sm text-red-600">{formError}</Text>
                ) : null}

                <Pressable
                  onPress={() => void handleSaveVehicle()}
                  disabled={isSaving || isLookingUp}
                  className="items-center rounded-xl bg-casker-navy py-4 active:opacity-90 disabled:opacity-60"
                  style={buttonShadow}
                >
                  <Text className="text-base font-bold text-white">
                    {isSaving ? "Ukladám…" : "Uložiť vozidlo"}
                  </Text>
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
