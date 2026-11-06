import { SearchLg } from "@untitledui/icons";
import { Input, type InputProps } from "@/shared/ui/base/input/input";

/** Search field: the standard Input with a search icon and the native clear button. */
export const SearchBar = ({ placeholder = "Search", ...props }: Omit<InputProps, "icon" | "type">) => <Input {...props} type="search" icon={SearchLg} placeholder={placeholder} />;
