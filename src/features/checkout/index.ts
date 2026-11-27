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
