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
} from "@fortawesome/free-solid-svg-icons";
import { HotToastRef } from "@ngxpert/hot-toast";

export interface customToastInput {
  message?: string;
  toastType?:
    "toast-success" | "toast-info" | "toast-warning" | "toast-error" | "copy";
}

@Component({
  selector: "flow-toast",
  templateUrl: "./toast.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FontAwesomeModule],
})
export class ToastComponent {
  toastRef: HotToastRef<customToastInput> = inject(
    HotToastRef<customToastInput>,
  );

  protected faIcons: Map<string, IconDefinition> = new Map<
    string,
    IconDefinition
  >([
    ["toast-success", faCircleCheck],
    ["toast-info", faCircleInfo],
    ["toast-warning", faCircleExclamation],
    ["toast-error", faCircleXmark],
    ["copy", faPaperclip],
  ]);
}
