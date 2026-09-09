import { Selectable } from 'kysely';
import { CarsTable } from '../../database/database.types.js';

export type CarRow = Selectable<CarsTable>;
