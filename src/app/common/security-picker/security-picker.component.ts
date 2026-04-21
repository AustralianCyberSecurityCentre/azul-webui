import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Signal,
  signal,
  WritableSignal,
} from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Observable, of, Subscription } from "rxjs";
import * as ops from "rxjs/operators";
import { ApiService } from "src/app/core/api/api.service";
import { components } from "src/app/core/api/openapi";
import { SecurityService } from "src/app/core/security.service";
import { Entity } from "src/app/core/services";
export type FormControls = {
  classification: FormControl<string>;
  caveat: FormControl<string>;
  releasability: FormControl<string>;
  tlp: FormControl<string>;
};

/**provides utility for user to generate a custom security object or choose a preset*/
@Component({
  selector: "azco-security-picker",
  templateUrl: "./security-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SecurityPickerComponent implements OnInit, OnDestroy {
  securityService = inject(SecurityService);
  api = inject(ApiService);
  entityService = inject(Entity);

  @Output() security = new EventEmitter<string>();
  @Input() fullWidth?: boolean;

  protected preset = new FormControl<string | null>(null);
  protected presetSubscription?: Subscription;

  protected formCustom: FormGroup = new FormGroup<FormControls>({
    classification: new FormControl(null, Validators.required),
    caveat: new FormControl(null),
    releasability: new FormControl(null),
    tlp: new FormControl(null),
  });

  protected formSubscription?: Subscription;

  protected customRender$: Observable<string>;
  protected selectionErrorSignal: WritableSignal<string> = signal("");

  // Work around to allow computed signals to work to calculate the displayed values.
  // This should all be rolled into signal forms, but signal forms isn't ready yet.
  protected classificationCurrentValueSignal: WritableSignal<string> =
    signal("");

  private classificationSub: Subscription;
  private priorityToAllowReleasabilityGteSignal: WritableSignal<number> =
    signal(-1);
  private _initialClassificationSignal: WritableSignal<
    readonly components["schemas"]["LabelOptionClassification"][]
  > = signal([]);
  private _initialCaveatSignal: WritableSignal<
    readonly components["schemas"]["LabelOptionCaveat"][]
  > = signal([]);
  private _initialRelSignal: WritableSignal<
    readonly components["schemas"]["LabelOption"][]
  > = signal([]);
  private _initialTlpSignal: WritableSignal<
    readonly components["schemas"]["LabelOptionTlp"][]
  > = signal([]);

  protected classificationSignal: Signal<string[]> = computed(() => {
    return this._initialClassificationSignal().map((val) => val.name);
  });

  getClassificationPriority(currentClassification: string): number {
    let currentPriority = -1;
    for (const clsf of this._initialClassificationSignal()) {
      if (currentClassification === clsf.name) {
        currentPriority = clsf.priority;
      }
    }
    return currentPriority;
  }

  protected caveatSignal: Signal<string[]> = computed(() => {
    const currentClassification = this.classificationCurrentValueSignal();
    const currentPriority = this.getClassificationPriority(
      currentClassification,
    );
    if (currentPriority === -1) {
      return this._initialCaveatSignal().map((cav) => cav.name);
    }
    // Filter disallowed caveats
    const returnList = Array<string>();
    for (const currentCav of this._initialCaveatSignal()) {
      if (
        currentPriority > currentCav.max_priority ||
        currentPriority < currentCav.min_priority
      ) {
        continue;
      }
      returnList.push(currentCav.name);
    }
    // Check if any currently selected caveats aren't allowed.
    const selectedCaveats = this.formCustom.controls["caveat"]?.getRawValue();
    // Can't iterate through caveats
    if (selectedCaveats === null || selectedCaveats === undefined) {
      return returnList;
    }
    const stillSelectedCaveats = Array<string>();
    for (const currentCav of selectedCaveats) {
      if (returnList.includes(currentCav)) {
        stillSelectedCaveats.push(currentCav);
      }
    }
    // Update the selected caveats and removed the disallowed values.
    if (stillSelectedCaveats.length !== selectedCaveats.length) {
      this.formCustom.controls["caveat"]?.setValue(stillSelectedCaveats);
    }

    return returnList;
  });

  protected relSignal: Signal<string[]> = computed(() => {
    const currentClassification = this.classificationCurrentValueSignal();
    const currentPriority = this.getClassificationPriority(
      currentClassification,
    );
    if (currentPriority === -1) {
      return this._initialRelSignal().map((val) => val.name);
    } else if (currentPriority < this.priorityToAllowReleasabilityGteSignal()) {
      this.formCustom.controls["releasability"]?.setValue(null);
      return [];
    }
    return this._initialRelSignal().map((val) => val.name);
  });

  protected tlpSignal: Signal<string[]> = computed(() => {
    const currentClassification = this.classificationCurrentValueSignal();
    const currentPriority = this.getClassificationPriority(
      currentClassification,
    );
    if (currentPriority === -1) {
      return this._initialTlpSignal().map((val) => val.name);
    } else if (
      currentPriority >= this.priorityToAllowReleasabilityGteSignal()
    ) {
      this.formCustom.controls["tlp"]?.setValue(null);
      return [];
    }
    return this._initialTlpSignal().map((val) => val.name);
  });

  // Regular <select> elements only accept strings, not objects - bind a custom value for custom options
  // instead that won't collide with a random UUID
  protected customString = "c7b416a9-0d0a-4780-bd9f-d0c9132a6789";

  ngOnInit(): void {
    this.classificationSub =
      this.securityService.userSpecificSecuritySettings$.subscribe((s) => {
        const newList = new Array<
          components["schemas"]["LabelOptionClassification"]
        >();
        s.labels.classification.options.forEach((clsf) => {
          newList.push(clsf);
        });
        this.priorityToAllowReleasabilityGteSignal.set(
          s.allow_releasability_priority_gte,
        );
        this._initialClassificationSignal.set(s.labels.classification.options);
        this._initialCaveatSignal.set(s.labels.caveat.options);
        this._initialRelSignal.set(s.labels.releasability.options);
        this._initialTlpSignal.set(s.labels.tlp.options);
      });

    this.presetSubscription = this.preset.valueChanges.subscribe(
      (selectedPreset) => {
        if (Array.isArray(selectedPreset)) {
          selectedPreset = selectedPreset[0];
        }

        if (selectedPreset == this.customString) {
          this.updateRender(this.formCustom.getRawValue());
        } else {
          this.security.emit(selectedPreset);
        }
      },
    );

    this.preset.setValue(null);

    this.formSubscription = this.formCustom.valueChanges.subscribe((values) => {
      this.classificationCurrentValueSignal.set(values.classification);
      this.updateRender(values);
    });
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
    this.presetSubscription?.unsubscribe();
    this.classificationSub?.unsubscribe();
  }

  updateRender(values: { [key: string]: string | Iterable<string> }) {
    // We want to invalidate the control until the custom form is complete
    this.security.emit(null);

    if (!this.formCustom.valid) {
      return;
    }

    const labels: string[] = [];
    for (const key in values) {
      if (!values[key]) {
        continue;
      }
      if (typeof values[key] === "string") {
        // single item selected
        labels.push(values[key]);
      } else {
        // multiple options selected
        for (const item of values[key]) {
          labels.push(item);
        }
      }
    }

    this.customRender$ = this.securityService
      .render$(labels.filter((x) => x.length > 0))
      .pipe(
        ops.catchError((err) => {
          if ("response" in err && err["response"]["status"] === 400) {
            let errorMsg = err["response"]["data"]["detail"];
            if (errorMsg === undefined) {
              errorMsg = "";
            }
            this.selectionErrorSignal.set(errorMsg);
          } else {
            // Something else happened; throw a regular error
            throw err;
          }
          return of(undefined);
        }),
        ops.filter((d) => d !== undefined),
        ops.tap((d) => {
          this.security.emit(d);
          this.selectionErrorSignal.set("");
        }),
      );
  }
}
