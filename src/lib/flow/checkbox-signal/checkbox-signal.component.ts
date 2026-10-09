import { ChangeDetectionStrategy, Component, model } from "@angular/core";
import { FormCheckboxControl } from "@angular/forms/signals";

@Component({
  selector: "flow-checkbox-signal",
  templateUrl: "./checkbox-signal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxSignalComponent implements FormCheckboxControl {
  checked = model<boolean>(false);

  toggle() {
    this.checked.update((v) => !v);
  }
}
