import { ChangeDetectionStrategy, Component } from "@angular/core";

// https://flowbite.com/docs/typography/hr/

@Component({
  selector: "flow-hr",
  templateUrl: "./hr.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class HRComponent {}
