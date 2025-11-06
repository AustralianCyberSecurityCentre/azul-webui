import { OverlayModule } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  TemplateRef,
} from "@angular/core";
import { BehaviorSubject } from "rxjs";
import * as ops from "rxjs/operators";
import { faCopy } from "@fortawesome/free-solid-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";

// https://flowbite.com/docs/components/tooltips/
// Hover implemented using Tailwind groups instead of Flowbite vanilla JS

@Component({
  selector: "flow-tooltip",
  templateUrl: "./tooltip.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, OverlayModule, FaIconComponent],
})
export class TooltipComponent {
  @Input()
  message: string | undefined;

  @Input()
  subText: string | undefined;

  @Input()
  copyText: boolean = false;

  @Input()
  tplRef: TemplateRef<unknown> = null;

  @Input()
  tplContext: unknown = null;

  @Input()
  direction: "top" | "bottom" = "top";

  constructor() {}

  protected hoveringRaw$ = new BehaviorSubject(false);
  protected hovering$ = this.hoveringRaw$.pipe(ops.debounceTime(10));
  protected fade$ = this.hovering$.pipe(ops.delay(50));

  protected fadeIn() {
    this.hoveringRaw$.next(true);
  }

  protected fadeOut() {
    this.hoveringRaw$.next(false);
  }

  protected readonly faCopy = faCopy;
}
