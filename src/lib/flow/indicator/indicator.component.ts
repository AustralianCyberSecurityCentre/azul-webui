import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

// https://flowbite.com/docs/components/indicators/#default-indicator

@Component({
  selector: "flow-indicator",
  templateUrl: "./indicator.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class IndicatorComponent {
  count = input<number>(5);
  current = input<number>(2);
}
