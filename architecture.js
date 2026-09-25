// SDD 15.1: dependencies point inward only. Nothing ever points back out.
//
//   app/          routes, navigation, composition only
//   features/     screens and hooks for one area
//   notifications/, privacy/   device and account services
//   ui/           tokens and primitives (knows nothing about babies)
//   sync/         outbox, push, pull
//   db/           sqlite, repositories
//   domain/       pure logic, imports nothing from this list
//
// This file is the one place that table is written down. eslint.config.js reads
// it to check each file as it is saved; .dependency-cruiser.js reads it to check
// the graph the modules make together (P4-03). A layer added here is enforced by
// both at once.
//
// `notifications` and `privacy` hold behaviour two features need that is too
// impure for domain/ and too specific for ui/ — scheduling with the operating
// system, consent, export. They sit below the features and know of no screen.

/** Each layer, mapped to what it is allowed to import. */
const LAYERS = {
  app: ['features', 'notifications', 'privacy', 'ui', 'sync', 'db', 'domain', 'i18n'],
  features: ['notifications', 'privacy', 'ui', 'sync', 'db', 'domain', 'i18n'],
  notifications: ['ui', 'sync', 'db', 'domain', 'i18n'],
  privacy: ['ui', 'sync', 'db', 'domain', 'i18n'],
  // A primitive takes props: no feature, no repository, no domain type, no copy.
  ui: [],
  sync: ['db', 'domain'],
  db: ['domain'],
  // Pure logic. Nothing from this list, and nothing from the platform either.
  domain: [],
  i18n: [],
};

/** The folder a layer's modules live in, from the repository root. */
function layerDir(layer) {
  return layer === 'app' ? 'app' : `src/${layer}`;
}

/** The layers a given layer may not import. */
function forbiddenFor(layer) {
  return Object.keys(LAYERS).filter((other) => other !== layer && !LAYERS[layer].includes(other));
}

/** What the rule says when it fires, so both tools say the same thing. */
function layerMessage(layer) {
  const allowed = LAYERS[layer];
  return allowed.length
    ? `${layer}/ may import only ${allowed.join(', ')} (SDD 15.1).`
    : `${layer}/ imports no other layer (SDD 15.1).`;
}

const FEATURE_MESSAGE =
  'A feature never imports another feature (SDD 15.1). Move it down to ui/ or domain/.';

module.exports = { LAYERS, layerDir, forbiddenFor, layerMessage, FEATURE_MESSAGE };
