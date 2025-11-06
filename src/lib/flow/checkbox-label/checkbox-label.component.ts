import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

// hhttps://flowbite.com/docs/forms/checkbox/

@Component({
  selector: "flow-checkbox-label",
  templateUrl: "./checkbox-label.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class CheckboxLabelComponent {
  @Input() for: string;
}
