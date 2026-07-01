import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

// https://flowbite.com/docs/components/progress/

@Component({
  selector: "flow-progress",
  templateUrl: "./progress.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ProgressComponent {
  /**
   * Progress percentage as a floating point between 0-100.
   */
  value = input<number>(0);
}
