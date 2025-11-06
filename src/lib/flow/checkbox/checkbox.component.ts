import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { HostControlDirective } from "src/lib/host-control/host-control.directive";
import { FlowModule } from "src/lib/flow/flow.module";

// https://flowbite.com/docs/forms/input-field/
// Includes styling that Flowbite's WIP Angular implementation ships

@Component({
  selector: "flow-checkbox",
  templateUrl: "./checkbox.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FlowModule, ReactiveFormsModule],
  hostDirectives: [HostControlDirective],
})
export class CheckboxComponent {
  @Input() required: boolean = false;

  hcd = inject(HostControlDirective);
}
