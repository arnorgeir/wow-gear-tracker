import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { ArmorType, BisSourceId, FetchedSourceId, Faction, ItemLocation, ListType, Quality, Region, SlotType, SnapshotSource } from '../types';

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
  source: text('source').$type<FetchedSourceId>().notNull().default('method'),
}, (t) => [uniqueIndex('bis_lists_source_spec_type').on(t.source, t.specSlug, t.listType)]);

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
  quality: text('quality').$type<Quality>(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull().default(false),
}, (t) => [primaryKey({ columns: [t.challengeModeId, t.encounterId, t.itemId] })]);

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

/** Every class and spec, from Blizzard's playable classes. Keyed by the Method slug the views use. */
export const specs = sqliteTable('specs', {
  methodSlug: text('method_slug').primaryKey(),
  classId: integer('class_id').notNull(),
  className: text('class_name').notNull(),
  specName: text('spec_name').notNull(),
  iconUrl: text('icon_url'),
  fetchedAt: integer('fetched_at').notNull(),
});

/** An account's choices for one spec. A missing row means the defaults. */
export const specSettings = sqliteTable('spec_settings', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  specSlug: text('spec_slug').notNull(),
  listType: text('list_type').$type<ListType>().notNull().default('mythicPlus'),
  statsMatter: integer('stats_matter', { mode: 'boolean' }).notNull().default(true),
  source: text('source').$type<BisSourceId>().notNull().default('method'),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug] })]);

/** One slot of a source's list replaced by an account. `slot_key` is `<slotLabel>#<n>`. */
export const bisOverrides = sqliteTable('bis_overrides', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  specSlug: text('spec_slug').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  slotKey: text('slot_key').notNull(),
  itemId: integer('item_id').notNull(),
  catalyst: integer('catalyst', { mode: 'boolean' }).notNull().default(false),
  source: text('source').$type<BisSourceId>().notNull().default('method'),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug, t.source, t.listType, t.slotKey] })]);

/** An account's manual lists for a spec. A row exists exactly when the copy exists. */
export const manualBisLists = sqliteTable('manual_bis_lists', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  specSlug: text('spec_slug').notNull(),
  copiedFrom: text('copied_from').$type<FetchedSourceId>().notNull(),
  copiedAt: integer('copied_at').notNull(),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug] })]);

/** The rows of an account's manual lists, in the shape of `bis_items`. `source` is the drop source, as there. */
export const manualBisItems = sqliteTable('manual_bis_items', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  specSlug: text('spec_slug').notNull(),
  listType: text('list_type').$type<ListType>().notNull(),
  position: integer('position').notNull(),
  slotLabel: text('slot_label').notNull(),
  slots: text('slots', { mode: 'json' }).$type<SlotType[]>().notNull(),
  itemId: integer('item_id'),
  minItemLevel: integer('min_item_level'),
  name: text('name').notNull(),
  bonusIds: text('bonus_ids', { mode: 'json' }).$type<number[]>().notNull(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  isCatalyst: integer('is_catalyst', { mode: 'boolean' }).notNull(),
  source: text('source').notNull(),
}, (t) => [primaryKey({ columns: [t.accountId, t.specSlug, t.listType, t.position] })]);

/** A player's verdict on a tier piece whose stats couldn't be compared. Applies only while the piece and target match. */
export const tierStatMarks = sqliteTable('tier_stat_marks', {
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  characterId: integer('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  slot: text('slot').$type<SlotType>().notNull(),
  itemId: integer('item_id').notNull(),
  /** Sorted ascending, so it compares with `itemKey`. */
  bonusIds: text('bonus_ids', { mode: 'json' }).$type<number[]>().notNull(),
  targetItemId: integer('target_item_id').notNull(),
  right: integer('right', { mode: 'boolean' }).notNull(),
}, (t) => [primaryKey({ columns: [t.accountId, t.characterId, t.slot] })]);

/** Every item an override names: complete, factual metadata from Blizzard or the season sync. */
export const itemCatalog = sqliteTable('item_catalog', {
  itemId: integer('item_id').primaryKey(),
  name: text('name').notNull(),
  inventoryType: text('inventory_type'),
  armorType: text('armor_type').$type<ArmorType>(),
  quality: text('quality').$type<Quality>(),
  isTier: integer('is_tier', { mode: 'boolean' }).notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});
