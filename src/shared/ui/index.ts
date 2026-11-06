/**
 * The Outgive design system. Features import UI only from here: `import { Button, Card, Input } from "@/shared/ui"`.
 * Components take variant/size props and use theme tokens (bg-primary, text-tertiary, brand-*), so charity branding and dark mode reach all of them.
 * Files under base/, application/ and foundations/ started as Untitled UI source and are ours to edit; add a component there, then export it here.
 */

// Primitives
export { Button } from "./base/buttons/button";
export { Input } from "./base/input/input";
export { TextArea } from "./base/textarea/textarea";
export { NativeSelect } from "./base/select/select-native";
export { Checkbox } from "./base/checkbox/checkbox";
export { Toggle } from "./base/toggle/toggle";
export { Badge } from "./base/badges/badges";
export { Avatar } from "./base/avatar/avatar";
export { ProgressBar, ProgressBarBase } from "./base/progress-indicators/progress-indicators";
export { Tooltip, TooltipTrigger } from "./base/tooltip/tooltip";
export { SearchBar } from "./search-bar";
export { FIELD, PillSelect } from "./pill-select";

// Overlays, navigation, uploads
export { Dialog, DialogTrigger, Modal, ModalOverlay } from "./application/modals/modal";
export { DialogHead, DialogShell, ShareDialog, shareTargets } from "./dialog";
export { Tab, TabList, TabPanel, Tabs } from "./application/tabs/tabs";
export { FileUpload } from "./application/file-upload/file-upload-base";

// Layout and display
export { Card, ConsoleShell, Container, Fieldset, Panel, SiteHeader, TwoCol } from "./layout";
export { CopyRow, Empty, Ring, Stat, Who } from "./display";
export { BrandLogo, BrandMark, Logo, ThemeToggle } from "./brand";
export { Confetti } from "./confetti";
export { NotFound } from "./not-found";

// Media and icons
export { CoverMedia, DescriptionEditor, DescriptionView, readImage, youtubeId } from "./media";
export { FeaturedIcon } from "./foundations/featured-icon/featured-icon";
export { Facebook, Google, LinkedIn, Reddit, Telegram, X } from "./foundations/social-icons";
