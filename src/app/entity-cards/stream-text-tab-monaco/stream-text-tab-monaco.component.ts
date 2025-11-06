import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  inject,
} from "@angular/core";
import { Store } from "@ngrx/store";
import { editor, languages, IDisposable } from "monaco-types";
import { BehaviorSubject, ReplaySubject, Observable, Subscription } from "rxjs";
import * as ops from "rxjs/operators";
import { StreamMetadata } from "src/app/common/misc-interfaces/stream-metadata";
import { ApiService } from "src/app/core/api/api.service";
import { colorThemeConfig } from "src/app/core/store/global-settings/global-selector";
import { ColorTheme } from "src/app/core/store/global-settings/global-state.types";
import {
  addCommonMonacoActions,
  getDefaultMonacoSettings,
  recalculateFonts,
} from "src/app/core/util";

// Angular's Webpack doesn't like Monaco, but monaco-editor-types *is* available - we
// just need to sub in a couple of our types:
// Available values - https://github.com/microsoft/monaco-editor/blob/gh-pages/node_modules/monaco-editor/monaco.d.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let monaco: any;

@Component({
  selector: "azec-stream-text-tab-monaco",
  templateUrl: "./stream-text-tab-monaco.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StreamTextTabMonacoComponent implements OnDestroy {
  private api = inject(ApiService);
  private store = inject(Store);

  help = `The text preview card provides a text view for a particular text stream.

This behaves similarly to a regular text editor such as Visual Studio Code. Text
can be copied and content can be searched for.

Quick Shortcuts can be found in the F1 menu.
  `;

  _textData: StreamMetadata;
  @Input() set textData(s) {
    this._textData = s;
    this.queryForTextStream();
  }
  get textData() {
    return this._textData;
  }

  text$: Observable<string>;
  ready$ = new BehaviorSubject(false);

  protected editorOptions = getDefaultMonacoSettings();

  protected availableLangs$ =
    new ReplaySubject<languages.ILanguageExtensionPoint>(1);
  protected selectedLanguage$ = new BehaviorSubject("plaintext");
  protected cursorLine$ = new BehaviorSubject(1);
  protected cursorColumn$ = new BehaviorSubject(1);
  protected eolType$ = new ReplaySubject(1);

  protected loadingCard$ = new BehaviorSubject(true);

  private storeSubscription: Subscription;
  private editor: editor.IStandaloneCodeEditor;
  private cursorPosSubscription?: IDisposable;

  constructor() {
    this.storeSubscription = this.store
      .select(colorThemeConfig)
      .subscribe((theme: ColorTheme) => {
        if (theme == ColorTheme.Light) {
          this.editorOptions.theme = "vs-light";
        } else {
          this.editorOptions.theme = "vs-dark";
        }
        this.updateMonacoSettings();
      });
  }

  ngOnDestroy(): void {
    this.storeSubscription?.unsubscribe();
    this.cursorPosSubscription?.dispose();
  }

  queryForTextStream() {
    if (this.textData === null || this.textData === undefined) {
      console.warn(
        "Null data provided to stream-text-tab for rendering has been ignored.",
      );
      return;
    }

    // The second part of the AL filetype is what Monaco expects
    // example: text/plain -> plain, code/csharp -> csharp
    // Invalid types are treated as plain
    const alLanguage = this.textData.file_format || "text/plain";
    const monacoLanguage = alLanguage.includes("/")
      ? alLanguage.split("/")[1]
      : alLanguage;

    this.selectedLanguage$.next(monacoLanguage);
    this.updateMonacoSettings();
    console.log("Updated editor language:", monacoLanguage);

    this.text$ = this.api
      .textStream(this.textData.binary_sha256, this.textData.datastream_sha256)
      .pipe(ops.shareReplay());
  }

  protected onMonacoInit(editor: editor.IEditor) {
    this.cursorPosSubscription?.dispose();

    // 'as' safety: this is always what is created for monaco, as per
    //    https://microsoft.github.io/monaco-editor/typedoc/functions/editor.create.html
    this.editor = editor as editor.IStandaloneCodeEditor;

    this.availableLangs$.next(monaco.languages.getLanguages());

    this.ready$.next(true);

    // Hook model updates so we know when selected content has changed
    this.cursorPosSubscription = this.editor.onDidChangeCursorPosition((e) => {
      this.cursorLine$.next(e.position.lineNumber);
      this.cursorColumn$.next(e.position.column);
    });

    this.eolType$.next(
      this.editor.getModel().getEOL() === "\r\n" ? "CRLF" : "LF",
    );

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
    monaco.editor.setModelLanguage(model, this.selectedLanguage$.value);
  }
}
