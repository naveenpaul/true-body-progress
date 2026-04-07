import type { Gender, GoalType, UnitSystem } from '@/lib/types';

import { useRouter } from 'expo-router';
import * as React from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { cmToInches, inchesToCm, kgToLbs, lbsToKg } from '@/lib/units';

import { useUserStore } from './use-user-store';

export function ProfileSetupScreen() {
  const router = useRouter();
  const user = useUserStore.use.user();
  const createUser = useUserStore.use.createUser();
  const updateProfile = useUserStore.use.updateProfile();

  // Editable values are stored in the user's currently-selected unit system,
  // then converted back to metric on save.
  const initialUnits: UnitSystem = user?.preferred_units ?? 'metric';
  const [units, setUnits] = useState<UnitSystem>(initialUnits);

  const initialHeight = user?.height_cm
    ? (initialUnits === 'imperial' ? cmToInches(user.height_cm) : user.height_cm)
    : '';
  const initialTargetWeight = user?.target_weight
    ? (initialUnits === 'imperial' ? kgToLbs(user.target_weight) : user.target_weight)
    : '';

  const [name, setName] = useState(user?.name ?? '');
  const [height, setHeight] = useState(initialHeight ? String(initialHeight) : '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'male');
  const [goalType, setGoalType] = useState<GoalType>(user?.goal_type ?? 'fat_loss');
  const [targetWeight, setTargetWeight] = useState(initialTargetWeight ? String(initialTargetWeight) : '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const heightLabel = units === 'imperial' ? 'Height (in)' : 'Height (cm)';
  const targetWeightLabel = units === 'imperial' ? 'Target weight (lbs)' : 'Target weight (kg)';

  const handleSave = async () => {
    const parseNum = (s: string) => Number.parseFloat(s.replace(',', '.'));
    const h = parseNum(height);
    const a = Number.parseInt(age, 10);
    const tw = parseNum(targetWeight);
    if (!name || Number.isNaN(h) || Number.isNaN(a) || Number.isNaN(tw)) {
      setSaveError('All fields are required and must be valid numbers');
      return;
    }
    if (h <= 0 || a <= 0 || tw <= 0) {
      setSaveError('Height, age, and target weight must be positive');
      return;
    }

    // Convert editable inputs back to metric for storage.
    const heightCm = units === 'imperial' ? inchesToCm(h) : h;
    const targetWeightKg = units === 'imperial' ? lbsToKg(tw) : tw;

    setSaveError(null);
    setSaving(true);
    try {
      if (!user) {
        await createUser(name, heightCm, a, gender, goalType, targetWeightKg, units);
      }
      else {
        await updateProfile({
          name,
          height_cm: heightCm,
          age: a,
          gender,
          goal_type: goalType,
          target_weight: targetWeightKg,
          preferred_units: units,
        });
      }
      router.back();
    }
    catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    }
    finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-charcoal-950" contentContainerClassName="p-4 pb-10 pt-14">
      <Text className="mb-6 text-2xl font-bold text-white">
        {user ? 'Settings' : 'Profile Setup'}
      </Text>

      <InputField label="Name" value={name} onChangeText={setName} />
      <InputField label={heightLabel} value={height} onChangeText={setHeight} keyboardType="numeric" />
      <InputField label="Age" value={age} onChangeText={setAge} keyboardType="numeric" />

      <Text className="my-2 text-sm text-charcoal-400">Gender</Text>
      <SegmentedControl
        options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
        selected={gender}
        onSelect={v => setGender(v as Gender)}
      />

      <Text className="mt-4 mb-2 text-sm text-charcoal-400">Goal</Text>
      <SegmentedControl
        options={[
          { value: 'fat_loss', label: 'Fat Loss' },
          { value: 'muscle_gain', label: 'Muscle Gain' },
          { value: 'recomposition', label: 'Recomp' },
        ]}
        selected={goalType}
        onSelect={v => setGoalType(v as GoalType)}
      />

      <InputField label={targetWeightLabel} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" />

      <Text className="mt-4 mb-2 text-sm text-charcoal-400">Units</Text>
      <SegmentedControl
        options={[
          { value: 'metric', label: 'Metric (kg/cm)' },
          { value: 'imperial', label: 'Imperial (lbs/in)' },
        ]}
        selected={units}
        onSelect={(v) => {
          const next = v as UnitSystem;
          if (next === units)
            return;
          // Convert the currently-displayed numeric values into the new unit system
          // so the user doesn't have to retype them.
          const parseNum = (s: string) => Number.parseFloat(s.replace(',', '.'));
          const h = parseNum(height);
          if (!Number.isNaN(h)) {
            setHeight(String(next === 'imperial' ? cmToInches(h) : inchesToCm(h)));
          }
          const tw = parseNum(targetWeight);
          if (!Number.isNaN(tw)) {
            setTargetWeight(String(next === 'imperial' ? kgToLbs(tw) : lbsToKg(tw)));
          }
          setUnits(next);
        }}
      />

      {saveError && (
        <Text className="mt-2 text-sm text-danger-500">{saveError}</Text>
      )}

      <Button
        label={saving ? 'Saving...' : (user ? 'Save Changes' : 'Create Profile')}
        onPress={handleSave}
        disabled={saving || !name || !height || !age || !targetWeight}
        className="mt-4 bg-success-500"
        textClassName="text-black font-bold"
      />
    </ScrollView>
  );
}

function InputField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm text-charcoal-400">{label}</Text>
      <TextInput
        className="rounded-xl border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-white"
        placeholderTextColor="#7D7D7D"
        {...props}
      />
    </View>
  );
}

function SegmentedControl({ options, selected, onSelect }: {
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View className="mb-4 flex-row gap-2">
      {options.map(opt => (
        <Pressable
          key={opt.value}
          onPress={() => onSelect(opt.value)}
          className={`flex-1 items-center rounded-lg py-2.5 ${
            selected === opt.value ? 'bg-success-500' : 'bg-charcoal-800'
          }`}
        >
          <Text className={`text-sm ${
            selected === opt.value ? 'font-bold text-black' : 'text-charcoal-300'
          }`}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
