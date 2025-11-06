import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

// https://flowbite.com/docs/components/card/

@Component({
  selector: "flow-card",
  templateUrl: "./card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class CardComponent {
  @Input() backgroundColour: string = "bg-white";
  @Input() darkBackgroundColour: string = "dark:bg-azul-600";
}
