import { Component, inject, OnInit, signal } from "@angular/core";
import {
  FormControl,
  UntypedFormBuilder,
  UntypedFormGroup,
} from "@angular/forms";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Store } from "@ngrx/store";
import * as ops from "rxjs/operators";
import { ColorTheme } from "src/app/core/store/global-settings/global-state.types";
import * as globalAction from "../../core/store/global-settings/global-actions";
import {
  saveBucketSize,
  saveShowDebugInfo,
} from "../../core/store/global-settings/global-actions";
import * as globalSettingsReducer from "../../core/store/global-settings/global-reducer";
import * as fromGlobal from "../../core/store/global-settings/global-selector";
import * as fromGlobalSettings from "../../core/store/global-settings/global-selector";

@Component({
  selector: "az-settings-overlay",
  templateUrl: "./settings-overlay.component.html",
  standalone: false,
})
export class SettingsOverlayComponent implements OnInit {
  private store = inject(Store);
  private fb = inject(UntypedFormBuilder);

  protected entityBucketSizeForm: FormControl;
  protected relationalGraphShowCousinsByDefaultForm: FormControl;
  protected entityShowDebugInfoForm: FormControl;
  protected debugEditorHeightPxForm: FormControl;

  protected formBinaryExploreShowEntropy: FormControl;
  protected formBinaryExploreShowFileFormatLegacy: FormControl;
  protected formBinaryExploreShowMimetype: FormControl;
  protected formBinaryExploreShowMagic: FormControl;

  protected globalForm: UntypedFormGroup;

  protected bucketToggleDelayActiveSignal = signal(false);
  protected readonly smallBucketSize =
    globalSettingsReducer.initialState.bucketSize; // 100
  protected readonly largeBucketSize = 1000;

  protected darkColorTheme = ColorTheme.Dark;
  protected lightColorTheme = ColorTheme.Light;

  protected faSpinner = faSpinner;

  ngOnInit() {
    this.store
      .select(fromGlobal.colorThemeConfig)
      .pipe(ops.first())
      .subscribe((theme: ColorTheme) => {
        this.globalForm = this.fb.group({
          theme: this.fb.group({
            color: [theme],
          }),
        });
      });

    this.globalForm.valueChanges.subscribe((newValues) => {
      this.store.dispatch(
        globalAction.setColorTheme({ newColorTheme: newValues.theme.color }),
      );
    });

    this.store
      .select(fromGlobalSettings.selectBucketSize)
      .pipe(ops.first())
      .subscribe((value) => {
        this.entityBucketSizeForm = this.fb.control(
          value == this.largeBucketSize,
        );
        this.entityBucketSizeForm.valueChanges.subscribe((e) => {
          this.handleBucketSizeChange(e);
        });
      });

    this.store
      .select(fromGlobalSettings.selectRelationalGraphShowCousinsByDefault)
      .pipe(ops.first())
      .subscribe((value) => {
        this.relationalGraphShowCousinsByDefaultForm = this.fb.control(value);
        this.relationalGraphShowCousinsByDefaultForm.valueChanges.subscribe(
          (state: boolean) => {
            this.store.dispatch(
              globalAction.saveRelationalGraphShowCousinsByDefault({
                relationalGraphShowCousinsByDefault: state,
              }),
            );
          },
        );
      });

    this.store
      .select(fromGlobalSettings.selectShowDebugInfo)
      .pipe(ops.first())
      .subscribe((value) => {
        this.entityShowDebugInfoForm = this.fb.control(value);
        this.entityShowDebugInfoForm.valueChanges.subscribe(
          (state: boolean) => {
            this.store.dispatch(saveShowDebugInfo({ showDebugInfo: state }));
          },
        );
      });

    this.store
      .select(fromGlobalSettings.selectDebugEditorHeightPx)
      .pipe(ops.first())
      .subscribe((value) => {
        this.debugEditorHeightPxForm = this.fb.control(value);

        this.debugEditorHeightPxForm.valueChanges.subscribe((state: number) => {
          state = Math.max(10, state);
          state = Math.min(5000, state);
          this.store.dispatch(
            globalAction.saveDebugEditorHeightPx({
              editorHeightPx: Math.round(state),
            }),
          );
        });
      });

    this.store
      .select(fromGlobalSettings.selectBinaryExploreShowEntropy)
      .pipe(ops.first())
      .subscribe((value) => {
        this.formBinaryExploreShowEntropy = this.fb.control(value);
        this.formBinaryExploreShowEntropy.valueChanges.subscribe(
          (state: boolean) => {
            this.store.dispatch(
              globalAction.saveBinaryExploreShowEntropy({
                BinaryExploreShowEntropy: state,
              }),
            );
          },
        );
      });

    this.store
      .select(fromGlobalSettings.selectBinaryExploreShowFileFormatLegacy)
      .pipe(ops.first())
      .subscribe((value) => {
        this.formBinaryExploreShowFileFormatLegacy = this.fb.control(value);
        this.formBinaryExploreShowFileFormatLegacy.valueChanges.subscribe(
          (state: boolean) => {
            this.store.dispatch(
              globalAction.saveBinaryExploreShowFileFormatLegacy({
                BinaryExploreShowFileFormatLegacy: state,
              }),
            );
          },
        );
      });

    this.store
      .select(fromGlobalSettings.selectBinaryExploreShowMimetype)
      .pipe(ops.first())
      .subscribe((value) => {
        this.formBinaryExploreShowMimetype = this.fb.control(value);
        this.formBinaryExploreShowMimetype.valueChanges.subscribe(
          (state: boolean) => {
            this.store.dispatch(
              globalAction.saveBinaryExploreShowMimetype({
                BinaryExploreShowMimetype: state,
              }),
            );
          },
        );
      });

    this.store
      .select(fromGlobalSettings.selectBinaryExploreShowMagic)
      .pipe(ops.first())
      .subscribe((value) => {
        this.formBinaryExploreShowMagic = this.fb.control(value);
        this.formBinaryExploreShowMagic.valueChanges.subscribe(
          (state: boolean) => {
            this.store.dispatch(
              globalAction.saveBinaryExploreShowMagic({
                BinaryExploreShowMagic: state,
              }),
            );
          },
        );
      });
  }

  handleBucketSizeChange(state: boolean): void {
    const bucketSize = state ? this.largeBucketSize : this.smallBucketSize;
    this.store.dispatch(saveBucketSize({ size: bucketSize }));
    this.bucketToggleDelayActiveSignal.set(true);
    setTimeout(() => {
      this.bucketToggleDelayActiveSignal.set(false);
    }, 1000);
  }
}
