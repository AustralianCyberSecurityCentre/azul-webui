import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { HostControlDirective } from "src/lib/host-control/host-control.directive";

// https://flowbite.com/docs/forms/toggle/

@Component({
  selector: "flow-toggle",
  templateUrl: "./toggle.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  hostDirectives: [HostControlDirective],
})
export class ToggleComponent {
  hcd = inject(HostControlDirective);
}
