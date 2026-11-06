"use client";

import { type ComponentType, type HTMLAttributes, type ReactNode, type Ref, createContext, useContext, useState } from "react";
import { Eye, EyeOff, HelpCircle, InfoCircle } from "@untitledui/icons";
import type { InputProps as AriaInputProps, TextFieldProps as AriaTextFieldProps } from "react-aria-components";
import { Button as AriaButton, Group as AriaGroup, Input as AriaInput, TextField as AriaTextField } from "react-aria-components";
import { HintText } from "@/shared/ui/base/input/hint-text";
import { Label } from "@/shared/ui/base/input/label";
import { Tooltip, TooltipTrigger } from "@/shared/ui/base/tooltip/tooltip";
import { cx, sortCx } from "@/shared/utils/cx";

export interface InputBaseProps extends Omit<AriaInputProps, "size"> {
    /** Tooltip message on hover. */
    tooltip?: string;
    /** Whether the input is invalid. */
    isInvalid?: boolean;
    /** Whether the input is disabled. */
    isDisabled?: boolean;
    /** Whether the input is required. */
    isRequired?: boolean;
    /**
     * Input size.
     * @default "md"
     */
    size?: "sm" | "md" | "lg";
    /** Placeholder text. */
    placeholder?: string;
    /** Class name for the icon. */
    iconClassName?: string;
    /** Class name for the input. */
    inputClassName?: string;
    /** Class name for the input wrapper. */
    wrapperClassName?: string;
    /** Class name for the tooltip. */
    tooltipClassName?: string;
    /** Keyboard shortcut to display. */
    shortcut?: string | boolean;
    /** Ref for the underlying input element. */
    ref?: Ref<HTMLInputElement>;
    /** Ref for the group element that wraps the input, its icon, tooltip and shortcut. */
    groupRef?: Ref<HTMLDivElement>;
    /** Icon component to display on the left side of the input. */
    icon?: ComponentType<HTMLAttributes<HTMLOrSVGElement>>;
}

export const InputBase = ({
    ref,
    tooltip,
    shortcut,
    groupRef,
    size = "md",
    isInvalid,
    isDisabled,
    isRequired,
    icon: Icon,
    placeholder,
    wrapperClassName,
    tooltipClassName,
    inputClassName,
    iconClassName,
    type = "text",
    ...inputProps
}: InputBaseProps) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // Check if the input has a leading icon or tooltip
    const hasTrailingIcon = tooltip || isInvalid;
    const hasLeadingIcon = Icon;

    // If the input is inside a `TextFieldContext`, use its context to simplify applying styles
    const context = useContext(TextFieldContext);

    const inputSize = context?.size || size;

    const sizes = sortCx({
        // Heights 40 / 48 / 52: lg is Teseria's search bar.
        sm: {
            root: cx("h-10 px-3.5 text-sm", hasLeadingIcon && "pl-9.5", hasTrailingIcon && "pr-9"),
            iconLeading: "left-3.5 size-4",
            iconTrailing: "right-3.5",
            shortcut: "right-3",
        },
        md: {
            root: cx("h-12 px-3.5 text-sm", hasLeadingIcon && "pl-10", hasTrailingIcon && "pr-9.5"),
            iconLeading: "left-3.5 size-4",
            iconTrailing: "right-3.5",
            shortcut: "right-3",
        },
        lg: {
            root: cx("h-13 px-3.5 text-sm", hasLeadingIcon && "pl-10", hasTrailingIcon && "pr-10"),
            iconLeading: "left-3.5 size-4",
            iconTrailing: "right-3.5",
            shortcut: "right-3.5",
        },
    });

    return (
        <AriaGroup
            {...{ isDisabled, isInvalid }}
            ref={groupRef}
            className={({ isFocusWithin, isDisabled, isInvalid }) =>
                cx(
                    "group/input relative flex w-full flex-row place-content-center place-items-center rounded-2xl bg-field shadow-edge ring-1 ring-transparent transition duration-100 ease-linear ring-inset hover:bg-field-hover",

                    isFocusWithin && !isDisabled && "bg-field ring-[color-mix(in_srgb,var(--ts-fg)_24%,transparent)]",

                    // Disabled state styles
                    isDisabled && "cursor-not-allowed opacity-50",
                    "group-disabled:cursor-not-allowed group-disabled:opacity-50",

                    // Invalid state styles
                    isInvalid && "ring-error_subtle",
                    "group-invalid:ring-error_subtle",

                    // Invalid state with focus-within styles
                    isInvalid && isFocusWithin && "ring-2 ring-error",
                    isFocusWithin && "group-invalid:ring-2 group-invalid:ring-error",

                    context?.wrapperClassName,
                    wrapperClassName,
                )
            }
        >
            {/* Leading icon and Payment icon */}
            {Icon && (
                <Icon className={cx("pointer-events-none absolute text-fg-quaternary", sizes[inputSize].iconLeading, context?.iconClassName, iconClassName)} />
            )}

            {/* Input field */}
            <AriaInput
                {...(inputProps as AriaInputProps)}
                ref={ref}
                required={isRequired}
                type={type === "password" && isPasswordVisible ? "text" : type}
                placeholder={placeholder}
                className={cx(
                    "m-0 w-full bg-transparent text-ink caret-ink ring-0 outline-hidden placeholder:text-ink-faint autofill:rounded-2xl autofill:text-primary disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:hidden",
                    sizes[inputSize].root,
                    context?.inputClassName,
                    inputClassName,
                )}
            />

            {/* Tooltip and help icon */}
            {tooltip && type !== "password" && (
                <Tooltip title={tooltip} placement="top">
                    <TooltipTrigger
                        className={cx(
                            "absolute cursor-pointer text-fg-quaternary transition duration-100 ease-linear group-invalid/input:hidden hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover",
                            sizes[inputSize].iconTrailing,
                            context?.tooltipClassName,
                            tooltipClassName,
                        )}
                    >
                        <HelpCircle className="size-4 stroke-[2.25px]" />
                    </TooltipTrigger>
                </Tooltip>
            )}

            {/* Invalid icon */}
            {type !== "password" && (
                <InfoCircle
                    className={cx(
                        "pointer-events-none absolute hidden size-4 stroke-[2.25px] text-fg-error-secondary group-invalid/input:block",
                        sizes[inputSize].iconTrailing,
                        context?.tooltipClassName,
                        tooltipClassName,
                    )}
                />
            )}

            {/* Password visibility toggle */}
            {type === "password" && (
                <AriaButton
                    aria-label="Toggle password visibility"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className={cx(
                        "absolute flex cursor-pointer items-center justify-center text-fg-quaternary transition duration-100 ease-linear hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover focus:outline-hidden",
                        sizes[inputSize].iconTrailing,
                    )}
                >
                    {isPasswordVisible ? <EyeOff className="size-4 stroke-[2.25px]" /> : <Eye className="size-4 stroke-[2.25px]" />}
                </AriaButton>
            )}

            {/* Shortcut */}
            {shortcut && (
                <div
                    className={cx(
                        "pointer-events-none absolute inset-y-0 z-10 hidden items-center md:flex",
                        sizes[inputSize].shortcut,
                    )}
                >
                    <span
                        aria-hidden="true"
                        className="pointer-events-none rounded-md bg-tint-2 px-1.5 py-0.5 text-[11px] leading-none font-medium text-ink-3 select-none dark:bg-tint-3"
                    >
                        {typeof shortcut === "string" ? shortcut : "⌘K"}
                    </span>
                </div>
            )}
        </AriaGroup>
    );
};

InputBase.displayName = "InputBase";

type TextFieldContextProps = Partial<Pick<InputBaseProps, "size" | "wrapperClassName" | "inputClassName" | "iconClassName" | "tooltipClassName">>;

const TextFieldContext = createContext<TextFieldContextProps>({});

export interface TextFieldProps extends AriaTextFieldProps, TextFieldContextProps {}

export const TextField = ({ className, size = "md", inputClassName, wrapperClassName, iconClassName, tooltipClassName, ...props }: TextFieldProps) => {
    return (
        <TextFieldContext.Provider value={{ inputClassName, wrapperClassName, iconClassName, tooltipClassName, size }}>
            <AriaTextField
                {...props}
                data-input-wrapper
                data-input-size={size}
                className={(state) =>
                    cx("group flex h-max w-full flex-col items-start justify-start gap-1.5", typeof className === "function" ? className(state) : className)
                }
            />
        </TextFieldContext.Provider>
    );
};

TextField.displayName = "TextField";

export interface InputProps
    extends
        AriaTextFieldProps,
        Pick<
            InputBaseProps,
            | "ref"
            | "placeholder"
            | "icon"
            | "shortcut"
            | "tooltip"
            | "groupRef"
            | "size"
            | "wrapperClassName"
            | "inputClassName"
            | "iconClassName"
            | "tooltipClassName"
        > {
    /** Label text for the input */
    label?: string;
    /** Helper text displayed below the input */
    hint?: ReactNode;
    /** Whether to hide required indicator from label */
    hideRequiredIndicator?: boolean;
}

export const Input = ({
    size = "md",
    placeholder,
    icon: Icon,
    label,
    hint,
    shortcut,
    hideRequiredIndicator,
    className,
    ref,
    groupRef,
    tooltip,
    iconClassName,
    inputClassName,
    wrapperClassName,
    tooltipClassName,
    type = "text",
    ...props
}: InputProps) => {
    return (
        <TextField aria-label={!label ? placeholder : undefined} {...props} size={size} className={className}>
            {({ isRequired, isInvalid }) => (
                <>
                    {label && (
                        <Label isRequired={hideRequiredIndicator ? !hideRequiredIndicator : isRequired} isInvalid={isInvalid}>
                            {label}
                        </Label>
                    )}

                    <InputBase
                        {...{
                            ref,
                            groupRef,
                            size,
                            placeholder,
                            icon: Icon,
                            shortcut,
                            iconClassName,
                            inputClassName,
                            wrapperClassName,
                            tooltipClassName,
                            tooltip,
                            type,
                        }}
                    />

                    {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
                </>
            )}
        </TextField>
    );
};

Input.displayName = "Input";
