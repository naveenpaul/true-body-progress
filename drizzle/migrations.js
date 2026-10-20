// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './0000_init.sql';
import m0001 from './0001_drop_duration.sql';
import m0002 from './0002_melodic_jack_flag.sql';
import m0003 from './0003_routines_tracking.sql';
import m0004 from './0004_notion_meal_source.sql';
import m0005 from './0005_nutrition_fiber.sql';
import journal from './meta/_journal.json';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
  },
};
