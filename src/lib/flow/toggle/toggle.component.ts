import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { FormCheckboxControl } from "@angular/forms/signals";

// https://flowbite.com/docs/forms/toggle/

@Component({
  selector: "flow-toggle",
  templateUrl: "./toggle.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class ToggleComponent implements FormCheckboxControl {
  checked = model<boolean>(false);
  disabled = input(false);

  onToggle(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.checked.set(inputElement.checked);
  }
}
