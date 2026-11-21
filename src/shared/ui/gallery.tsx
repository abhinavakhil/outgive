import { Heart, Users01 } from "@untitledui/icons";
import { useState } from "react";
import type { ReactNode } from "react";
import { Avatar, Badge, Button, Card, Checkbox, Container, Empty, Input, NativeSelect, Panel, PillSelect, ProgressBar, Ring, SearchBar, Stat, TextArea, ThemeToggle, Toggle, Who } from "@/shared/ui";

const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
const COLORS = ["primary", "secondary", "tertiary", "link-color", "link-gray", "primary-destructive", "secondary-destructive"] as const;
const Row = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="flex flex-col gap-3 border-t border-secondary pt-6 first:border-0 first:pt-0">
        <h2 className="text-sm font-semibold tracking-wide text-tertiary uppercase">{title}</h2>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
);

/** Dev-only page at /ui: every design-system component and variant, in the current brand and theme. */
export const Gallery = () => {
    const [pill, setPill] = useState("Individuals");
    const [q, setQ] = useState("");
    return (
        <Container className="flex flex-col gap-6 py-10">
            <header className="flex items-center justify-between"><h1 className="text-display-xs font-semibold text-primary">Outgive UI</h1><ThemeToggle /></header>
            <Row title="Button · color">{COLORS.map((c) => <Button key={c} color={c}>{c}</Button>)}</Row>
            <Row title="Button · size">{SIZES.map((s) => <Button key={s} size={s}>Size {s}</Button>)}<Button iconLeading={Heart}>With icon</Button><Button isDisabled>Disabled</Button></Row>
            <Row title="Inputs">
                <div className="grid w-full gap-4 sm:grid-cols-2">
                    <Input label="Name" placeholder="Amara Okafor" hint="As it appears on the board" />
                    <SearchBar label="Search" value={q} onChange={setQ} placeholder="Search supporters" />
                    <Input label="With error" isInvalid hint="This field is required" />
                    <NativeSelect label="Currency" options={["USD", "GBP", "EUR"].map((v) => ({ label: v, value: v }))} />
                    <TextArea label="Message" placeholder="Say why you gave" rows={3} />
                    <div className="flex flex-col gap-3"><PillSelect label="Kind" value={pill} onChange={setPill} options={["Individuals", "Teams", "Companies"]} /><Checkbox label="Give monthly" /><Toggle label="Show on the board" defaultSelected /></div>
                </div>
            </Row>
            <Row title="Badges and avatars">{(["gray", "brand", "success", "warning", "error"] as const).map((c) => <Badge key={c} color={c}>{c}</Badge>)}<Avatar initials="AO" size="md" /><Who name="Jonas Weber" /></Row>
            <Row title="Progress"><div className="w-full max-w-md"><ProgressBar value={62} labelPosition="right" /></div><Ring value={62} /></Row>
            <Row title="Cards">
                <div className="grid w-full gap-4 md:grid-cols-3">
                    <Card><div className="font-semibold text-primary">Card</div><p className="text-sm text-tertiary">The base surface.</p></Card>
                    <Stat icon={Users01} label="Supporters" value="412" trend="+18 this week" />
                    <Stat icon={Heart} label="Raised" value="$18,420" tone="brand" />
                </div>
                <Panel className="w-full" title="Panel" sub="A card with a heading row and an action." action={<Button size="sm" color="secondary">Action</Button>}><Empty icon={Heart} title="Nothing here yet" sub="Empty states use this." /></Panel>
            </Row>
        </Container>
    );
};
