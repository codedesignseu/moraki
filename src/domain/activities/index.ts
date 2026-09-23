import { appointmentModule } from './appointment';
import { diaperModule } from './diaper';
import { feedBottleModule } from './feedBottle';
import { feedBreastModule } from './feedBreast';
import { healthModule } from './health';
import { medicationModule } from './medication';
import { pumpModule } from './pump';
import { registerActivity } from './registry';
import { sleepModule } from './sleep';
import { stockAdjustModule } from './stockAdjust';
import { weightModule } from './weight';

// One line per activity. A new activity is one new file plus one line here.
registerActivity(feedBottleModule);
registerActivity(feedBreastModule);
registerActivity(diaperModule);
registerActivity(sleepModule);
registerActivity(pumpModule);
registerActivity(stockAdjustModule);
registerActivity(healthModule);
registerActivity(medicationModule);
registerActivity(weightModule);
registerActivity(appointmentModule);

export * from './contract';
export * from './feedPrefill';
export * from './pumpPrefill';
export * from './queries';
export { getActivity, listActivities, registerActivity } from './registry';
