import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { BehaviorSubject, Observable, of, Subscription } from "rxjs";
import * as ops from "rxjs/operators";

import { ApiService } from "src/app/core/api/api.service";
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
  protected selectionError$ = new BehaviorSubject<string | undefined>(
    undefined,
  );

  // Regular <select> elements only accept strings, not objects - bind a custom value for custom options
  // instead that won't collide with a random UUID
  protected customString = "c7b416a9-0d0a-4780-bd9f-d0c9132a6789";

  ngOnInit(): void {
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
      this.updateRender(values);
    });
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
    this.presetSubscription?.unsubscribe();
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
            this.selectionError$.next(err["response"]["data"]["detail"]);
          } else {
            // Something else happened; throw a regular error
            throw err;
          }
          return of(undefined);
        }),
        ops.filter((d) => d !== undefined),
        ops.tap((d) => {
          this.security.emit(d);
          this.selectionError$.next(undefined);
        }),
      );
  }
}
