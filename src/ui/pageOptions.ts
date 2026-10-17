/**
 * Stack options for an account page opened over the app (G account/*: sign
 * in, setup, join, consent, invite, feedback). The page draws its own header
 * (`ScreenHeader`), so the native one is off. It opens full screen rather
 * than as an iOS page sheet: a page sheet starts below the status bar, and
 * the in-page header's top inset would then leave a double gap.
 */
export const PAGE_OPTIONS = { headerShown: false, presentation: 'fullScreenModal' } as const;

/** The same for a pushed account page (baby, leave, about): back, not close. */
export const PUSHED_PAGE_OPTIONS = { headerShown: false } as const;
