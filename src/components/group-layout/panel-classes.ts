export type GroupView = 'gear' | 'dungeons' | 'vault';
export interface PanelClasses { gear: string; rail: string; dungeons: string; vault: string; railDungeonsPressed: boolean }

/**
 * One view state drives both layouts. Below xl only the chosen panel shows; at xl the grid always
 * shows, and the rail shows Dungeons unless the Vault was chosen. Pure classes, so the server's
 * first paint is right at every width.
 */
export function panelClasses(view: GroupView): PanelClasses {
  return {
    gear: view === 'gear' ? 'block' : 'hidden xl:block',
    rail: view === 'gear' ? 'hidden xl:flex' : 'flex',
    dungeons: view === 'vault' ? 'hidden' : view === 'gear' ? 'hidden xl:block' : 'block',
    vault: view === 'vault' ? 'block' : 'hidden',
    railDungeonsPressed: view !== 'vault',
  };
}
