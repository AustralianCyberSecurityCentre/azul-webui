import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  inject,
  output,
} from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import {
  faCheckDouble,
  faSquareMinus,
} from "@fortawesome/free-solid-svg-icons";
import * as ops from "rxjs/operators";

import { ApiService } from "@app/core/api/api.service";
import { components } from "@app/core/api/openapi";
import { SecurityService } from "@app/core/security.service";

import { ButtonSize, ButtonType } from "@lib/flow/button/button.component";

export type FormControls = {
  classification: FormControl<string>;
  caveat: FormControl<string>;
  releasability: FormControl<string>;
  tlp: FormControl<string>;
  andSearch: FormControl;
};

/**provides utility for the user to specify what security markings they dont want to see*/
@Component({
  selector: "az-security-limit",
  templateUrl: "./security-limit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SecurityLimitComponent {
  securityService = inject(SecurityService);
  api = inject(ApiService);
  changeDetectorRef = inject(ChangeDetectorRef);

  protected settings: components["schemas"]["Settings"];
  protected faCheckDouble = faCheckDouble;
  protected faSquareMinus = faSquareMinus;
  protected currentWarningMessage: string = "";

  protected ButtonSize = ButtonSize;
  protected ButtonType = ButtonType;

  formCustom: FormGroup = new FormGroup<FormControls>({
    classification: new FormControl(null, Validators.required),
    caveat: new FormControl(null),
    releasability: new FormControl(null),
    tlp: new FormControl(null),
    andSearch: new FormControl(this.api.getRelFilterOption() === "true"),
  });

  allGroups: {
    classification: components["schemas"]["LabelOptionsClassification"];
    caveat: components["schemas"]["LabelOptionsCaveat"];
    releasability: components["schemas"]["LabelOptionsReleasability"];
    tlp: components["schemas"]["LabelOptionsTlp"];
  };

  @Input() set securitySettings(
    data: components["schemas"]["Settings"] | null,
  ) {
    if (data === null) {
      return;
    }
    this.settings = data;

    this.allGroups = {
      classification: this.settings.labels.classification,
      caveat: this.settings.labels.caveat,
      releasability: this.settings.labels.releasability,
      tlp: this.settings.labels.tlp,
    };

    this.setSecurityForm(true);
  }

  submitLimits = output<boolean>();

  private updateForm(val: boolean, initial: boolean = false) {
    // loop through all securitylabel groups to set or load values
    for (const k in this.allGroups) {
      const group = this.allGroups[k];
      const included: string[] = [];
      for (const sec of group.options) {
        if (!val) {
          // exclude option
          continue;
        }
        if (initial && this.api.currentExclusions.indexOf(sec.name) >= 0) {
          // on initial page load, unselect any excluded items
          continue;
        }
        included.push(sec.name);
      }
      this.formCustom.get(k).setValue(included);
    }
  }

  setSecurityForm(on: boolean) {
    this.updateForm(on, true);
  }

  updateSecurityForm(on: boolean) {
    this.updateForm(on);
  }

  // Reset form to the default state.
  resetForm() {
    this.updateForm(true);
    // Reset the form value and the storage value for the filter
    this.formCustom.get("andSearch")?.setValue(false);
    this.api.changeRelFilterOption(false);
  }

  ensureReleasabilityOriginIsSelected() {
    const raw = this.formCustom.getRawValue();
    if (raw.releasability.indexOf(this.allGroups.releasability.origin) === -1) {
      raw.releasability.push(this.allGroups.releasability.origin);
      this.formCustom.patchValue(raw);
      this.currentWarningMessage = `The origin releasability ${this.allGroups.releasability.origin} can't be deselected.`;
    } else {
      this.currentWarningMessage = "";
    }
  }

  onSubmit() {
    // iterate through all groups and find inverted set of what the form controls actually report as being selected
    // find option that are excluded, not included. If AND search is toggled then we include the selected RELS
    // Clear all cache, to ensure no bad security caching.
    this.api.clearCache().pipe(ops.take(1)).subscribe();

    const raw = this.formCustom.getRawValue();
    const excluded: string[] = [];
    const included: string[] = [];
    for (const k in this.allGroups) {
      for (const option of this.allGroups[k].options) {
        if (
          this.formCustom.get("andSearch")?.value &&
          k === "releasability" &&
          raw[k] &&
          raw[k].indexOf(option.name) >= 0
        ) {
          included.push(option.name);
        }
        if (raw[k] === null || raw[k].indexOf(option.name) < 0) {
          excluded.push(option.name);
        }
      }
    }
    this.api.changeExclusions(excluded, included);
    this.submitLimits.emit(true);
  }

  updateLocalStorage() {
    this.api.changeRelFilterOption(this.formCustom.get("andSearch")?.value);
  }
}
