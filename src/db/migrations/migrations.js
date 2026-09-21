import journal from './meta/_journal.json';
import m0000 from './0000_local_schema.sql';
import m0001 from './0001_seed_local_identity.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
  },
};
