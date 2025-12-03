import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

// https://flowbite.com/docs/components/card/

@Component({
  selector: "flow-card-body",
  templateUrl: "./card-body.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class CardBodyComponent {
  @Input() isFlex: boolean = false;
}
