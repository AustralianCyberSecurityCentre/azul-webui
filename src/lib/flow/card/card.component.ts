import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

// https://flowbite.com/docs/components/card/

@Component({
  selector: "flow-card",
  templateUrl: "./card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class CardComponent {
  @Input() backgroundColour: string = "bg-white";
  @Input() darkBackgroundColour: string = "dark:bg-azul-600";
  @Input() isFlex: boolean = false;
}
