import { describe, expect, it } from 'vitest';
import { panelClasses } from './panel-classes';

describe('panelClasses', () => {
  it('opens on the grid with the rail on Dungeons at xl, and on Gear alone below', () => {
    expect(panelClasses('gear')).toEqual({
      legend: 'block', gear: 'block', rail: 'hidden xl:flex', dungeons: 'hidden xl:block', vault: 'hidden', railDungeonsPressed: true,
    });
  });

  it('shows Dungeons alone below xl, beside the grid at xl', () => {
    expect(panelClasses('dungeons')).toEqual({
      legend: 'hidden xl:block', gear: 'hidden xl:block', rail: 'flex', dungeons: 'block', vault: 'hidden', railDungeonsPressed: true,
    });
  });

  it('shows the Vault alone below xl, in the rail at xl', () => {
    expect(panelClasses('vault')).toEqual({
      legend: 'hidden xl:block', gear: 'hidden xl:block', rail: 'flex', dungeons: 'hidden', vault: 'block', railDungeonsPressed: false,
    });
  });
});
