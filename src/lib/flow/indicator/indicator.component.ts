import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

// https://flowbite.com/docs/components/indicators/#default-indicator

@Component({
  selector: "flow-indicator",
  templateUrl: "./indicator.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class IndicatorComponent {
  @Input()
  protected count = 5;

  @Input()
  protected current = 2;
}
