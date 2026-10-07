import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { ArmorType, Faction, ItemLocation, ListType, Quality, Region, SlotType, SnapshotSource } from '../types';

export const characters = sqliteTable('characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  region: text('region').$type<Region>().notNull(),
  realmId: integer('realm_id').notNull(),
  realmSlug: text('realm_slug').notNull(),
  realmName: text('realm_name').notNull(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  className: text('class_name').notNull(),
  specName: text('spec_name').notNull(),
  race: text('race'),
  faction: text('faction').$type<Faction>(),
  avatarUrl: text('avatar_url'),
  specOverride: text('spec_override'),
  priorityList: text('priority_list').$type<'mythicPlus' | 'overall'>().notNull().default('mythicPlus'),
  status: text('status').$type<'ok' | 'notFound'>().notNull().default('ok'),
  lastSyncedAt: integer('last_synced_at'),
  lastSyncError: text('last_sync_error'),
  addedAt: integer('added_at').notNull(),
}, (t) => [uniqueIndex('characters_identity').on(t.region, t.realmId, t.nameKey)]);

export const gearSnapshots = sqliteTable('gear_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  characterId: integer('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  source: text('source').$type<SnapshotSource>().notNull(),
  createdAt: integer('created_at').notNull(),
  contentHash: text('content_hash').notNull(),
}, (t) => [index('gear_snapshots_character').on(t.characterId, t.createdAt)]);

export const snapshotItems = sqliteTable('snapshot_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id').notNull().references(() => gearSnapshots.id, { onDelete: 'cascade' }),
  location: text('location').$type<ItemLocation>().notNull(),
  slot: text('slot').notNull(),
  itemId: integer('item_id').notNull(),
  name: text('name').notNull(),
  itemLevel: integer('item_level'),
  quality: text('quality').$type<Quality>().notNull(),
  bonusIds: text('bonus_ids', { mode: 'json' }).$type<number[]>().notNull(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  /** Sorted secondary stat types joined by commas, '' for none, null when unknown. */
  secondaryStats: text('secondary_stats'),
}, (t) => [index('snapshot_items_snapshot').on(t.snapshotId)]);

export const snapshotCurrencies = sqliteTable('snapshot_currencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id').notNull().references(() => gearSnapshots.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'upgrade' | 'catalyst'>().notNull(),
  currencyId: integer('currency_id').notNull(),
  quantity: integer('quantity').notNull(),
}, (t) => [index('snapshot_currencies_snapshot').on(t.snapshotId)]);

export const bisLists = sqliteTable('bis_lists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  specSlug: text('spec_slug').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  fetchedAt: integer('fetched_at').notNull(),
}, (t) => [uniqueIndex('bis_lists_spec_type').on(t.specSlug, t.listType)]);

export const bisItems = sqliteTable('bis_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listId: integer('list_id').notNull().references(() => bisLists.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  slotLabel: text('slot_label').notNull(),
  slots: text('slots', { mode: 'json' }).$type<SlotType[]>().notNull(),
  /** Null for an "Any" row, which names no item. */
  itemId: integer('item_id'),
  /** Set only for an "Any" row: the item level any item in the slot must reach. */
  minItemLevel: integer('min_item_level'),
  name: text('name').notNull(),
  bonusIds: text('bonus_ids', { mode: 'json' }).$type<number[]>().notNull(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  isCatalyst: integer('is_catalyst', { mode: 'boolean' }).notNull(),
  source: text('source').notNull(),
});

export const items = sqliteTable('items', {
  itemId: integer('item_id').primaryKey(),
  iconUrl: text('icon_url'),
  fetchedAt: integer('fetched_at').notNull(),
});

export const itemDetails = sqliteTable('item_details', {
  itemId: integer('item_id').primaryKey(),
  quality: text('quality').$type<Quality>(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  fetchedAt: integer('fetched_at').notNull(),
  secondaryStats: text('secondary_stats'),
  /** Set by the tier target lookup; null until it ran for this item. */
  statsFetchedAt: integer('stats_fetched_at'),
});

export const classMedia = sqliteTable('class_media', {
  className: text('class_name').primaryKey(),
  classId: integer('class_id').notNull(),
  iconUrl: text('icon_url'),
  fetchedAt: integer('fetched_at').notNull(),
});

export const upgradeTracks = sqliteTable('upgrade_tracks', {
  bonusId: integer('bonus_id').primaryKey(),
  name: text('name').notNull(),
  step: integer('step').notNull(),
  max: integer('max').notNull(),
  group: integer('group_id'),
  currencyId: integer('currency_id'),
  currencyName: text('currency_name'),
  currencyIcon: text('currency_icon'),
  costPerStep: integer('cost_per_step'),
});

export const bonusQualities = sqliteTable('bonus_qualities', {
  bonusId: integer('bonus_id').primaryKey(),
  quality: text('quality').$type<Quality>().notNull(),
});

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** The current season's Mythic+ dungeons. Exactly one season is stored; a new one replaces it. */
export const seasonDungeons = sqliteTable('season_dungeons', {
  challengeModeId: integer('challenge_mode_id').primaryKey(),
  seasonSlug: text('season_slug').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  imageUrl: text('image_url'),
  journalInstanceId: integer('journal_instance_id').notNull(),
  mapId: integer('map_id').notNull(),
});

/** What each season dungeon drops, with slot and armor type for crediting tier and Any rows. */
export const dungeonLoot = sqliteTable('dungeon_loot', {
  challengeModeId: integer('challenge_mode_id').notNull().references(() => seasonDungeons.challengeModeId, { onDelete: 'cascade' }),
  encounterId: integer('encounter_id').notNull(),
  encounterName: text('encounter_name').notNull(),
  itemId: integer('item_id').notNull(),
  itemName: text('item_name').notNull(),
  inventoryType: text('inventory_type'),
  armorType: text('armor_type').$type<ArmorType>(),
  secondaryStats: text('secondary_stats'),
}, (t) => [primaryKey({ columns: [t.challengeModeId, t.encounterId, t.itemId] })]);
