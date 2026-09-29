import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from "@/lib/local/store";

export type CodeEditorSettings = Pick<
  EditorSettings,
  "fontSize" | "tabSize" | "wordWrap" | "minimap" | "theme"
>;

type Props = {
  language: string;
  value: string;
  onChange: (val: string) => void;
  onMount?: OnMount;
  settings?: CodeEditorSettings;
  readOnly?: boolean;
};

export function CodeEditor({
  language,
  value,
  onChange,
  onMount,
  settings = DEFAULT_EDITOR_SETTINGS,
  readOnly,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Tab size is a model option; editor-level updateOptions doesn't apply it.
  useEffect(() => {
    editorRef.current
      ?.getModel()
      ?.updateOptions({ tabSize: settings.tabSize, indentSize: settings.tabSize });
  }, [settings.tabSize, language]);

  return (
    <Editor
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={(ed, monaco) => {
        editorRef.current = ed;
        ed.getModel()?.updateOptions({ tabSize: settings.tabSize, indentSize: settings.tabSize });
        onMount?.(ed, monaco);
      }}
      theme={settings.theme === "light" ? "light" : "vs-dark"}
      loading={
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
      options={{
        fontSize: settings.fontSize,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontLigatures: false,
        minimap: { enabled: settings.minimap, renderCharacters: false },
        wordWrap: settings.wordWrap ? "on" : "off",
        tabSize: settings.tabSize,
        detectIndentation: false,
        readOnly,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        automaticLayout: true,
        padding: { top: 14, bottom: 14 },
        lineNumbersMinChars: 3,
        renderLineHighlight: "line",
        cursorBlinking: "smooth",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        fixedOverflowWidgets: true,
      }}
    />
  );
}
