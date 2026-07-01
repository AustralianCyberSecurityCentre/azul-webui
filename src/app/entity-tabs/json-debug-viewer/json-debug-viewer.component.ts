import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  input,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { textEditorConfig } from "@app/core/store/global-settings/global-selector";
import { ColorTheme } from "@app/core/store/global-settings/global-state.types";
import {
  addCommonMonacoActions,
  getDefaultMonacoSettings,
  recalculateFonts,
} from "@app/core/util";
import { Store } from "@ngrx/store";
import { editor } from "monaco-types";
import { MonacoEditorModule } from "ngx-monaco-editor-v2";
import { Subscription } from "rxjs";

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
export class JsonDebugViewerComponent implements OnDestroy {
  private store = inject(Store);

  text = input<string>("");
  language = input<string>("json");
  fullHeight = input<boolean>(false);

  protected editorOptions = getDefaultMonacoSettings();
  protected debugEditorHeight: number;

  private storeSubscription: Subscription;
  private editor: editor.IStandaloneCodeEditor;

  private wordWrapEnabled = false;

  constructor() {
    this.storeSubscription = this.store
      .select(textEditorConfig)
      .subscribe(({ theme, editorHeight }) => {
        if (theme == ColorTheme.Light) {
          this.editorOptions.theme = "vs-light";
        } else {
          this.editorOptions.theme = "vs-dark";
        }
        this.debugEditorHeight = editorHeight;
        this.updateMonacoSettings();
      });
  }

  ngOnDestroy(): void {
    this.storeSubscription?.unsubscribe();
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
