import { ChangeDetectionStrategy, Component, input } from "@angular/core";

// https://flowbite.com/docs/components/card/

@Component({
  selector: "flow-card",
  templateUrl: "./card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class CardComponent {
  backgroundColour = input<string>("bg-white");
  darkBackgroundColour = input<string>("dark:bg-azul-600");
  isFlex = input<boolean>(false);
}
