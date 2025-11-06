import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

// https://flowbite.com/docs/forms/input-field/

@Component({
  selector: "flow-label",
  templateUrl: "./label.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class LabelComponent {
  @Input() for?: string;
  @Input() noPadding: boolean = false;
  @Input() fieldSize: "large" | "medium" | "small-nopadding" | "small" =
    "medium";
}
