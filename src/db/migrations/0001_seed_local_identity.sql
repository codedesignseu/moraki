-- Stable placeholder ids for the solo, signed-out phase (P1). Created once on
-- first launch; P2-11 swaps them for the real household and user on sign in,
-- so local history is a data migration, not a schema one. OR IGNORE keeps any
-- id that already exists. The random UUIDs are version 4 in canonical form.
INSERT OR IGNORE INTO `meta` (`key`, `value`) VALUES
  ('local_household_id', lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  ('local_baby_id', lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  ('local_user_id', lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))));
