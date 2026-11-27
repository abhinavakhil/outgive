/**
 * "Book a demo": a short form that opens from any link to #demo, on any page that renders <DemoRequest />.
 * Built on react-aria-components (modal, text fields, select, text area) for keyboard and screen-reader support,
 * styled with the Outgive design system in site-shell.css.
 * Answers go to a Google Form, so every request lands in its responses sheet. Until the form is connected below,
 * sending opens an email to us with the same details, so no request is lost.
 */
import { type FormEvent, useEffect, useState } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Input, Select, TextArea } from "@/shared/ui/fields";
import { track } from "@/shared/lib/analytics";
import "./site-shell.css";

/**
 * The Google Form the answers go to (the waitlist on "Coming soon" pages uses it too). `action` is the form's address ending in
 * /formResponse; each field maps to its entry id, both from the form's "Get pre-filled link". Leave `action` empty to fall back to email.
 * Google drops a response silently if a required question is empty or a choice doesn't match an option exactly, so the form's
 * required questions are required here too, and TYPES match its options. The form has no phone question: the phone goes in the message.
 */
export const DEMO_FORM = {
    action: "https://docs.google.com/forms/d/e/1FAIpQLSfiCeL_oPHvbx7z_V_RvUS2qERW7KwYl8d4vk1dDaZz1TsTWQ/formResponse",
    fields: { name: "entry.724948910", email: "entry.1978901479", organisation: "entry.317468016", type: "entry.1709615057", country: "entry.858591767", message: "entry.1410932910", phone: "" },
};
const FALLBACK_EMAIL = "hello@outgive.tech";
export const DEMO_HASH = "#demo";

/** [label, the form's option]. */
const TYPES: [string, string][] = [["Charity", "Charity"], ["Mosque", "Mosque"], ["Community group", "Community Group"], ["Other", "Other"]];
type Answers = { name: string; email: string; phone: string; organisation: string; type: string; country: string; message: string };
const EMPTY: Answers = { name: "", email: "", phone: "", organisation: "", type: "", country: "", message: "" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sends to the Google Form. Google does not allow reading the reply from another site, so "no-cors" is the only way; a thrown error means it did not go. */
const send = async (a: Answers) => {
    if (!DEMO_FORM.action) {
        const body = Object.entries(a).filter(([, v]) => v).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join("\n");
        window.location.href = `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(`Demo request: ${a.organisation}`)}&body=${encodeURIComponent(body)}`;
        return;
    }
    await postForm({ ...a, type: TYPES.find(([l]) => l === a.type)?.[1] ?? a.type, message: [a.message.trim(), a.phone.trim() && `Phone: ${a.phone.trim()}`].filter(Boolean).join("\n\n") });
};

/** Posts answers to the Google Form. Google sends no CORS headers, so the reply can't be read: only a network failure throws. */
export const postForm = async (a: Partial<Record<keyof typeof DEMO_FORM.fields, string>>) => {
    const body = new URLSearchParams();
    for (const [k, id] of Object.entries(DEMO_FORM.fields)) if (id && a[k as keyof typeof a]) body.append(id, a[k as keyof typeof a]!);
    await fetch(DEMO_FORM.action, { method: "POST", mode: "no-cors", body });
};

export const DemoRequest = () => {
    const [open, setOpen] = useState(false);
    const [a, setA] = useState<Answers>(EMPTY);
    const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
    const [err, setErr] = useState<{ field?: keyof Answers; text: string }>({ text: "" });

    // Open on #demo, from any link on the page; closing clears the hash so the same link works again.
    useEffect(() => {
        const sync = () => { if (window.location.hash === DEMO_HASH) { setOpen(true); track("demo-opened", { page: window.location.pathname }); } };
        sync(); window.addEventListener("hashchange", sync);
        return () => window.removeEventListener("hashchange", sync);
    }, []);
    const onOpenChange = (o: boolean) => {
        setOpen(o);
        if (o) return;
        if (window.location.hash === DEMO_HASH) history.replaceState(null, "", window.location.pathname + window.location.search);
        if (state === "sent") { setA(EMPTY); setState("idle"); }
    };

    const set = (k: keyof Answers) => (v: string) => { setA((x) => ({ ...x, [k]: v })); setErr({ text: "" }); };
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!a.name.trim()) return setErr({ field: "name", text: "Add your full name." });
        if (!EMAIL.test(a.email.trim())) return setErr({ field: "email", text: "Add an email we can reply to." });
        if (!a.organisation.trim()) return setErr({ field: "organisation", text: "Add your organisation's name." });
        if (!a.type) return setErr({ field: "type", text: "Choose your organisation type." });
        if (!a.country.trim()) return setErr({ field: "country", text: "Add your country." });
        setState("sending");
        try { await send({ ...a, name: a.name.trim(), email: a.email.trim(), organisation: a.organisation.trim(), country: a.country.trim() }); setState("sent"); track("demo-requested", { type: a.type || "unset" }); }
        catch { setState("idle"); setErr({ text: `It didn't send. Check your connection and try again, or email ${FALLBACK_EMAIL}.` }); }
    };

    return (
        <ModalOverlay isOpen={open} onOpenChange={onOpenChange} isDismissable className="og-overlay">
            <Modal className="og-dialog">
                <Dialog aria-label="Book a demo" className="outline-none">
                    {({ close }) => state === "sent" ? (
                        <div className="flex flex-col items-start gap-4 p-8">
                            <span className="og-tag" style={{ background: "#EEF2D6", color: "#4B5530" }}>Request received</span>
                            <Heading slot="title" className="text-[34px] leading-[1.02] font-medium tracking-[-0.05em]">Thank you, {a.name.split(" ")[0]}.</Heading>
                            <p className="text-[16px] leading-relaxed text-[#666]">We'll be in touch at <b className="font-semibold text-[#191919]">{a.email}</b> to set up {a.organisation}'s own Ramadan page, donate flow and dashboard.</p>
                            <Button onPress={close} className="og-submit mt-2 !w-auto px-8">Done</Button>
                        </div>
                    ) : (
                        <form noValidate onSubmit={submit} className="flex flex-col gap-5 p-7 sm:p-8">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <Heading slot="title" className="text-[32px] leading-[1.02] font-medium tracking-[-0.05em]">Book a <span className="og-script">demo.</span></Heading>
                                    <p className="mt-2 text-[15px] leading-relaxed text-[#666]">We'll set up your own Ramadan landing page, donate flow and dashboard to try.</p>
                                </div>
                                <Button onPress={close} aria-label="Close" className="og-close"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input label="Full name" isRequired value={a.name} onChange={set("name")} placeholder="Jane Smith" autoComplete="name" isInvalid={err.field === "name"} />
                                <Input label="Work email" isRequired type="email" value={a.email} onChange={set("email")} placeholder="you@organisation.org" autoComplete="email" isInvalid={err.field === "email"} />
                                <Input label="Organisation name" isRequired value={a.organisation} onChange={set("organisation")} placeholder="e.g. Hope Foundation" autoComplete="organization" isInvalid={err.field === "organisation"} />
                                <Input label="Phone number" type="tel" value={a.phone} onChange={set("phone")} placeholder="+44 7700 900000" autoComplete="tel" />
                                <Select label="Organisation type" isRequired value={a.type} onChange={set("type")} placeholder="Select type" options={TYPES.map(([t]) => ({ label: t, value: t }))} />
                                <Input label="Country" isRequired value={a.country} onChange={set("country")} placeholder="e.g. United Kingdom" autoComplete="country-name" isInvalid={err.field === "country"} />
                            </div>
                            <TextArea label="Tell us about your appeal" rows={3} value={a.message} onChange={set("message")} placeholder="What are you raising for, and roughly how much?" />
                            <p role="alert" className="og-error">{err.text}</p>
                            <Button type="submit" isDisabled={state === "sending"} className="og-submit">{state === "sending" ? "Sending…" : "Book my demo"}</Button>
                            <p className="-mt-1 text-center text-[13px] text-[#8F8F8F]">We'll only use these details to contact you about Outgive.</p>
                        </form>
                    )}
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
