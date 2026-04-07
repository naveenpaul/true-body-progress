/* eslint-disable better-tailwindcss/no-unknown-classes */
import type { Gender, GoalType, UnitSystem } from '@/lib/types';

import { useRouter } from 'expo-router';
import * as React from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';

import { useUserStore } from './use-user-store';

export function ProfileSetupScreen() {
  const router = useRouter();
  const user = useUserStore.use.user();
  const store = useUserStore();

  const [name, setName] = useState(user?.name ?? '');
  const [height, setHeight] = useState(user?.height_cm ? String(user.height_cm) : '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'male');
  const [goalType, setGoalType] = useState<GoalType>(user?.goal_type ?? 'fat_loss');
  const [targetWeight, setTargetWeight] = useState(user?.target_weight ? String(user.target_weight) : '');
  const [units, setUnits] = useState<UnitSystem>(user?.preferred_units ?? 'metric');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    const tw = parseFloat(targetWeight);
    if (!name || isNaN(h) || isNaN(a) || isNaN(tw)) return;

    setSaving(true);
    if (!user) {
      await store.createUser(name, h, a, gender, goalType, tw, units);
    }
    else {
      if (units !== user.preferred_units) {
        await store.updateUnits(units);
      }
    }
    setSaving(false);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-charcoal-950" contentContainerClassName="p-4 pb-10 pt-14">
      <Text className="mb-6 text-2xl font-bold text-white">
        {user ? 'Settings' : 'Profile Setup'}
      </Text>

      <InputField label="Name" value={name} onChangeText={setName} />
      <InputField label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" />
      <InputField label="Age" value={age} onChangeText={setAge} keyboardType="numeric" />

      <Text className="mb-2 mt-2 text-sm text-charcoal-400">Gender</Text>
      <SegmentedControl
        options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
        selected={gender}
        onSelect={v => setGender(v as Gender)}
      />

      <Text className="mb-2 mt-4 text-sm text-charcoal-400">Goal</Text>
      <SegmentedControl
        options={[
          { value: 'fat_loss', label: 'Fat Loss' },
          { value: 'muscle_gain', label: 'Muscle Gain' },
          { value: 'recomposition', label: 'Recomp' },
        ]}
        selected={goalType}
        onSelect={v => setGoalType(v as GoalType)}
      />

      <InputField label="Target weight (kg)" value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" />

      <Text className="mb-2 mt-4 text-sm text-charcoal-400">Units</Text>
      <SegmentedControl
        options={[
          { value: 'metric', label: 'Metric (kg/cm)' },
          { value: 'imperial', label: 'Imperial (lbs/in)' },
        ]}
        selected={units}
        onSelect={v => setUnits(v as UnitSystem)}
      />

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
          }`}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
