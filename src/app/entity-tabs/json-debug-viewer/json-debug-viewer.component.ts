import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GlobalSettingStore } from "@app/core/signal-store/global-settings.store";
import { ColorTheme } from "@app/core/signal-store/global-state.types";
import {
  addCommonMonacoActions,
  getDefaultMonacoSettings,
  recalculateFonts,
} from "@app/core/util";
import { editor } from "monaco-types";
import { MonacoEditorModule } from "ngx-monaco-editor-v2";

// Angular's Webpack doesn't like Monaco, but monaco-editor-types *is* available - we
// just need to sub in a couple of our types:
// Available values - https://github.com/microsoft/monaco-editor/blob/gh-pages/node_modules/monaco-editor/monaco.d.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let monaco: any;

@Component({
  selector: "azco-json-debug-viewer",
  templateUrl: "./json-debug-viewer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MonacoEditorModule],
})
export class JsonDebugViewerComponent {
  private store = inject(GlobalSettingStore);

  text = input<string>("");
  language = input<string>("json");
  fullHeight = input<boolean>(false);

  protected editorOptions = getDefaultMonacoSettings();
  protected debugEditorHeight: number;

  private editor: editor.IStandaloneCodeEditor;

  private wordWrapEnabled = false;

  constructor() {
    effect(() => {
      if (this.store.theme() == ColorTheme.Light) {
        this.editorOptions.theme = "vs-light";
      } else {
        this.editorOptions.theme = "vs-dark";
      }
      this.debugEditorHeight = this.store.debugQueryEditorHeightPx();
      this.updateMonacoSettings();
    });
  }

  protected onMonacoInit(editor: editor.IEditor) {
    // 'as' safety: this is always what is created for monaco, as per
    //    https://microsoft.github.io/monaco-editor/typedoc/functions/editor.create.html
    this.editor = editor as editor.IStandaloneCodeEditor;
    addCommonMonacoActions(this.editor);
    this.updateMonacoSettings();
  }

  private updateMonacoSettings() {
    if (!this.editor) {
      return;
    }

    console.log("Propagating Monaco changes...");

    recalculateFonts();

    this.editor.updateOptions(this.editorOptions);

    const model = this.editor.getModel();
    monaco.editor.setModelLanguage(model, this.language());
  }
}
