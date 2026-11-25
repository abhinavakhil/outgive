/**
 * The app's form fields, in the HeroUI style: a soft filled box with the label floating inside it, rounded 14px,
 * a 2px ink ring on focus and a red ring with a message when invalid. Built on react-aria-components (as HeroUI is),
 * so keyboard, labels and errors are handled for us. Colours come from the --ts-* tokens, so dark mode follows.
 *
 * Input, TextArea and NativeSelect keep the props of the components they replace, so every screen switches by import.
 */
import type { ChangeEvent, ReactNode } from "react";
import { Button, FieldError, Input as AriaInput, Label, ListBox, ListBoxItem, Popover, Select as AriaSelect, SelectValue, Text, TextArea as AriaTextArea, TextField, type TextFieldProps } from "react-aria-components";
import { cx } from "@/shared/utils/cx";
import "./fields.css";

type Common = { label?: string; hint?: ReactNode; className?: string; errorMessage?: string };

export type InputProps = Omit<TextFieldProps, "className" | "children"> & Common & { placeholder?: string; size?: "sm" | "md" | "lg"; inputClassName?: string; hideRequiredIndicator?: boolean };

/** A one-line text field. */
export const Input = ({ label, hint, placeholder, className, errorMessage, inputClassName, size: _size, hideRequiredIndicator: _h, ...props }: InputProps) => (
    <TextField {...props} aria-label={!label ? (props["aria-label"] ?? placeholder) : props["aria-label"]} className={cx("ogf", className)}>
        <div className={cx("ogf-box", !label && "ogf-bare")}>
            {label && <Label className="ogf-label">{label}{props.isRequired && <span aria-hidden="true" className="ogf-req"> *</span>}</Label>}
            <AriaInput placeholder={placeholder} className={cx("ogf-input", inputClassName)} />
        </div>
        {hint && <Text slot="description" className="ogf-hint">{hint}</Text>}
        <FieldError className="ogf-error">{errorMessage}</FieldError>
    </TextField>
);

export type TextAreaProps = Omit<TextFieldProps, "className" | "children"> & Common & { placeholder?: string; rows?: number; textAreaClassName?: string };

/** A multi-line text field. */
export const TextArea = ({ label, hint, placeholder, rows = 4, className, errorMessage, textAreaClassName, ...props }: TextAreaProps) => (
    <TextField {...props} aria-label={!label ? (props["aria-label"] ?? placeholder) : props["aria-label"]} className={cx("ogf", className)}>
        <div className={cx("ogf-box ogf-area", !label && "ogf-bare")}>
            {label && <Label className="ogf-label">{label}{props.isRequired && <span aria-hidden="true" className="ogf-req"> *</span>}</Label>}
            <AriaTextArea rows={rows} placeholder={placeholder} className={cx("ogf-input", textAreaClassName)} />
        </div>
        {hint && <Text slot="description" className="ogf-hint">{hint}</Text>}
        <FieldError className="ogf-error">{errorMessage}</FieldError>
    </TextField>
);

const Chevron = () => <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="ogf-chev"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Tick = () => <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export type SelectProps = Common & { options: { label: string; value: string }[]; value?: string; onChange?: (value: string) => void; placeholder?: string; isRequired?: boolean; isDisabled?: boolean; isInvalid?: boolean; "aria-label"?: string };

/** A dropdown: the trigger looks like the other fields, the list opens in a popover. */
export const Select = ({ label, hint, options, value, onChange, placeholder = "Choose one", className, isRequired, isDisabled, isInvalid, errorMessage, ...rest }: SelectProps) => (
    <AriaSelect className={cx("ogf", className)} placeholder={placeholder} selectedKey={value || null} onSelectionChange={(k) => onChange?.(k == null ? "" : String(k))} isRequired={isRequired} isDisabled={isDisabled} isInvalid={isInvalid} aria-label={!label ? (rest["aria-label"] ?? placeholder) : undefined}>
        <Button className={cx("ogf-box ogf-trigger", !label && "ogf-bare")}>
            {label && <Label className="ogf-label">{label}{isRequired && <span aria-hidden="true" className="ogf-req"> *</span>}</Label>}
            <SelectValue className="ogf-input ogf-value" />
            <Chevron />
        </Button>
        {hint && <Text slot="description" className="ogf-hint">{hint}</Text>}
        <FieldError className="ogf-error">{errorMessage}</FieldError>
        <Popover className="ogf-popover" offset={6}>
            <ListBox className="ogf-list">
                {options.map((o) => <ListBoxItem key={o.value} id={o.value} textValue={o.label} className="ogf-option">{({ isSelected }) => <><span>{o.label}</span>{isSelected && <Tick />}</>}</ListBoxItem>)}
            </ListBox>
        </Popover>
    </AriaSelect>
);

/** The old native-select API (onChange gets a change event), drawn as the new Select. */
export const NativeSelect = ({ label, hint, options, value, onChange, className, disabled, required, ...rest }: { label?: string; hint?: ReactNode; options: { label: string; value: string }[]; value?: string; onChange?: (e: ChangeEvent<HTMLSelectElement>) => void; className?: string; disabled?: boolean; required?: boolean; "aria-label"?: string; selectClassName?: string; size?: string }) => (
    <Select label={label} hint={hint} options={options} value={value} className={className} isDisabled={disabled} isRequired={required} aria-label={rest["aria-label"]}
        onChange={(v) => onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)} />
);
