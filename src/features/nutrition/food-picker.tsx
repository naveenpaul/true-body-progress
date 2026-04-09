import type { Cuisine, Food } from '@/lib/types';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Modal, Text } from '@/components/ui';
import { expoDb } from '@/lib/db';
import * as foodsRepo from '@/lib/db/foods-repo';

const NUM_STYLE = { fontVariant: ['tabular-nums' as const] };
const TABS: { key: Cuisine | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'indian', label: 'Indian' },
  { key: 'us', label: 'US' },
  { key: 'chinese', label: 'Chinese' },
  { key: 'korean', label: 'Korean' },
  { key: 'generic', label: 'Basics' },
  { key: 'custom', label: 'Custom' },
];

type Mode = { kind: 'browse' } | { kind: 'serve'; food: Food } | { kind: 'custom' };

export type FoodPickerProps = {
  onPick: (food: Food, servings: number) => void | Promise<void>;
};

export function FoodPicker({ ref, onPick }: FoodPickerProps & { ref?: React.RefObject<React.ElementRef<typeof Modal> | null> }) {
  const [mode, setMode] = useState<Mode>({ kind: 'browse' });

  const reset = useCallback(() => setMode({ kind: 'browse' }), []);

  return (
    <Modal
      ref={ref}
      snapPoints={['85%']}
      title="Add meal"
      onDismiss={reset}
      backgroundStyle={{ backgroundColor: '#0B0B0C' }}
      handleIndicatorStyle={{ backgroundColor: '#26272D' }}
    >
      {mode.kind === 'browse' && (
        <BrowseView
          onSelect={f => setMode({ kind: 'serve', food: f })}
          onCustom={() => setMode({ kind: 'custom' })}
        />
      )}
      {mode.kind === 'serve' && (
        <ServeView
          food={mode.food}
          onBack={reset}
          onConfirm={async (servings) => {
            await onPick(mode.food, servings);
            reset();
          }}
        />
      )}
      {mode.kind === 'custom' && (
        <CustomFoodForm
          onCancel={reset}
          onCreated={async (food) => {
            setMode({ kind: 'serve', food });
          }}
        />
      )}
    </Modal>
  );
}
FoodPicker.displayName = 'FoodPicker';

// ---------- Browse ----------

function BrowseView({
  onSelect,
  onCustom,
}: {
  onSelect: (f: Food) => void;
  onCustom: () => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cuisine, setCuisine] = useState<Cuisine | 'all'>('all');
  const [results, setResults] = useState<Food[]>([]);
  const [recents, setRecents] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<Food[]>([]);

  // Debounce search input ~150ms.
  useEffect(() => {
    const t = setTimeout(setDebounced, 150, query);
    return () => clearTimeout(t);
  }, [query]);

  // Load recents + favorites once on open.
  useEffect(() => {
    (async () => {
      const [r, f] = await Promise.all([
        foodsRepo.getRecentFoods(expoDb, { limit: 10 }),
        foodsRepo.getFavoriteFoods(expoDb, 50),
      ]);
      setRecents(r);
      setFavorites(f);
    })();
  }, []);

  // Re-run search on query/cuisine change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await foodsRepo.searchFoods(expoDb, debounced, {
        cuisine,
        limit: 60,
      });
      if (!cancelled)
        setResults(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, cuisine]);

  const showSections = debounced.trim() === '' && cuisine === 'all';

  const handleToggleFav = useCallback(async (id: string) => {
    await foodsRepo.toggleFavorite(expoDb, id);
    const [r, f] = await Promise.all([
      foodsRepo.searchFoods(expoDb, debounced, { cuisine, limit: 60 }),
      foodsRepo.getFavoriteFoods(expoDb, 50),
    ]);
    setResults(r);
    setFavorites(f);
  }, [debounced, cuisine]);

  return (
    <View className="flex-1 px-4 pb-4">
      <TextInput
        placeholder="Search foods…"
        value={query}
        onChangeText={setQuery}
        className="mb-3 rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
        placeholderTextColor="#71717A"
        autoCorrect={false}
        autoCapitalize="none"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3 grow-0"
        contentContainerClassName="gap-2"
      >
        {TABS.map(t => (
          <Pressable
            key={t.key}
            onPress={() => setCuisine(t.key)}
            className={`rounded-full px-4 py-2 ${
              cuisine === t.key ? 'bg-success-500' : 'bg-ink-card'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                cuisine === t.key ? 'text-black' : 'text-ink-text'
              }`}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {showSections && recents.length > 0 && (
          <Section title="Recent">
            {recents.map(f => (
              <FoodRow
                key={f.id}
                food={f}
                onPress={() => onSelect(f)}
                onToggleFav={() => handleToggleFav(f.id)}
              />
            ))}
          </Section>
        )}

        {showSections && favorites.length > 0 && (
          <Section title="Favorites">
            {favorites.map(f => (
              <FoodRow
                key={f.id}
                food={f}
                onPress={() => onSelect(f)}
                onToggleFav={() => handleToggleFav(f.id)}
              />
            ))}
          </Section>
        )}

        <Section title={showSections ? 'All foods' : 'Results'}>
          {results.length === 0
            ? (
                <Text className="px-1 py-3 text-sm text-ink-faint">
                  No foods found. Try a different search or add a custom food.
                </Text>
              )
            : (
                results.map(f => (
                  <FoodRow
                    key={f.id}
                    food={f}
                    onPress={() => onSelect(f)}
                    onToggleFav={() => handleToggleFav(f.id)}
                  />
                ))
              )}
        </Section>

        <Pressable
          onPress={onCustom}
          className="mt-3 rounded-xl border border-dashed border-ink-hairline p-4"
        >
          <Text className="text-center text-sm font-semibold text-success-500">
            + Create custom food
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text
        className="mb-2 text-xs font-bold text-ink-faint uppercase"
        style={{ letterSpacing: 0.8 }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function FoodRow({
  food,
  onPress,
  onToggleFav,
}: {
  food: Food;
  onPress: () => void;
  onToggleFav: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center border-b border-ink-hairline py-3"
    >
      <View className="flex-1 pr-3">
        <Text className="text-base text-ink-text">{food.name}</Text>
        <Text className="mt-0.5 text-xs text-ink-faint" style={NUM_STYLE}>
          {food.default_serving_qty}
          {' '}
          {food.default_serving_unit}
          {' · '}
          {Math.round(food.kcal)}
          {' kcal · '}
          {Math.round(food.protein_g)}
          P ·
          {' '}
          {Math.round(food.carbs_g)}
          C ·
          {' '}
          {Math.round(food.fat_g)}
          F
        </Text>
      </View>
      <Pressable onPress={onToggleFav} hitSlop={10} className="px-2">
        <Text className={food.is_favorite ? 'text-success-500' : 'text-ink-faint'}>
          {food.is_favorite ? '★' : '☆'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

// ---------- Serve ----------

function ServeView({
  food,
  onBack,
  onConfirm,
}: {
  food: Food;
  onBack: () => void;
  onConfirm: (servings: number) => void | Promise<void>;
}) {
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);

  const macros = useMemo(() => ({
    kcal: Math.round(food.kcal * servings),
    protein: +(food.protein_g * servings).toFixed(1),
    carbs: +(food.carbs_g * servings).toFixed(1),
    fat: +(food.fat_g * servings).toFixed(1),
  }), [food, servings]);

  const adjust = (delta: number) =>
    setServings(s => Math.max(0.25, +(s + delta).toFixed(2)));

  return (
    <View className="flex-1 px-5 pb-4">
      <Pressable onPress={onBack} className="mb-3">
        <Text className="text-sm text-success-500">‹ Back</Text>
      </Pressable>

      <Text className="text-xl font-bold text-ink-text">{food.name}</Text>
      <Text className="mt-1 text-sm text-ink-faint">
        Per
        {' '}
        {food.default_serving_qty}
        {' '}
        {food.default_serving_unit}
        {food.default_serving_grams ? ` (${food.default_serving_grams}g)` : ''}
      </Text>

      <View className="my-6 rounded-2xl bg-ink-card p-4">
        <Text className="mb-3 text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.8 }}>
          Servings
        </Text>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => adjust(-0.25)}
            className="size-12 items-center justify-center rounded-full bg-ink-base"
          >
            <Text className="text-xl text-ink-text">−</Text>
          </Pressable>
          <Text className="text-3xl font-bold text-ink-text" style={NUM_STYLE}>
            {servings}
          </Text>
          <Pressable
            onPress={() => adjust(0.25)}
            className="size-12 items-center justify-center rounded-full bg-ink-base"
          >
            <Text className="text-xl text-ink-text">+</Text>
          </Pressable>
        </View>
      </View>

      <View className="mb-6 rounded-2xl bg-ink-card p-4">
        <MacroLine label="Calories" value={`${macros.kcal} kcal`} />
        <MacroLine label="Protein" value={`${macros.protein} g`} />
        <MacroLine label="Carbs" value={`${macros.carbs} g`} />
        <MacroLine label="Fat" value={`${macros.fat} g`} />
      </View>

      <Button
        label={saving ? 'Saving…' : 'Add to today'}
        variant="primary"
        disabled={saving}
        onPress={async () => {
          setSaving(true);
          try {
            await onConfirm(servings);
          }
          finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}

function MacroLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-sm text-ink-faint">{label}</Text>
      <Text className="text-sm font-semibold text-ink-text" style={NUM_STYLE}>
        {value}
      </Text>
    </View>
  );
}

// ---------- Custom food form ----------

function CustomFoodForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (food: Food) => void;
}) {
  const [name, setName] = useState('');
  const [servingQty, setServingQty] = useState('1');
  const [servingUnit, setServingUnit] = useState('serving');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const num = (s: string, allowEmpty = false) => {
    if (!s.trim())
      return allowEmpty ? 0 : Number.NaN;
    return Number.parseFloat(s.replace(',', '.'));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const qty = num(servingQty);
    const k = num(kcal);
    const p = num(protein, true);
    const c = num(carbs, true);
    const f = num(fat, true);
    const fi = fiber.trim() ? num(fiber) : null;
    if ([qty, k, p, c, f].some(v => Number.isNaN(v) || v < 0)) {
      setError('Numbers must be non-negative');
      return;
    }
    if (fi !== null && (Number.isNaN(fi) || fi < 0)) {
      setError('Fiber must be non-negative');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const food = await foodsRepo.createCustomFood(expoDb, {
        name: name.trim(),
        default_serving_qty: qty,
        default_serving_unit: servingUnit.trim() || 'serving',
        kcal: k,
        protein_g: p,
        carbs_g: c,
        fat_g: f,
        fiber_g: fi,
      });
      onCreated(food);
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView className="flex-1 px-5 pb-4" keyboardShouldPersistTaps="handled">
      <Pressable onPress={onCancel} className="mb-3">
        <Text className="text-sm text-success-500">‹ Cancel</Text>
      </Pressable>
      <Text className="mb-4 text-xl font-bold text-ink-text">Custom food</Text>

      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mom's rajma" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Serving qty" value={servingQty} onChangeText={setServingQty} keyboardType="numeric" />
        </View>
        <View className="flex-1">
          <Field label="Unit" value={servingUnit} onChangeText={setServingUnit} placeholder="katori" />
        </View>
      </View>
      <Field label="Calories" value={kcal} onChangeText={setKcal} keyboardType="numeric" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="numeric" />
        </View>
        <View className="flex-1">
          <Field label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="numeric" />
        </View>
        <View className="flex-1">
          <Field label="Fiber (g)" value={fiber} onChangeText={setFiber} keyboardType="numeric" placeholder="optional" />
        </View>
      </View>

      {error && <Text className="mb-3 text-sm text-danger-400">{error}</Text>}

      <Button
        label={saving ? 'Saving…' : 'Save & continue'}
        variant="primary"
        disabled={saving}
        onPress={handleSave}
      />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.8 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? 'default'}
        className="rounded-xl border border-ink-hairline bg-ink-base px-4 py-3 text-base text-ink-text"
        placeholderTextColor="#71717A"
        style={keyboardType === 'numeric' ? NUM_STYLE : undefined}
        autoCapitalize={keyboardType === 'numeric' ? 'none' : 'sentences'}
      />
    </View>
  );
}
