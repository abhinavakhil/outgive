/**
 * The donate checkout library. Any app (a campaign page, a Ramadan appeal, an embed) renders <Checkout campaign={…} onPay={…} />.
 * Three layouts behind the checkout_layout flag: hero (Hero stage), pledge (Pledge sentence), ticket (Gift ticket).
 */
export { Checkout, CheckoutScreen, OrgCheckout } from "./Checkout";
export { SAMPLE, type CheckoutCampaign, type Extra, ICONS } from "./model";
export type { Layout, Order } from "./useCheckout";
export { FLYERS } from "./parts";
export { StripeFields, type StripeFieldsHandle } from "./StripeFields";
export { type PayResult, payFunction, returnedPayment, settle } from "./payments";
/** The checkout builder's data and rules, for Engage's "Checkout builder" section. */
export { type ExperimentResult, SAMPLE_EXPERIMENTS, SAMPLE_TAKEUP, addonTakeup, listExperiments, loadSettings, saveSettings, startExperiment, stopExperiment } from "./Builder";
export { ADDONS, ADDON_IDS, type AddonId, type CheckoutSettings, DEFAULT_SETTINGS, FUND_IDS, LAYOUTS, LAYOUT_IDS, type Layout as CheckoutLayout, MAX_SHOWN, OFF_SCREEN, embedSnippet, settingsProblem, toSettings } from "./us";
export { type Arm, type Variant, averageGift, conversion, perVisitor, significance, verdict } from "./experiments";
