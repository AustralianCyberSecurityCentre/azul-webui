import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { HostControlDirective } from "@lib/host-control/host-control.directive";

// https://flowbite.com/docs/forms/input-field/
// Includes styling that Flowbite's WIP Angular implementation ships

@Component({
  selector: "flow-checkbox",
  templateUrl: "./checkbox.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  hostDirectives: [HostControlDirective],
})
export class CheckboxComponent {
  required = input<boolean>(false);

  hcd = inject(HostControlDirective);
}
