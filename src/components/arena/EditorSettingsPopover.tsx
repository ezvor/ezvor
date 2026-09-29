import { Settings2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_EDITOR_SETTINGS, setCollection, type EditorSettings } from "@/lib/local/store";
import { cn } from "@/lib/utils";
import { IconBtn } from "./ui";

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];

export function updateEditorSettings(patch: Partial<EditorSettings>) {
  setCollection("settings", (prev) => ({ ...prev, ...patch }));
}

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-muted/50 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EditorSettingsPopover({ settings }: { settings: EditorSettings }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconBtn label="Editor settings">
          <Settings2 className="h-4 w-4" />
        </IconBtn>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 p-3">
        <p className="text-sm font-semibold">Editor settings</p>
        <Row label="Font size">
          <Select
            value={String(settings.fontSize)}
            onValueChange={(v) => updateEditorSettings({ fontSize: Number(v) })}
          >
            <SelectTrigger className="h-7 w-20 text-xs" aria-label="Font size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)} className="text-xs">
                  {s}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Tab size">
          <Segmented
            label="Tab size"
            value={settings.tabSize}
            options={[
              { value: 2, label: "2" },
              { value: 4, label: "4" },
            ]}
            onChange={(v) => updateEditorSettings({ tabSize: v })}
          />
        </Row>
        <Row label="Theme">
          <Segmented
            label="Theme"
            value={settings.theme}
            options={[
              { value: "vs-dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(v) => updateEditorSettings({ theme: v })}
          />
        </Row>
        <Row label="Word wrap" htmlFor="ed-wrap">
          <Switch
            id="ed-wrap"
            checked={settings.wordWrap}
            onCheckedChange={(v) => updateEditorSettings({ wordWrap: v })}
          />
        </Row>
        <Row label="Minimap" htmlFor="ed-minimap">
          <Switch
            id="ed-minimap"
            checked={settings.minimap}
            onCheckedChange={(v) => updateEditorSettings({ minimap: v })}
          />
        </Row>
        <div className="flex justify-end border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() =>
              updateEditorSettings({
                fontSize: DEFAULT_EDITOR_SETTINGS.fontSize,
                tabSize: DEFAULT_EDITOR_SETTINGS.tabSize,
                wordWrap: DEFAULT_EDITOR_SETTINGS.wordWrap,
                minimap: DEFAULT_EDITOR_SETTINGS.minimap,
                theme: DEFAULT_EDITOR_SETTINGS.theme,
              })
            }
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Restore defaults
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
