import { ChangeDetectionStrategy, Component } from "@angular/core";

// Custom component, for providing a visually separated card footer

@Component({
  selector: "flow-card-footer",
  templateUrl: "./card-footer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class CardFooterComponent {}
