import { Palette, RefreshCw01, Upload01 } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { BrandMark, useApp } from "@/components/outgive/shared";
import { BRAND_PRESETS, DEFAULT_BRAND, FONTS, type Brand } from "@/data";
import { ALL_VARIANTS } from "@/views/boards";
import { cx } from "@/utils/cx";

/** "See it with your branding": a charity previews the board as its own, live, as it types. */
export const BrandPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const { brand, setBrand } = useApp();
    const set = (patch: Partial<Brand>) => setBrand({ ...brand, ...patch });
    const onLogo = (file: File | undefined) => {
        if (!file) return;
        if (file.size > 400_000) return alert("Keep the logo under 400 KB for this demo.");
        const r = new FileReader(); r.onload = () => set({ logo: String(r.result) }); r.readAsDataURL(file);
    };
    return (
        <ModalOverlay isOpen={open} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
            <Modal className="max-w-lg"><Dialog aria-label="Your branding">
                <div className="flex flex-col gap-5 p-5 md:p-6">
                    <div className="flex items-start gap-3">
                        <BrandMark className="size-12 rounded-2xl text-lg" />
                        <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-primary">See it with your branding</h2><p className="text-sm text-tertiary">The board recolours as you type. Nothing leaves your browser.</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Example charities">
                        {BRAND_PRESETS.map((p) => (
                            <button key={p.name} type="button" onClick={() => setBrand(p)} className={cx("flex cursor-pointer items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-sm font-medium ring-1 ring-inset transition", brand.name === p.name && brand.color === p.color ? "bg-brand-primary text-primary ring-brand" : "text-secondary ring-secondary hover:bg-secondary")}>
                                <span className="size-5 rounded-full" style={{ background: p.color }} />{p.name}
                            </button>
                        ))}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Charity name" value={brand.name} onChange={(v) => set({ name: v })} />
                        <Input label="Tagline" value={brand.tagline} onChange={(v) => set({ tagline: v })} />
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary">Brand colour
                            <span className="flex h-10 items-center gap-3 rounded-lg px-3 ring-1 ring-primary ring-inset">
                                <input type="color" aria-label="Brand colour" value={brand.color} onChange={(e) => set({ color: e.target.value })} className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0" />
                                <span className="font-mono text-sm text-tertiary uppercase">{brand.color}</span><Palette className="ml-auto size-4 text-quaternary" />
                            </span>
                        </label>
                        <NativeSelect label="Font" value={brand.font} onChange={(e) => set({ font: e.target.value })} options={FONTS.map((f) => ({ label: f, value: f }))} />
                        <NativeSelect label="Ranking layout" value={brand.variant} onChange={(e) => set({ variant: e.target.value as Brand["variant"] })} options={ALL_VARIANTS.map(([v, l]) => ({ label: l, value: v }))} />
                        <Input label="What gifts buy (plural)" placeholder="boreholes" value={brand.impact?.unit ?? ""} onChange={(v) => set({ impact: { usd: brand.impact?.usd ?? 100, unit: v } })} />
                        <Input label="Cost of one (USD)" type="number" value={String(brand.impact?.usd ?? "")} onChange={(v) => set({ impact: { usd: Number(v), unit: brand.impact?.unit ?? "" } })} />
                        <label className="flex flex-col gap-1.5 text-sm font-medium text-secondary sm:col-span-2">Logo
                            <span className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-tertiary ring-1 ring-primary ring-inset hover:bg-secondary"><Upload01 className="size-4" />{brand.logo ? "Replace image" : "Upload image"}
                                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} /></span>
                        </label>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <Button size="md" color="tertiary" iconLeading={RefreshCw01} onPress={() => setBrand(DEFAULT_BRAND)}>Reset</Button>
                        <Button size="md" color="primary" onPress={onClose}>Done</Button>
                    </div>
                </div>
            </Dialog></Modal>
        </ModalOverlay>
    );
};
