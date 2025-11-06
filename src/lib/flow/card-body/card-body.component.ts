import { ChangeDetectionStrategy, Component } from "@angular/core";

// https://flowbite.com/docs/components/card/

@Component({
  selector: "flow-card-body",
  templateUrl: "./card-body.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class CardBodyComponent {}
