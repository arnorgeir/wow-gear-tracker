export const overrideLabel = (override: { name: string; catalyst: boolean }) =>
  (override.catalyst ? `${override.name} → catalyst into tier` : override.name);
