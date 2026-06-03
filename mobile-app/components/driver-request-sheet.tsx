import { useMemo, useState, type ComponentProps } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type RequestCategoryId = "auto" | "tire" | "towing";

type VehicleOption = {
  id: string;
  label: string;
  plate: string;
};

const VEHICLES: VehicleOption[] = [
  { id: "1", label: "BMW X3 xDrive20d", plate: "ZA334OT" },
  { id: "2", label: "Volkswagen Passat", plate: "ZA901PN" },
  { id: "3", label: "Škoda Octavia", plate: "BL118OD" },
];

const CATEGORIES: {
  id: RequestCategoryId;
  label: string;
  icon: ComponentProps<typeof FontAwesome>["name"];
}[] = [
  { id: "auto", label: "Autoservis", icon: "wrench" },
  { id: "tire", label: "Pneuservis", icon: "circle" },
  { id: "towing", label: "Odťahovka", icon: "truck" },
];

type SheetStep = "vehicle" | "details";

type DriverRequestSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function DriverRequestSheet({ visible, onClose }: DriverRequestSheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<SheetStep>("vehicle");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RequestCategoryId | null>(null);
  const [city, setCity] = useState("");
  const [radiusKm, setRadiusKm] = useState(50);
  const [description, setDescription] = useState("");

  const selectedVehicle = useMemo(
    () => VEHICLES.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId],
  );

  const selectedCategoryLabel = useMemo(
    () => CATEGORIES.find((category) => category.id === selectedCategory)?.label ?? "",
    [selectedCategory],
  );

  const resetForm = () => {
    setStep("vehicle");
    setSelectedVehicleId(null);
    setSelectedCategory(null);
    setCity("");
    setRadiusKm(50);
    setDescription("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCategoryPress = (categoryId: RequestCategoryId) => {
    setSelectedCategory(categoryId);
    setStep("details");
  };

  const handleMyLocation = () => {
    setCity("Košice");
  };

  const handleSubmit = () => {
    // API napojenie v ďalšom kroku
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable className="flex-1 justify-end bg-black/55" onPress={handleClose}>
        <Pressable
          className="max-h-[92%] rounded-t-3xl bg-casker-navy"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="items-center py-3">
            <View className="h-1 w-12 rounded-full bg-slate-500" />
          </View>

          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === "vehicle" ? (
              <VehicleStep
                selectedVehicleId={selectedVehicleId}
                selectedCategory={selectedCategory}
                onSelectVehicle={setSelectedVehicleId}
                onSelectCategory={handleCategoryPress}
              />
            ) : (
              <DetailsStep
                categoryLabel={selectedCategoryLabel}
                vehicleLabel={selectedVehicle?.label ?? ""}
                city={city}
                radiusKm={radiusKm}
                description={description}
                onCityChange={setCity}
                onRadiusChange={setRadiusKm}
                onDescriptionChange={setDescription}
                onMyLocation={handleMyLocation}
                onBack={() => setStep("vehicle")}
                onSubmit={handleSubmit}
                onCancel={handleClose}
              />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function VehicleStep({
  selectedVehicleId,
  selectedCategory,
  onSelectVehicle,
  onSelectCategory,
}: {
  selectedVehicleId: string | null;
  selectedCategory: RequestCategoryId | null;
  onSelectVehicle: (id: string) => void;
  onSelectCategory: (id: RequestCategoryId) => void;
}) {
  return (
    <View className="pb-6">
      <Text className="text-center text-2xl font-black tracking-wide text-white">cAsker</Text>
      <Text className="mt-1 text-center text-base font-semibold text-slate-300">Dopyt</Text>

      <Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Vyberte vozidlo
      </Text>

      <View className="mt-3 gap-2">
        {VEHICLES.map((vehicle) => {
          const isSelected = selectedVehicleId === vehicle.id;
          return (
            <Pressable
              key={vehicle.id}
              onPress={() => onSelectVehicle(vehicle.id)}
              className={`rounded-xl border px-4 py-3 ${
                isSelected
                  ? "border-blue-400 bg-casker-navy-light"
                  : "border-slate-600 bg-slate-800/80"
              }`}
            >
              <Text className="text-base font-semibold text-white">{vehicle.label}</Text>
              <Text className="mt-0.5 text-sm text-slate-400">EČ {vehicle.plate}</Text>
            </Pressable>
          );
        })}
      </View>

      {selectedVehicleId ? (
        <View className="mt-6">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Typ služby
          </Text>
          <View className="gap-3">
            {CATEGORIES.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => onSelectCategory(category.id)}
                className={`flex-row items-center justify-center gap-3 rounded-2xl border py-4 ${
                  selectedCategory === category.id
                    ? "border-blue-400 bg-blue-600/30"
                    : "border-slate-600 bg-slate-800"
                }`}
              >
                <FontAwesome name={category.icon} size={20} color="#e2e8f0" />
                <Text className="text-lg font-bold text-white">{category.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DetailsStep({
  categoryLabel,
  vehicleLabel,
  city,
  radiusKm,
  description,
  onCityChange,
  onRadiusChange,
  onDescriptionChange,
  onMyLocation,
  onBack,
  onSubmit,
  onCancel,
}: {
  categoryLabel: string;
  vehicleLabel: string;
  city: string;
  radiusKm: number;
  description: string;
  onCityChange: (value: string) => void;
  onRadiusChange: (value: number) => void;
  onDescriptionChange: (value: string) => void;
  onMyLocation: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="pb-4">
      <Pressable onPress={onBack} className="mb-4 flex-row items-center gap-2 self-start">
        <FontAwesome name="chevron-left" size={14} color="#94a3b8" />
        <Text className="text-sm font-medium text-slate-400">Späť</Text>
      </Pressable>

      <Text className="text-xl font-bold text-white">Kde hľadám dopyt</Text>
      <Text className="mt-1 text-sm text-slate-400">
        {categoryLabel}
        {vehicleLabel ? ` · ${vehicleLabel}` : ""}
      </Text>

      <View className="mt-5 flex-row items-center gap-2">
        <Pressable
          onPress={onMyLocation}
          className="flex-row items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3"
        >
          <FontAwesome name="location-arrow" size={16} color="#60a5fa" />
          <Text className="text-sm font-semibold text-blue-300">Moja poloha</Text>
        </Pressable>
      </View>

      <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Mesto / lokalita
      </Text>
      <TextInput
        value={city}
        onChangeText={onCityChange}
        placeholder="Napr. Košice"
        placeholderTextColor="#64748b"
        className="mt-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-base text-white"
      />

      <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        V okolí
      </Text>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-sm text-slate-300">Vzdialenosť</Text>
        <Text className="text-lg font-bold text-white">{Math.round(radiusKm)} km</Text>
      </View>
      <Slider
        minimumValue={5}
        maximumValue={150}
        step={5}
        value={radiusKm}
        onValueChange={onRadiusChange}
        minimumTrackTintColor="#3b82f6"
        maximumTrackTintColor="#334155"
        thumbTintColor="#60a5fa"
        style={{ width: "100%", height: 40 }}
      />

      <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Popis
      </Text>
      <TextInput
        value={description}
        onChangeText={onDescriptionChange}
        placeholder="Opíšte závadu alebo čo potrebujete…"
        placeholderTextColor="#64748b"
        multiline
        textAlignVertical="top"
        className="mt-2 min-h-[120px] rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-base text-white"
      />

      <Pressable
        onPress={onSubmit}
        className="mt-6 items-center rounded-2xl bg-blue-600 py-4 active:bg-blue-700"
      >
        <Text className="text-base font-bold text-white">Odoslať dopyt</Text>
      </Pressable>

      <Pressable
        onPress={onCancel}
        className="mt-3 items-center rounded-2xl border border-slate-600 bg-slate-800 py-4 active:bg-slate-700"
      >
        <Text className="text-base font-bold text-slate-300">Zrušiť</Text>
      </Pressable>
    </View>
  );
}
