/**
 * The longest a baby's name may be, in characters: the one limit setup and
 * the Baby details screen both use, and the one the server checks
 * (babies_name_length, supabase/migrations/20261024100000). Setup allowed 60
 * and the edit screen 40 until P0.8 made them one.
 */
export const BABY_NAME_MAX = 60;
