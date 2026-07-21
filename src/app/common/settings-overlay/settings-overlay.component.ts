import { LabelType, Options } from "@angular-slider/ngx-slider";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  WritableSignal,
} from "@angular/core";

import { faSpinner } from "@fortawesome/free-solid-svg-icons";

import { form, max, min } from "@angular/forms/signals";
import {
  GlobalSettingState,
  GlobalSettingStore,
  InitialGlobalSettingState,
} from "@app/core/signal-store/global-settings.store";
import {
  ColorTheme,
  RelationalGraphLevel,
  SourceViewEnum,
  ValidHexSpaces,
} from "@app/core/signal-store/global-state.types";

@Component({
  selector: "az-settings-overlay",
  templateUrl: "./settings-overlay.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SettingsOverlayComponent {
  private store = inject(GlobalSettingStore);

  protected readonly smallBucketSize = InitialGlobalSettingState.bucketSize; // 100
  protected readonly largeBucketSize = 1000;

  protected settingsFormModel: WritableSignal<
    GlobalSettingState & { isLargeBucketSize: boolean }
  > = signal({
    IsTableView: this.store.IsTableView(),
    BinaryExploreShowEntropy: this.store.BinaryExploreShowEntropy(),
    BinaryExploreShowMimetype: this.store.BinaryExploreShowMimetype(),
    BinaryExploreShowMagic: this.store.BinaryExploreShowMagic(),
    BinaryExploreShowSources: this.store.BinaryExploreShowSources(),
    BinaryExploreShowSourceReferences:
      this.store.BinaryExploreShowSourceReferences(),
    bucketSize: this.store.bucketSize(),
    isLargeBucketSize: this.store.bucketSize() === this.largeBucketSize,
    relationalGraphShowCousinsByDefault:
      this.store.relationalGraphShowCousinsByDefault(),
    showDebugInfo: this.store.showDebugInfo(),
    debugQueryEditorHeightPx: this.store.debugQueryEditorHeightPx(),
    theme: this.store.theme(),
    enableHexStringSync: this.store.enableHexStringSync(),
    defaultSourceView: this.store.defaultSourceView(),
    hexViewGroupingSize: this.store.hexViewGroupingSize(),
    pluginPageColumns: this.store.pluginPageColumns(),
  });

  protected settingsForm = form(this.settingsFormModel, (f) => {
    max(f.debugQueryEditorHeightPx, 5000);
    min(f.debugQueryEditorHeightPx, 10);
  });

  protected bucketToggleDelayActiveSignal = signal(false);

  protected darkColorTheme = ColorTheme.Dark;
  protected lightColorTheme = ColorTheme.Light;

  protected SourceViewEnum = SourceViewEnum;

  protected faSpinner = faSpinner;

  protected sliderValue: number = 2;
  protected complexitySliderOptions: Options = {
    stepsArray: [
      { value: 0, legend: "Basic" },
      { value: 1, legend: "Simple" },
      { value: 2, legend: "Normal" },
      { value: 3, legend: "Complex" },
    ],
    hideLimitLabels: true,
    translate: (value: number, _label: LabelType): string => {
      switch (value) {
        case 0:
          this.store.updateRelationalGraphShowCousinsByDefault(
            RelationalGraphLevel.NO,
          );
          return "Basic";
        case 1:
          this.store.updateRelationalGraphShowCousinsByDefault(
            RelationalGraphLevel.YES_SMALL,
          );
          return "Simple";
        case 2:
          this.store.updateRelationalGraphShowCousinsByDefault(
            RelationalGraphLevel.YES,
          );
          return "Normal";
        case 3:
          this.store.updateRelationalGraphShowCousinsByDefault(
            RelationalGraphLevel.YES_LARGE,
          );
          return "Complex";
        default:
          return "Normal";
      }
    },
  };

  protected orderedValidHexSpaces = [
    ValidHexSpaces.opt1,
    ValidHexSpaces.opt2,
    ValidHexSpaces.opt4,
    ValidHexSpaces.opt16,
  ];

  constructor() {
    effect(() => {
      this.settingsForm();
      const formState = this.settingsFormModel();

      // Ensure pixel heigh is never invalid
      if (formState.debugQueryEditorHeightPx > 5000) {
        formState.debugQueryEditorHeightPx = 5000;
      } else if (formState.debugQueryEditorHeightPx < 10) {
        formState.debugQueryEditorHeightPx = 10;
      }

      // Special bucket handling
      let didBucketChange = false;
      if (
        formState.bucketSize === this.largeBucketSize &&
        formState.isLargeBucketSize === false
      ) {
        formState.bucketSize = this.smallBucketSize;
        didBucketChange = true;
      } else if (
        formState.bucketSize === this.smallBucketSize &&
        formState.isLargeBucketSize === true
      ) {
        formState.bucketSize = this.largeBucketSize;
        didBucketChange = true;
      }
      // General store update
      this.store.updateAllFields(formState);

      // Handle hiding bucket
      if (didBucketChange) {
        this.bucketToggleDelayActiveSignal.set(true);
        setTimeout(() => {
          this.bucketToggleDelayActiveSignal.set(false);
        }, 1000);
      }
    });

    // Affects rendering, translate handles the rest.
    switch (this.store.relationalGraphShowCousinsByDefault()) {
      case RelationalGraphLevel.NO:
        this.sliderValue = 0;
        break;
      case RelationalGraphLevel.YES_SMALL:
        this.sliderValue = 1;
        break;
      case RelationalGraphLevel.YES:
        this.sliderValue = 2;
        break;
      case RelationalGraphLevel.YES_LARGE:
        this.sliderValue = 3;
        break;
      default:
        this.sliderValue = 2;
    }
  }
}
