import {
  Component,
  Input,
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
  selector: "az-yara-editor",
  standalone: true,
  template: `
    <div class="h-full w-full border border-red-500">
      <div #container class="h-full w-full border border-blue-500"></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YaraEditorComponent implements AfterViewInit, OnChanges {
  @ViewChild("container", { static: true }) container!: ElementRef;

  @Input() code = "";
  @Input() readonly = false;
  @Output() codeChange = new EventEmitter<string>();

  @Input() language = "yara";

  private editor!: monaco.editor.IStandaloneCodeEditor;
  private editorOptions: monaco.editor.IStandaloneEditorConstructionOptions =
    getDefaultMonacoSettings();

  ngAfterViewInit() {
    this.editorOptions.readOnly = this.readonly;
    this.loadMonacoLoader()
      .then(() => this.waitForMonaco())
      .then(() => this.initEditor());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["readonly"] && this.editor) {
      this.editor.updateOptions({ readOnly: this.readonly });
    }

    if (changes["code"] && this.editor) {
      const newValue = changes["code"].currentValue ?? "";
      const currentValue = this.editor.getValue();

      if (newValue !== currentValue) {
        this.editor.setValue(newValue);
      }
    }

    if (changes["language"] && this.editor) {
      const monacoGlobal = (window as unknown as { monaco: typeof monaco })
        .monaco;
      const model = this.editor.getModel();

      if (model) {
        monacoGlobal.editor.setModelLanguage(model, this.language);
      }
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
      value: String(this.code ?? ""),
      language: this.language,
      automaticLayout: true,
    });

    this.editor.onDidChangeModelContent(() => {
      this.codeChange.emit(this.editor.getValue());
    });

    recalculateFonts();

    requestAnimationFrame(() => {
      this.editor.layout();
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
}
