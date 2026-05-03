import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from "@angular/core";

@Component({
  imports: [],
  selector: "flow-accordion-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./accordion-panel.component.html",
})
export class AccordionPanelComponent {
  openInitial = input<boolean>(false);

  openState = signal(this.openInitial());
}
