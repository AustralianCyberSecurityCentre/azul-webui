import { LabelType, Options } from "@angular-slider/ngx-slider";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import {
  FormControl,
  UntypedFormBuilder,
  UntypedFormGroup,
} from "@angular/forms";

import { faSpinner } from "@fortawesome/free-solid-svg-icons";

import {
  GlobalSettingStore,
  InitialGlobalSettingState,
} from "@app/core/signal-store/global-settings.store";
import {
  ColorTheme,
  RelationalGraphLevel,
  SourceViewEnum,
} from "@app/core/signal-store/global-state.types";

@Component({
  selector: "az-settings-overlay",
  templateUrl: "./settings-overlay.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SettingsOverlayComponent implements OnInit {
  private store = inject(GlobalSettingStore);
  private fb = inject(UntypedFormBuilder);

  protected entityBucketSizeForm: FormControl;
  protected entityShowDebugInfoForm: FormControl;
  protected enableHexStringSyncForm: FormControl;
  protected defaultSourceViewForm: FormControl;
  protected debugEditorHeightPxForm: FormControl;

  protected formBinaryViewTableFormat: FormControl;
  protected formBinaryExploreShowEntropy: FormControl;
  protected formBinaryExploreShowMimetype: FormControl;
  protected formBinaryExploreShowMagic: FormControl;
  protected formBinaryExploreShowBinarySources: FormControl;
  protected formBinaryExploreShowBinarySourceReferences: FormControl;

  protected globalForm: UntypedFormGroup;

  protected bucketToggleDelayActiveSignal = signal(false);
  protected readonly smallBucketSize = InitialGlobalSettingState.bucketSize; // 100
  protected readonly largeBucketSize = 1000;

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

  ngOnInit() {
    this.globalForm = this.fb.group({
      theme: this.fb.group({
        color: [this.store.theme()],
      }),
    });

    this.globalForm.valueChanges.subscribe((newValues) => {
      this.store.updateTheme(newValues.theme.color);
    });

    this.entityBucketSizeForm = this.fb.control(
      this.store.bucketSize() == this.largeBucketSize,
    );
    this.entityBucketSizeForm.valueChanges.subscribe((e) => {
      this.handleBucketSizeChange(e);
    });

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

    this.entityShowDebugInfoForm = this.fb.control(this.store.showDebugInfo());
    this.entityShowDebugInfoForm.valueChanges.subscribe((state: boolean) => {
      this.store.updateShowDebugInfo(state);
    });

    this.debugEditorHeightPxForm = this.fb.control(
      this.store.debugQueryEditorHeightPx(),
    );
    this.debugEditorHeightPxForm.valueChanges.subscribe((state: number) => {
      state = Math.max(10, state);
      state = Math.min(5000, state);
      this.store.updateDebugQueryEditorHeightPx(Math.round(state));
    });

    this.formBinaryViewTableFormat = this.fb.control(this.store.IsTableView());

    this.formBinaryViewTableFormat.valueChanges.subscribe((state: boolean) => {
      this.store.updateIsTableView(state);
    });

    this.formBinaryExploreShowEntropy = this.fb.control(
      this.store.BinaryExploreShowEntropy(),
    );
    this.formBinaryExploreShowEntropy.valueChanges.subscribe(
      (state: boolean) => {
        this.store.updateBinaryExploreShowEntropy(state);
      },
    );

    this.formBinaryExploreShowMimetype = this.fb.control(
      this.store.BinaryExploreShowMimetype(),
    );
    this.formBinaryExploreShowMimetype.valueChanges.subscribe(
      (state: boolean) => {
        this.store.updateBinaryExploreShowMimetype(state);
      },
    );

    this.formBinaryExploreShowMagic = this.fb.control(
      this.store.BinaryExploreShowMagic(),
    );
    this.formBinaryExploreShowMagic.valueChanges.subscribe((state: boolean) => {
      this.store.updateBinaryExploreShowMagic(state);
    });

    this.formBinaryExploreShowBinarySources = this.fb.control(
      this.store.BinaryExploreShowSources(),
    );
    this.formBinaryExploreShowBinarySources.valueChanges.subscribe(
      (state: boolean) => {
        this.store.updateBinaryExploreShowSources(state);
      },
    );

    this.formBinaryExploreShowBinarySourceReferences = this.fb.control(
      this.store.BinaryExploreShowSourceReferences(),
    );
    this.formBinaryExploreShowBinarySourceReferences.valueChanges.subscribe(
      (state: boolean) => {
        this.store.updateBinaryExploreShowSourceReferences(state);
      },
    );

    this.enableHexStringSyncForm = this.fb.control(
      this.store.enableHexStringSync(),
    );
    this.enableHexStringSyncForm.valueChanges.subscribe((state: boolean) => {
      this.store.updateEnableHexStringSync(state);
    });

    this.defaultSourceViewForm = this.fb.control(
      this.store.defaultSourceView(),
    );
    this.defaultSourceViewForm.valueChanges.subscribe(
      (state: SourceViewEnum) => {
        this.store.updateDefaultSourceView(state);
      },
    );
  }

  handleBucketSizeChange(state: boolean): void {
    const bucketSize = state ? this.largeBucketSize : this.smallBucketSize;
    this.store.updateBucketSize(bucketSize);
    this.bucketToggleDelayActiveSignal.set(true);
    setTimeout(() => {
      this.bucketToggleDelayActiveSignal.set(false);
    }, 1000);
  }
}
