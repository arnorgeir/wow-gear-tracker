import { openDb } from '@/core/db/client';

export const openTestDb = () => openDb(':memory:');
