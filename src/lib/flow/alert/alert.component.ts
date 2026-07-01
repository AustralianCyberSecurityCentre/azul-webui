import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCircleExclamation,
  faCircleInfo,
  faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";

// https://flowbite.com/docs/components/alerts/

@Component({
  selector: "flow-alert",
  templateUrl: "./alert.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FontAwesomeModule],
})
export class AlertComponent {
  protected icons = {
    info: faCircleInfo,
    warning: faCircleExclamation,
    error: faCircleXmark,
  };

  alertType = input<"info" | "warning" | "error">();
  title = input<string>();
  /** Distinguish the alerts background if this alert is placed within another card */
  withinCard = input<boolean>(false);
}
