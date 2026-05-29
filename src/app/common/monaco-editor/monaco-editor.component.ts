import {
  Component,
  Input,
  effect,
  input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
} from "@angular/core";

import { getDefaultMonacoSettings, recalculateFonts } from "src/app/core/util";
import { ColorTheme } from "src/app/core/store/global-settings/global-state.types";
import * as monaco from "monaco-editor";

interface MonacoAmdRequire {
  (modules: string[], callback: () => void): void;
  config: (options: { paths: Record<string, string> }) => void;
}

interface MonacoWindow extends Window {
  require?: MonacoAmdRequire;
  monaco?: typeof monaco;
}

@Component({
  selector: "az-monaco-editor",
  standalone: true,
  template: `
    <div class="h-full w-full">
      <div #container class="h-full w-full border border-blue-500"></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonacoEditorComponent implements AfterViewInit, OnChanges {
  @ViewChild("container", { static: true }) container!: ElementRef;

  code = input<string>("");
  readonly = input<boolean>(false);
  language = input<string>("yara");
  @Input() theme: ColorTheme = ColorTheme.Dark;
  @Output() codeChange = new EventEmitter<string>();

  private editor!: monaco.editor.IStandaloneCodeEditor;
  private editorOptions: monaco.editor.IStandaloneEditorConstructionOptions =
    getDefaultMonacoSettings();

  constructor() {
    effect(() => {
      if (this.editor) {
        this.editor.updateOptions({ readOnly: this.readonly() });
      }
    });

    effect(() => {
      if (!this.editor) return;
      const newValue = this.code() ?? "";
      if (newValue !== this.editor.getValue()) {
        this.editor.setValue(newValue);
      }
    });

    effect(() => {
      if (!this.editor) return;

      const monacoGlobal = (window as unknown as MonacoWindow).monaco;
      if (!monacoGlobal) return;

      const model = this.editor.getModel();
      if (model) {
        monacoGlobal.editor.setModelLanguage(model, this.language());
      }
    });
  }

  ngAfterViewInit() {
    this.editorOptions.readOnly = this.readonly();
    this.loadMonacoLoader()
      .then(() => this.waitForMonaco())
      .then(() => this.initEditor());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["theme"] && this.editor) {
      console.log("Monaco ngOnChanges fired:", changes);

      const monacoGlobal = (window as unknown as MonacoWindow).monaco;
      if (!monacoGlobal) return;

      const isDark = this.theme === ColorTheme.Dark;

      monacoGlobal.editor.setTheme(isDark ? "vs-dark" : "vs");
      this.editor.layout();
    }
  }

  private loadMonacoLoader(): Promise<void> {
    return new Promise((resolve) => {
      const win = window as unknown as MonacoWindow;

      if (win.require) {
        resolve();
        return;
      }

      const loaderScript = document.createElement("script");
      loaderScript.type = "text/javascript";
      loaderScript.src = "assets/monaco/min/vs/loader.js";

      loaderScript.onload = () => {
        const win2 = window as unknown as MonacoWindow;

        win2.require?.config({
          paths: { vs: "assets/monaco/min/vs" },
        });

        resolve();
      };

      document.body.appendChild(loaderScript);
    });
  }

  private waitForMonaco(): Promise<void> {
    return new Promise((resolve) => {
      const win = window as unknown as MonacoWindow;

      win.require?.(["vs/editor/editor.main"], () => {
        resolve();
      });
    });
  }

  private initEditor() {
    const monacoGlobal = (window as unknown as { monaco: typeof monaco })
      .monaco;
    if (!monacoGlobal) {
      console.error("[YARA] Monaco STILL not defined inside initEditor()");
      return;
    }

    this.registerYaraLanguage(monacoGlobal);

    this.editor = monacoGlobal.editor.create(this.container.nativeElement, {
      ...this.editorOptions,
      value: String(this.code() ?? ""),
      language: this.language(),
      automaticLayout: true,
    });

    this.editor.onDidChangeModelContent(() => {
      this.codeChange.emit(this.editor.getValue());
    });

    recalculateFonts();

    requestAnimationFrame(() => {
      this.editor.layout();
      this.applyTheme();
    });
  }

  private registerYaraLanguage(monacoInstance: typeof monaco) {
    if (!monacoInstance.languages.getLanguages().some((l) => l.id === "yara")) {
      monacoInstance.languages.register({ id: "yara" });

      const yaraTokens: monaco.languages.IMonarchLanguage = {
        tokenizer: {
          root: [
            [/\brule\b|\bmeta\b|\bstrings\b|\bcondition\b/, "keyword"],
            [/\$[A-Za-z_][A-Za-z0-9_]*/, "variable"],
            [/".*?"/, "string"],
            [/\/.*?\//, "string"],
            [/\{[0-9A-Fa-f? ]+\}/, "string"],
            [/[A-Za-z_][A-Za-z0-9_]*/, "identifier"],
            [/\/\/.*/, "comment"],
            [/\b\d+\b/, "number"],
          ],
        },
      };

      monacoInstance.languages.setMonarchTokensProvider("yara", yaraTokens);
    }
  }

  private applyTheme() {
    const monacoGlobal = (window as unknown as MonacoWindow).monaco;
    if (!monacoGlobal) return;

    const isDark = document.documentElement.classList.contains("dark");
    monacoGlobal.editor.setTheme(isDark ? "vs-dark" : "vs");
  }
}
