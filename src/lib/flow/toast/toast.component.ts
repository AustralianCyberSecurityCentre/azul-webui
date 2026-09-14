import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faCircleXmark,
  faPaperclip,
  IconDefinition,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { HotToastRef } from "@ngxpert/hot-toast";

export interface customToastInput {
  title?: string;
  message?: string;
  toastType?:
    | "toast-success"
    | "toast-info"
    | "toast-warning"
    | "toast-error"
    | "toast-copy";
}

@Component({
  selector: "flow-toast",
  templateUrl: "./toast.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FontAwesomeModule],
})
export class ToastComponent {
  protected faXmark = faXmark;

  toastRef: HotToastRef<customToastInput> = inject(
    HotToastRef<customToastInput>,
  );

  protected faIcons: Map<string, IconDefinition> = new Map<
    string,
    IconDefinition
  >([
    [null, faCircleInfo],
    ["toast-success", faCircleCheck],
    ["toast-info", faCircleInfo],
    ["toast-warning", faCircleExclamation],
    ["toast-error", faCircleXmark],
    ["toast-copy", faPaperclip],
  ]);
}
